const nf0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf3 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const cmp = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });

export const int = (v: number) => nf0.format(v);
export const num1 = (v: number) => nf1.format(v);
export const num2 = (v: number) => nf2.format(v);
export const num3 = (v: number) => nf3.format(v);
export const compact = (v: number) => cmp.format(v);
export const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
export const brl2 = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
export const brlShort = (v: number) => 'R$ ' + cmp.format(v);
/** v já está em unidades de porcentagem (ex.: 12,5 => "12,5%"). */
export const pct = (v: number, d = 1) =>
  `${v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })}%`;
export const ms = (v: number) => `${nf1.format(v)} ms`;
