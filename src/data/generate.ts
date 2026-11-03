import { Rand } from '../lib/rng';
import { DataRecord, REGIONS, Region, SEGMENTS, Segment } from './types';

export const SEED = 42;
export const TOTAL_DAYS = 730;
export const N_RECORDS = 20000;
/** Último dia da base (fixo para reprodutibilidade): 02/11/2026 */
export const DATA_END_UTC = Date.UTC(2026, 10, 2);
/** A partir deste dia a base sofre "drift" (queda de engajamento + degradação do modelo). */
export const DRIFT_START = 600;
const NOISE = [0.35, 0.45, 0.6, 0.75, 1.0];

export const dayToDate = (d: number) => new Date(DATA_END_UTC - (TOTAL_DAYS - 1 - d) * 86400000);
export const dayToISO = (d: number) => dayToDate(d).toISOString().slice(0, 10);
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

interface Customer {
  id: string;
  segment: Segment;
  region: Region;
  tenure0: number;
  effect: number;
}

const TICKET: Record<Segment, number> = { Enterprise: 850, 'Mid-Market': 420, SMB: 190, Startup: 130 };
const LAMBDA: Record<Segment, number> = { Enterprise: 14, 'Mid-Market': 8, SMB: 4, Startup: 3 };
const ENG_ADJ: Record<Segment, number> = { Enterprise: 5, 'Mid-Market': 2, SMB: 0, Startup: -3 };
const CHURN_ADJ: Record<Segment, number> = { Enterprise: -0.6, 'Mid-Market': -0.2, SMB: 0.2, Startup: 0.6 };
const CONV_ADJ: Record<Segment, number> = { Enterprise: 0.3, 'Mid-Market': 0.1, SMB: 0, Startup: -0.2 };

export class DataFactory {
  customers: Customer[];
  rng: Rand;
  nextId = 1;
  constructor(seed: number, nCustomers = 4000) {
    this.rng = new Rand(seed);
    const r = this.rng;
    this.customers = Array.from({ length: nCustomers }, (_, i) => ({
      id: `CLI-${String(i + 1).padStart(5, '0')}`,
      segment: r.weighted(SEGMENTS, [0.1, 0.25, 0.4, 0.25]),
      region: r.weighted(REGIONS, [0.42, 0.18, 0.2, 0.1, 0.1]),
      tenure0: r.int(1, 48),
      effect: r.normal(),
    }));
  }

  make(d: number): DataRecord {
    const r = this.rng;
    const c = this.customers[Math.floor(r.next() * this.customers.length)];
    // drift gradual: intensidade 0→1 ao longo de 60 dias a partir de DRIFT_START
    const g = clamp((d - DRIFT_START) / 60, 0, 1);

    const engagement = clamp(55 + ENG_ADJ[c.segment] + c.effect * 8 + r.normal() * 17 - 16 * g, 2, 100);
    const transactions = Math.max(
      1,
      Math.round(LAMBDA[c.segment] * (0.4 + engagement / 100) * (0.7 + 0.6 * r.next()) + r.normal()),
    );
    const ticket =
      TICKET[c.segment] *
      Math.exp(0.45 * r.normal()) *
      (1 + (0.35 * d) / TOTAL_DAYS) *
      (1 + 0.08 * Math.sin((2 * Math.PI * d) / 365));
    const revenue = Math.round(transactions * ticket * 100) / 100;
    const latency = Math.round(70 * Math.exp(0.35 * r.normal()) * (1 + 0.3 * g) * 10) / 10;
    const tenure = Math.min(60, c.tenure0 + Math.floor(d / 180));

    const zObs =
      -2.0 -
      (1.2 * (engagement - 55)) / 20 -
      (0.9 * (tenure - 24)) / 16 +
      CHURN_ADJ[c.segment] +
      (0.4 * (latency - 70)) / 40;
    const churn: 0 | 1 = r.next() < sigmoid(zObs + 0.5 * r.normal()) ? 1 : 0;
    const dm = 1 + g; // degradação do modelo sob drift
    const scores = NOISE.map((n) => Math.round(sigmoid(zObs + n * dm * r.normal()) * 10000) / 10000);

    const convProb =
      Math.round(
        sigmoid(-0.5 + 0.04 * (engagement - 55) + 0.25 * Math.log(transactions) + CONV_ADJ[c.segment] + 0.5 * r.normal()) *
          10000,
      ) / 10000;
    // funil aninhado por construção: cada etapa é subconjunto da anterior
    let stage: 0 | 1 | 2 | 3 | 4 = 0;
    if (engagement >= 30) stage = 1;
    if (stage === 1 && convProb >= 0.3) stage = 2;
    if (stage === 2 && r.next() < 0.65) stage = 3;
    if (stage === 3 && r.next() < Math.min(0.95, convProb + 0.35)) stage = 4;

    return {
      id: 0,
      d,
      date: dayToISO(d),
      customerId: c.id,
      segment: c.segment,
      region: c.region,
      revenue,
      transactions,
      engagement: Math.round(engagement * 10) / 10,
      tenure,
      latency,
      churn,
      convProb,
      stage,
      scores,
      isFirst: false,
    };
  }

  /** Novos registros "ao vivo" (sempre no último dia da base). */
  liveBatch(n: number): DataRecord[] {
    const out: DataRecord[] = [];
    for (let i = 0; i < n; i++) {
      const rec = this.make(TOTAL_DAYS - 1);
      rec.id = this.nextId++;
      out.push(rec);
    }
    return out;
  }
}

export function buildDataset(seed = SEED, n = N_RECORDS) {
  const f = new DataFactory(seed);
  const recs: DataRecord[] = [];
  for (let i = 0; i < n; i++) {
    // densidade crescente no tempo => crescimento do negócio
    const d = Math.min(TOTAL_DAYS - 1, Math.floor((TOTAL_DAYS - 1) * Math.sqrt(f.rng.next())));
    recs.push(f.make(d));
  }
  recs.sort((a, b) => a.d - b.d);
  const seen = new Set<string>();
  recs.forEach((r, i) => {
    r.id = i + 1;
    if (!seen.has(r.customerId)) {
      seen.add(r.customerId);
      r.isFirst = true;
    }
  });
  f.nextId = n + 1;
  // gerador "ao vivo" separado, também determinístico
  const live = new DataFactory(seed + 1);
  live.customers = f.customers;
  live.nextId = n + 1;
  return { records: recs, factory: live };
}
