// Datos de mercado reales (API pública de Binance, sin clave) + indicadores.
// Si la API no responde, cae a datos simulados y lo indica en `market.status`.

export const SYMBOLS = {
  BTCUSDT: { name: 'BTC/USDT', short: 'BTC', dec: 0 },
  ETHUSDT: { name: 'ETH/USDT', short: 'ETH', dec: 1 },
  SOLUSDT: { name: 'SOL/USDT', short: 'SOL', dec: 2 },
  PAXGUSDT: { name: 'Oro · PAXG/USDT', short: 'ORO', dec: 1 },
};

export const TIMEFRAMES = { '15m': '15 min', '1h': '1 h', '4h': '4 h', '1d': '1 D' };

const REST = ['https://data-api.binance.vision', 'https://api.binance.com'];
const WS = ['wss://data-stream.binance.vision/stream', 'wss://stream.binance.com:9443/stream'];

const listeners = new Set();
export const market = {
  prices: {},      // símbolo -> último precio
  change: {},      // símbolo -> % 24 h
  status: 'conectando', // 'en vivo' | 'simulado' | 'conectando'
  lastTick: 0,
  on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  emit(type, data) { listeners.forEach((fn) => { try { fn(type, data); } catch (e) { console.error(e); } }); },
};

// ---------- formato ----------
export function fmt(symbol, v) {
  if (v == null || Number.isNaN(v)) return '—';
  const dec = SYMBOLS[symbol]?.dec ?? 2;
  return Number(v).toLocaleString('es-CL', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
export const fmtNum = (v, d = 2) => (v == null || Number.isNaN(v) ? '—' : Number(v).toLocaleString('es-CL', { minimumFractionDigits: d, maximumFractionDigits: d }));

// ---------- velas ----------
const cache = new Map(); // `${sym}:${tf}` -> {at, candles}

export async function getCandles(symbol, tf = '1h', limit = 300) {
  const key = `${symbol}:${tf}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 20000) return hit.candles;
  for (const base of REST) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 6000);
      const res = await fetch(`${base}/api/v3/klines?symbol=${symbol}&interval=${tf}&limit=${limit}`, { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) continue;
      const rows = await res.json();
      const candles = rows.map((r) => ({ time: Math.floor(r[0] / 1000), open: +r[1], high: +r[2], low: +r[3], close: +r[4], volume: +r[5] }));
      cache.set(key, { at: Date.now(), candles, live: true });
      return candles;
    } catch { /* probar siguiente */ }
  }
  const candles = simulateCandles(symbol, tf, limit);
  cache.set(key, { at: Date.now(), candles, live: false });
  return candles;
}

const BASE_PRICE = { BTCUSDT: 64000, ETHUSDT: 3200, SOLUSDT: 150, PAXGUSDT: 2400 };
const TF_SEC = { '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400 };

function simulateCandles(symbol, tf, n) {
  let seed = [...symbol + tf].reduce((a, c) => a + c.charCodeAt(0), 0);
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const step = TF_SEC[tf] || 3600;
  const now = Math.floor(Date.now() / 1000 / step) * step;
  let p = market.prices[symbol] || BASE_PRICE[symbol] || 100;
  const vol = p * 0.006 * Math.sqrt(step / 3600);
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const o = p;
    const c = o + (rnd() - 0.5) * vol * 2 + Math.sin(i / 18) * vol * 0.3;
    const h = Math.max(o, c) + rnd() * vol * 0.6;
    const l = Math.min(o, c) - rnd() * vol * 0.6;
    out.push({ time: now - i * step, open: o, high: h, low: l, close: c, volume: rnd() * 100 });
    p = c;
  }
  return out;
}

// ---------- ticker en vivo ----------
let ws = null;
let simTimer = null;

export function startTicker() {
  const syms = Object.keys(SYMBOLS);
  // precios iniciales por REST (24 h)
  (async () => {
    for (const base of REST) {
      try {
        const res = await fetch(`${base}/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(syms))}`);
        if (!res.ok) continue;
        const rows = await res.json();
        rows.forEach((r) => { market.prices[r.symbol] = +r.lastPrice; market.change[r.symbol] = +r.priceChangePercent; });
        market.emit('tick', {});
        return;
      } catch { /* siguiente */ }
    }
  })();
  connectWs(0);
}

function connectWs(i) {
  if (i >= WS.length) return startSim();
  const streams = Object.keys(SYMBOLS).map((s) => `${s.toLowerCase()}@miniTicker`).join('/');
  let opened = false;
  try {
    ws = new WebSocket(`${WS[i]}?streams=${streams}`);
  } catch { return connectWs(i + 1); }
  const failT = setTimeout(() => { if (!opened) { try { ws.close(); } catch {} } }, 7000);
  ws.onopen = () => { opened = true; clearTimeout(failT); setStatus('en vivo'); };
  ws.onmessage = (ev) => {
    const d = JSON.parse(ev.data)?.data;
    if (!d?.s) return;
    const prev = market.prices[d.s];
    market.prices[d.s] = +d.c;
    market.change[d.s] = ((+d.c - +d.o) / +d.o) * 100;
    market.lastTick = Date.now();
    market.emit('tick', { symbol: d.s, price: +d.c, prev });
  };
  ws.onclose = () => {
    clearTimeout(failT);
    if (!opened) return connectWs(i + 1);
    setStatus('conectando');
    setTimeout(() => connectWs(0), 3000);
  };
  ws.onerror = () => {};
}

function startSim() {
  setStatus('simulado');
  if (simTimer) return;
  Object.keys(SYMBOLS).forEach((s) => { market.prices[s] ??= BASE_PRICE[s]; market.change[s] ??= 0; });
  simTimer = setInterval(() => {
    for (const s of Object.keys(SYMBOLS)) {
      const prev = market.prices[s];
      const next = prev * (1 + (Math.random() - 0.5) * 0.0016);
      market.prices[s] = next;
      market.change[s] += ((next - prev) / prev) * 100;
      market.emit('tick', { symbol: s, price: next, prev });
    }
    market.lastTick = Date.now();
  }, 1500);
}

function setStatus(s) { market.status = s; market.emit('status', s); }

// ---------- indicadores ----------
export function sma(values, n) {
  const out = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= n) sum -= values[i - n];
    if (i >= n - 1) out[i] = sum / n;
  }
  return out;
}

export function rsi(closes, n = 14) {
  const out = new Array(closes.length).fill(null);
  if (closes.length <= n) return out;
  let gain = 0, loss = 0;
  for (let i = 1; i <= n; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gain += d; else loss -= d;
  }
  gain /= n; loss /= n;
  out[n] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  for (let i = n + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    gain = (gain * (n - 1) + Math.max(d, 0)) / n;
    loss = (loss * (n - 1) + Math.max(-d, 0)) / n;
    out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  }
  return out;
}

export function atr(c, n = 14) {
  const tr = c.map((k, i) => (i === 0 ? k.high - k.low : Math.max(k.high - k.low, Math.abs(k.high - c[i - 1].close), Math.abs(k.low - c[i - 1].close))));
  const out = new Array(c.length).fill(null);
  let a = tr.slice(0, n).reduce((x, y) => x + y, 0) / n;
  out[n - 1] = a;
  for (let i = n; i < c.length; i++) { a = (a * (n - 1) + tr[i]) / n; out[i] = a; }
  return out;
}

// Máximos y mínimos de giro (fractales de `w` velas a cada lado).
function swings(c, w = 4, lookback = 160) {
  const start = Math.max(w, c.length - lookback);
  const highs = [], lows = [];
  for (let i = start; i < c.length - w; i++) {
    let isH = true, isL = true;
    for (let j = 1; j <= w; j++) {
      if (c[i].high <= c[i - j].high || c[i].high < c[i + j].high) isH = false;
      if (c[i].low >= c[i - j].low || c[i].low > c[i + j].low) isL = false;
    }
    if (isH) highs.push(c[i].high);
    if (isL) lows.push(c[i].low);
  }
  return { highs, lows };
}

// Agrupa niveles cercanos (menos de `tol`) en uno solo.
function cluster(levels, tol) {
  const s = [...levels].sort((a, b) => a - b);
  const out = [];
  for (const v of s) {
    const last = out[out.length - 1];
    if (last && Math.abs(v - last.v) < tol) { last.v = (last.v * last.n + v) / (last.n + 1); last.n++; }
    else out.push({ v, n: 1 });
  }
  return out.map((x) => x.v);
}

export function analyze(candles) {
  const closes = candles.map((c) => c.close);
  const price = closes[closes.length - 1];
  const s50 = sma(closes, 50), s200 = sma(closes, 200);
  const r = rsi(closes, 14);
  const a = atr(candles, 14);
  const last = closes.length - 1;
  const A = a[last] || price * 0.01;
  const m50 = s50[last], m200 = s200[last];

  let trend = 'lateral';
  if (m50 && m200) {
    if (price > m50 && m50 > m200) trend = 'alcista';
    else if (price < m50 && m50 < m200) trend = 'bajista';
  } else if (m50) trend = price > m50 ? 'alcista' : 'bajista';

  const { highs, lows } = swings(candles);
  const all = cluster([...highs, ...lows], A * 0.6);
  const above = all.filter((v) => v > price + A * 0.15).sort((x, y) => x - y);
  const below = all.filter((v) => v < price - A * 0.15).sort((x, y) => y - x);
  const recent = candles.slice(-60);
  const r1 = above[0] ?? Math.max(...recent.map((c) => c.high));
  const r2 = above[1] ?? r1 + A * 2;
  const s1 = below[0] ?? Math.min(...recent.map((c) => c.low));
  const s2 = below[1] ?? s1 - A * 2;

  const bull = { entry: r1 + A * 0.1, stop: r1 - A, target: r2 };
  if (bull.target - bull.entry < A) bull.target = bull.entry + A * 2;
  const bear = { entry: s1 - A * 0.1, stop: s1 + A, target: s2 };
  if (bear.entry - bear.target < A) bear.target = bear.entry - A * 2;

  const rsiNow = r[last];
  const rsiTxt = rsiNow == null ? '' : rsiNow > 70 ? 'en sobrecompra' : rsiNow < 30 ? 'en sobreventa' : 'en zona neutral';
  const crossUp = m50 && m200 && s50[last - 1] < s200[last - 1] && m50 >= m200;
  const crossDown = m50 && m200 && s50[last - 1] > s200[last - 1] && m50 <= m200;

  return {
    price, trend, rsi: rsiNow, rsiTxt, atr: A, sma50: m50, sma200: m200,
    levels: { r1, r2, s1, s2 }, bull, bear,
    series: { s50, s200, rsi: r },
    cross: crossUp ? 'golden' : crossDown ? 'death' : null,
  };
}
