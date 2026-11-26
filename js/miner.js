// Motor de minería de estrategias de Pulso. SOLO SIMULACIÓN: no opera ni da asesoría.
// Prueba combinaciones de parámetros sobre velas históricas de Binance y se queda con las que
// ganan dentro y fuera de muestra, aguantan costos, caídas y pequeños cambios de parámetros.
import { SYMBOLS } from './market.js';

const REST = ['https://data-api.binance.vision', 'https://api.binance.com'];
const STEP_MS = { '1d': 86400000, '4h': 14400000 };
export const MINER_TFS = { '1d': '1 día', '4h': '4 horas' };
export const RULES = { fee: 0.001, slip: 0.0005, minTrades: 15, minOosTrades: 4, maxDD: 0.55, minPF: 1.1, robustMin: 0.7, costMult: 3, oosShare: 0.3 };

// ---------- datos ----------
async function klines(symbol, tf, startTime, limit) {
  for (const base of REST) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(`${base}/api/v3/klines?symbol=${symbol}&interval=${tf}&startTime=${startTime}&limit=${limit}`, { signal: ctrl.signal });
      clearTimeout(t);
      if (res.ok) return await res.json();
    } catch { /* probar el siguiente servidor */ }
  }
  throw new Error('No se pudieron descargar velas reales de Binance.');
}
const toCandle = (r) => ({ time: Math.floor(r[0] / 1000), open: +r[1], high: +r[2], low: +r[3], close: +r[4], volume: +r[5] });

export async function fetchHistory(symbol, tf = '1d', years = 5, onProgress) {
  const end = Date.now(), start = end - years * 365 * 86400000, step = STEP_MS[tf];
  const out = [];
  let t = start;
  while (t < end) {
    const rows = await klines(symbol, tf, t, 1000);
    if (!rows.length) break;
    for (const r of rows) out.push(toCandle(r));
    t = rows[rows.length - 1][0] + step;
    onProgress?.(Math.min(1, (t - start) / (end - start)));
    if (rows.length < 1000) break;
  }
  if (out.length < 300) throw new Error('Hay muy pocas velas para minar este activo.');
  return out;
}
export async function fetchRecent(symbol, tf, n = 700) {
  const rows = await klines(symbol, tf, Date.now() - n * STEP_MS[tf], 1000);
  return rows.map(toCandle);
}

// ---------- indicadores (con caché por serie) ----------
function smaArr(c, n) {
  const o = new Float64Array(c.length).fill(NaN); let s = 0;
  for (let i = 0; i < c.length; i++) { s += c[i]; if (i >= n) s -= c[i - n]; if (i >= n - 1) o[i] = s / n; }
  return o;
}
function rsiArr(c, n) {
  const o = new Float64Array(c.length).fill(NaN);
  let g = 0, l = 0;
  for (let i = 1; i < c.length; i++) {
    const d = c[i] - c[i - 1], up = Math.max(d, 0), dn = Math.max(-d, 0);
    if (i <= n) { g += up / n; l += dn / n; } else { g = (g * (n - 1) + up) / n; l = (l * (n - 1) + dn) / n; }
    if (i >= n) o[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
  }
  return o;
}
function rollArr(v, n, pick) { // máximo o mínimo de las n velas anteriores
  const o = new Float64Array(v.length).fill(NaN);
  for (let i = n; i < v.length; i++) { let m = v[i - n]; for (let j = i - n + 1; j < i; j++) m = pick(m, v[j]); o[i] = m; }
  return o;
}
const memo = (cache, key, fn) => cache.get(key) ?? (cache.set(key, fn()), cache.get(key));

// ---------- familias de estrategias ----------
export const FAMILIES = {
  cruce: {
    name: 'Cruce de medias', space: { f: [5, 50], s: [20, 200] }, valid: (p) => p.f < p.s - 4,
    label: (p) => `MM${p.f} cruza MM${p.s}`,
    rule: (p) => `Compra cuando la media de ${p.f} velas supera a la de ${p.s}; sale cuando baja de ella.`,
    pos(p, d, k) {
      const f = memo(k, `s${p.f}`, () => smaArr(d.close, p.f)), s = memo(k, `s${p.s}`, () => smaArr(d.close, p.s));
      const o = new Int8Array(d.n); for (let i = 0; i < d.n; i++) o[i] = f[i] > s[i] ? 1 : 0; return o;
    },
  },
  rsi: {
    name: 'RSI de rebote', space: { n: [5, 25], lo: [15, 40], hi: [50, 80] }, valid: (p) => p.hi > p.lo + 10,
    label: (p) => `RSI${p.n} ${p.lo}/${p.hi}`,
    rule: (p) => `Compra cuando el RSI de ${p.n} velas cae bajo ${p.lo}; sale cuando sube sobre ${p.hi}.`,
    pos(p, d, k) {
      const r = memo(k, `r${p.n}`, () => rsiArr(d.close, p.n)), o = new Int8Array(d.n); let on = 0;
      for (let i = 0; i < d.n; i++) { if (!on && r[i] < p.lo) on = 1; else if (on && r[i] > p.hi) on = 0; o[i] = on; }
      return o;
    },
  },
  canal: {
    name: 'Ruptura de canal', space: { n: [10, 120], m: [5, 60] }, valid: (p) => p.m < p.n,
    label: (p) => `Canal ${p.n}/${p.m}`,
    rule: (p) => `Compra al superar el máximo de ${p.n} velas; sale al perder el mínimo de ${p.m} velas.`,
    pos(p, d, k) {
      const up = memo(k, `h${p.n}`, () => rollArr(d.high, p.n, Math.max)), dn = memo(k, `l${p.m}`, () => rollArr(d.low, p.m, Math.min));
      const o = new Int8Array(d.n); let on = 0;
      for (let i = 0; i < d.n; i++) { if (!on && d.close[i] > up[i]) on = 1; else if (on && d.close[i] < dn[i]) on = 0; o[i] = on; }
      return o;
    },
  },
};

export function prepare(candles) {
  const n = candles.length;
  return { n, time: candles.map((c) => c.time), open: candles.map((c) => c.open), high: candles.map((c) => c.high), low: candles.map((c) => c.low), close: candles.map((c) => c.close) };
}

// ---------- backtest ----------
// Solo posiciones largas. Se decide al cierre de la vela i y se ejecuta en la apertura de i+1.
export function backtest(d, pos, a, b, costMult = 1) {
  const cost = (RULES.fee + RULES.slip) * costMult;
  let eq = 1, peak = 1, dd = 0, inPos = false, entry = 1, trades = 0, wins = 0, gP = 0, gL = 0;
  const curve = [1];
  const close = (e) => { const r = e / entry - 1; trades++; if (r > 0) { wins++; gP += r; } else gL -= r; };
  for (let i = Math.max(a, 1); i < b; i++) {
    const want = pos[i - 1] === 1;
    if (want) {
      if (!inPos) { eq *= 1 - cost; entry = eq; inPos = true; eq *= d.close[i] / d.open[i]; }
      else eq *= d.close[i] / d.close[i - 1];
    } else if (inPos) { eq *= d.open[i] / d.close[i - 1]; eq *= 1 - cost; close(eq); inPos = false; }
    peak = Math.max(peak, eq); dd = Math.max(dd, 1 - eq / peak);
    curve.push(eq);
  }
  if (inPos) close(eq);
  const hold = d.close[b - 1] / d.close[Math.max(a, 1) - 1] - 1;
  return { ret: eq - 1, dd, trades, wins, winRate: trades ? wins / trades : 0, pf: gL > 0 ? gP / gL : gP > 0 ? 9.99 : 0, hold, curve };
}

// ---------- vecindad de parámetros ----------
function inSpace(fam, p) { return Object.entries(fam.space).every(([k, [lo, hi]]) => p[k] >= lo && p[k] <= hi) && fam.valid(p); }
function neighbors(fam, p, rnd, max = 8) {
  const keys = Object.keys(p), out = [];
  const combos = keys.reduce((acc, k) => acc.flatMap((c) => [-1, 0, 1].map((s) => [...c, s])), [[]]);
  for (const c of combos) {
    if (c.every((s) => s === 0)) continue;
    const q = { ...p };
    keys.forEach((k, i) => { q[k] = p[k] + c[i] * Math.max(1, Math.round(p[k] * 0.2)); });
    if (inSpace(fam, q)) out.push(q);
  }
  return out.sort(() => rnd() - 0.5).slice(0, max);
}
function mulberry(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function sample(fam, rnd) {
  for (let k = 0; k < 40; k++) {
    const p = {};
    for (const [key, [lo, hi]] of Object.entries(fam.space)) p[key] = lo + Math.floor(rnd() * (hi - lo + 1));
    if (fam.valid(p)) return p;
  }
  return null;
}

// ---------- minería ----------
export async function mine({ symbol, tf = '1d', years = 5, tests = 600, families = Object.keys(FAMILIES), onProgress, signal, seed = Date.now() }) {
  onProgress?.({ phase: 'datos', ratio: 0 });
  const candles = await fetchHistory(symbol, tf, years, (ratio) => onProgress?.({ phase: 'datos', ratio }));
  const d = prepare(candles), cache = new Map(), rnd = mulberry(seed);
  const warm = Math.min(210, Math.floor(d.n * 0.12)), split = Math.floor(warm + (d.n - warm) * (1 - RULES.oosShare));
  const funnel = { tested: 0, muestra: 0, caida: 0, robusta: 0, costos: 0 };
  const seen = new Set(), found = [];
  const pass = (m, minT) => m.trades >= minT && m.ret > 0 && m.pf >= RULES.minPF;
  for (let t = 0; t < tests; t++) {
    if (signal?.aborted) break;
    const famKey = families[t % families.length], fam = FAMILIES[famKey], p = sample(fam, rnd);
    if (!p) continue;
    const id = famKey + JSON.stringify(p);
    if (seen.has(id)) continue;
    seen.add(id);
    funnel.tested++;
    const pos = fam.pos(p, d, cache);
    const is = backtest(d, pos, warm, split), oos = backtest(d, pos, split, d.n);
    if (pass(is, Math.ceil(RULES.minTrades * 0.6)) && pass(oos, RULES.minOosTrades) && is.trades + oos.trades >= RULES.minTrades) {
      funnel.muestra++;
      const full = backtest(d, pos, warm, d.n);
      if (full.dd <= RULES.maxDD) {
        funnel.caida++;
        const near = neighbors(fam, p, rnd);
        const good = near.filter((q) => { const m = backtest(d, fam.pos(q, d, cache), warm, d.n); return m.ret > 0 && m.pf > 1.05; }).length;
        const robust = near.length >= 4 ? good / near.length : 0;
        if (robust >= RULES.robustMin) {
          funnel.robusta++;
          if (backtest(d, pos, warm, d.n, RULES.costMult).ret > 0) {
            funnel.costos++;
            found.push({ fam: famKey, params: p, robust, is: strip(is), oos: strip(oos), full: strip(full), score: oos.ret / Math.max(0.05, full.dd), curve: full.curve });
          }
        }
      }
    }
    if (t % 20 === 0) { onProgress?.({ phase: 'prueba', ratio: t / tests, funnel: { ...funnel } }); await new Promise((r) => setTimeout(r)); }
  }
  found.sort((x, y) => y.score - x.score);
  onProgress?.({ phase: 'fin', ratio: 1, funnel: { ...funnel } });
  return {
    symbol, tf, years, bars: d.n, funnel, survivors: found.slice(0, 12), splitIndex: split - warm,
    from: candles[warm].time, to: candles[d.n - 1].time, splitTime: candles[split].time,
  };
}
const strip = ({ curve, ...m }) => m;

// ---------- señales e incubadora ----------
export function signalNow(s, candles) {
  const d = prepare(candles), pos = FAMILIES[s.fam].pos(s.params, d, new Map());
  const last = pos[d.n - 1] === 1; let i = d.n - 1;
  while (i > 0 && pos[i - 1] === pos[d.n - 1]) i--;
  return { inPosition: last, since: d.time[i], price: d.close[d.n - 1] };
}
export function paperTest(s, candles) {
  const d = prepare(candles), pos = FAMILIES[s.fam].pos(s.params, d, new Map());
  const a = d.time.findIndex((t) => t >= s.since);
  if (a < 1) return { ret: 0, dd: 0, trades: 0, pf: 0, days: 0 };
  const m = backtest(d, pos, a, d.n);
  return { ...m, curve: undefined, days: Math.round((d.time[d.n - 1] - s.since) / 86400) };
}
export function examStatus(m) {
  if (m.days >= 30 && m.trades >= 2) return m.dd > 0.25 || m.ret < 0 ? 'reprobada' : 'aprobada';
  return m.days >= 120 ? 'reprobada' : 'en examen';
}
export async function refreshIncubator(list) {
  const cache = new Map(), out = [];
  for (const s of list) {
    try {
      const key = `${s.symbol}:${s.tf}`;
      if (!cache.has(key)) cache.set(key, await fetchRecent(s.symbol, s.tf));
      const candles = cache.get(key), paper = paperTest(s, candles);
      out.push({ ...s, signal: signalNow(s, candles), paper, status: examStatus(paper) });
    } catch { out.push({ ...s, signal: null, paper: null, status: 'sin datos' }); }
  }
  return out;
}

// ---------- almacenamiento (misma cuenta local que Pulso) ----------
const KEY = 'pulso:miner:v1';
export function loadMiner() {
  try { const v = JSON.parse(localStorage.getItem(KEY)); if (v && Array.isArray(v.strategies)) return v; } catch { /* vacío */ }
  return { strategies: [], lastRun: null };
}
export function saveMiner(state) { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* sin almacenamiento */ } }
export function addToIncubator(result, survivor) {
  const st = loadMiner();
  const id = `${result.symbol}-${result.tf}-${survivor.fam}-${Object.values(survivor.params).join('-')}`;
  if (st.strategies.some((s) => s.id === id)) return false;
  st.strategies.unshift({ id, symbol: result.symbol, tf: result.tf, fam: survivor.fam, params: survivor.params, since: Math.floor(Date.now() / 1000), minedAt: Date.now(), is: survivor.is, oos: survivor.oos, full: survivor.full, robust: survivor.robust });
  st.strategies = st.strategies.slice(0, 40);
  saveMiner(st);
  return true;
}
export const strategyName = (s) => `${SYMBOLS[s.symbol]?.short ?? s.symbol} · ${FAMILIES[s.fam].label(s.params)} · ${s.tf}`;
