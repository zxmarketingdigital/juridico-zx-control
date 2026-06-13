// ════════════════════════════════════════════════════════════════════════
// Cálculo de prazos em DIAS ÚTEIS — função pura (spec §4.4 / §7.3).
// Regras: nunca UTC, nunca data corrida; fins de semana e feriados nacionais
// não contam; data fatal sempre cai em dia útil. CPC art. 219 (só dias úteis)
// e art. 224 §§ (exclui o dia do começo; inicia no 1º dia útil seguinte).
//
// Datas trafegam como 'YYYY-MM-DD' (data civil de America/Sao_Paulo). A
// aritmética usa âncora em UTC-meia-noite só pra evitar drift de fuso/DST —
// o dia civil é preservado 1:1 (não há conversão de fuso que mude o dia).
// ════════════════════════════════════════════════════════════════════════

import { FERIADOS_FIXOS } from "./config";

type ISODate = string; // 'YYYY-MM-DD'

function toUTC(d: ISODate): Date {
  const [y, m, day] = d.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, day));
}

function fromUTC(dt: Date): ISODate {
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDias(d: ISODate, n: number): ISODate {
  const dt = toUTC(d);
  dt.setUTCDate(dt.getUTCDate() + n);
  return fromUTC(dt);
}

function diaDaSemana(d: ISODate): number {
  return toUTC(d).getUTCDay(); // 0 = domingo, 6 = sábado
}

// Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher) → base dos feriados móveis.
function domingoDePascoa(ano: number): ISODate {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/**
 * Feriados nacionais do ano (conjunto de 'YYYY-MM-DD'): fixos (config) +
 * móveis forenses derivados da Páscoa (Carnaval seg/ter, Sexta-feira Santa,
 * Corpus Christi). Centralizado aqui — único lugar que conhece a regra.
 */
export function feriadosNacionais(ano: number): Set<ISODate> {
  const set = new Set<ISODate>();
  for (const mmdd of FERIADOS_FIXOS) set.add(`${ano}-${mmdd}`);
  const pascoa = domingoDePascoa(ano);
  set.add(addDias(pascoa, -48)); // Carnaval (segunda)
  set.add(addDias(pascoa, -47)); // Carnaval (terça)
  set.add(addDias(pascoa, -2)); // Sexta-feira Santa
  set.add(addDias(pascoa, 60)); // Corpus Christi
  return set;
}

/** Verdadeiro se `d` é dia útil (não é fim de semana nem feriado nacional). */
export function ehDiaUtil(d: ISODate): boolean {
  const dow = diaDaSemana(d);
  if (dow === 0 || dow === 6) return false;
  return !feriadosNacionais(Number(d.slice(0, 4))).has(d);
}

/** O próprio dia se útil; senão o próximo dia útil. */
export function proximoDiaUtil(d: ISODate): ISODate {
  let cur = d;
  while (!ehDiaUtil(cur)) cur = addDias(cur, 1);
  return cur;
}

/**
 * Data que fica `dias` dias úteis a partir de `inicio`, contando o próprio
 * `inicio` como o 1º dia (se útil). Pula fins de semana e feriados.
 */
export function adicionarDiasUteis(inicio: ISODate, dias: number): ISODate {
  let cur = proximoDiaUtil(inicio);
  let contados = 1;
  while (contados < dias) {
    cur = proximoDiaUtil(addDias(cur, 1));
    contados++;
  }
  return cur;
}

/**
 * Calcula o prazo processual em dias úteis a partir da publicação/intimação.
 * CPC: exclui o dia da publicação; a contagem inicia no 1º dia útil seguinte;
 * a data fatal é o `diasUteis`-ésimo dia útil (sempre dia útil).
 */
export function calcularPrazo(
  publicacao: ISODate,
  diasUteis: number,
): { inicio: ISODate; dataFatal: ISODate } {
  if (!Number.isInteger(diasUteis) || diasUteis < 1) {
    throw new Error("diasUteis deve ser um inteiro >= 1");
  }
  const inicio = proximoDiaUtil(addDias(publicacao, 1));
  const dataFatal = adicionarDiasUteis(inicio, diasUteis);
  return { inicio, dataFatal };
}
