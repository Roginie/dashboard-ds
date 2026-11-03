import { chromium } from 'playwright';
import fs from 'node:fs';

const URL = process.env.URL || 'http://localhost:5173';
const OUT = process.env.OUT || '.';
const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

const results = {};
const kpi = async (label) => (await page.locator(`[data-kpi="${label}"] [data-value]`).first().innerText()).trim();
const charts = async () => {
  await page.waitForFunction(() => document.querySelectorAll('[data-chart]').length > 0 && [...document.querySelectorAll('[data-chart]')].every((e) => e.dataset.ready === '1'), null, { timeout: 15000 });
  await page.waitForTimeout(900);
  return page.evaluate(() => [...document.querySelectorAll('[data-chart]')].map((e) => { const c = e.querySelector('canvas'); return !!c && c.width > 50 && c.height > 50; }));
};

await page.goto(URL + '/#/executivo');
await page.waitForSelector('[data-kpi]', { timeout: 20000 });
for (const [id, label] of [['executivo', 'Executivo'], ['analise', 'Análise'], ['ml', 'ML']]) {
  await page.goto(`${URL}/#/${id}`);
  await page.waitForTimeout(400);
  const c = await charts();
  results[label] = { charts: c.length, rendered: c.filter(Boolean).length };
  await page.screenshot({ path: `${OUT}/shot-${id}.png`, fullPage: true });
}

// filtros alteram os dados
await page.goto(`${URL}/#/executivo`);
await page.waitForSelector('[data-kpi]');
const base = await kpi('Receita total');
await page.getByRole('button', { name: '7 dias' }).click();
await page.waitForTimeout(300);
const r7 = await kpi('Receita total');
await page.getByRole('button', { name: '12 meses' }).click();
await page.selectOption('select[aria-label="Segmento"]', 'Enterprise');
await page.waitForTimeout(300);
const ent = await kpi('Receita total');
await page.selectOption('select[aria-label="Região"]', 'Norte');
await page.waitForTimeout(300);
const entNorte = await kpi('Receita total');
results.filtros = { base, r7, ent, entNorte, mudam: new Set([base, r7, ent, entNorte]).size === 4 };
await page.selectOption('select[aria-label="Segmento"]', 'all');
await page.selectOption('select[aria-label="Região"]', 'all');

// ao vivo / atualizar
const preds = async () => { await page.goto(`${URL}/#/ml`); await page.waitForSelector('[data-kpi="Predições"]'); return kpi('Predições'); };
const p0 = await preds();
await page.getByRole('button', { name: 'Atualizar indicadores' }).click();
await page.waitForTimeout(300);
const p1 = await kpi('Predições');
results.atualizar = { antes: p0, depois: p1, mudou: p0 !== p1 };

// limiar altera métricas
const rec0 = await kpi('Recall');
await page.locator('input[type=range]').fill('0.2');
await page.waitForTimeout(300);
const rec1 = await kpi('Recall');
results.limiar = { rec0, rec1, mudou: rec0 !== rec1 };

// tabela + CSV
await page.goto(`${URL}/#/dados`);
await page.waitForSelector('[data-table] tbody tr');
const rows = await page.locator('[data-table] tbody tr').count();
const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Exportar CSV/ }).click()]);
const path = `${OUT}/export.csv`;
await dl.saveAs(path);
const lines = fs.readFileSync(path, 'utf8').trim().split('\n').length - 1;
const subtitle = await page.locator('section p').first().innerText();
results.tabela = { linhasNaPagina: rows, linhasCsv: lines, subtitle };

// tema claro + mobile
await page.goto(`${URL}/#/executivo`);
await page.getByRole('button', { name: 'Alternar tema' }).click();
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/shot-light.png` });
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(800);
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
await page.screenshot({ path: `${OUT}/shot-mobile.png`, fullPage: true });
results.mobile = { overflowHorizontal: overflow };

results.errosConsole = errors;
console.log(JSON.stringify(results, null, 2));
await browser.close();

