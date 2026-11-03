/** Gerador pseudoaleatório determinístico (mulberry32) com semente fixa. */
export class Rand {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0;
  }
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  normal(): number {
    let u = 0;
    while (u === 0) u = this.next();
    const v = this.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  int(a: number, b: number): number {
    return a + Math.floor(this.next() * (b - a + 1));
  }
  weighted<T>(items: readonly T[], w: number[]): T {
    const total = w.reduce((a, b) => a + b, 0);
    let x = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      x -= w[i];
      if (x <= 0) return items[i];
    }
    return items[items.length - 1];
  }
}
