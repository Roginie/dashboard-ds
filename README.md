# DataLens BI — Dashboard de Ciência de Dados

Dashboard de BI interativo com **dados 100% fictícios** (semente fixa 42, 20.000 registros), com 15 visualizações em Visão Executiva, Análise de Dados e Machine Learning.

**Stack:** React, TypeScript, Vite, Tailwind CSS, Apache ECharts, Lucide e Framer Motion.

## Como rodar

```bash
npm install
npm run dev -- --host 0.0.0.0   # http://localhost:5173
npm test                        # testes da camada de dados (Vitest)
npm run build                   # checagem de tipos + build de produção
```

## Validação no navegador (opcional)

```bash
npx playwright install chromium
node scripts/validate.mjs       # navegação, 15 gráficos, filtros, CSV e responsividade
```

## Estrutura

- `src/data/` — gerador sintético, tipos e funções de agregação (KPIs, ROC/AUC, PSI etc.)
- `src/pages/` — Executiva, Análise, ML e Base de Dados
- `src/components/` — gráfico (ECharts), cards, layout
