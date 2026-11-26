// Edificio 2: Laboratorio Pulso. Mina estrategias con datos reales, las incuba en simulación
// y las pasa a los agentes (Riesgos, Quant, Dirección). Todo es simulación, sin operaciones reales.
import { SYMBOLS, getCandles, analyze, fmt, fmtNum, market } from './market.js';
import { AGENDA } from './data.js';
import { store } from './store.js';
import {
  FAMILIES, MINER_TFS, RULES, mine, addToIncubator, loadMiner, saveMiner, refreshIncubator, strategyName,
} from './miner.js';

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = (v, d = 1) => `${v >= 0 ? '+' : '−'}${fmtNum(Math.abs(v) * 100, d)} %`;
const isOwner = () => store.role === 'dueno';
const P = (v) => +(v * 100).toFixed(2);

const ROOMS = [
  { id: 'sala', name: 'Sala de traders', icon: '◧', blurb: 'Los agentes conversan con datos reales' },
  { id: 'mineria', name: 'Minería', icon: '⛏', blurb: 'Busca estrategias con 5 años de velas' },
  { id: 'incubadora', name: 'Incubadora', icon: '◔', blurb: 'Examen en simulación antes de dar capital' },
  { id: 'ranking', name: 'Ranking', icon: '▤', blurb: 'Las mejores estrategias del laboratorio' },
  { id: 'comite', name: 'Dirección y comité', icon: '◈', blurb: 'La directora reúne a todos los equipos' },
  { id: 'riesgos', name: 'Riesgos', icon: '◍', blurb: 'Reglas que bloquean lo inseguro' },
  { id: 'mercado', name: 'Macro y análisis', icon: '◭', blurb: 'Lectura del mercado y agenda' },
  { id: 'conexiones', name: 'Conexiones', icon: '⌁', blurb: 'Qué está activo y qué falta' },
];
const AGENTS = [
  { id: 'dir', name: 'Directora', role: 'Dirección', color: '#d9bf8c' },
  { id: 'rie', name: 'Riesgos', role: 'Departamento de riesgos', color: '#f06272' },
  { id: 'mac', name: 'Macro', role: 'Economista macro', color: '#8a9bb5' },
  { id: 'ana', name: 'Análisis', role: 'Analista de mercado', color: '#4fd1a1' },
  { id: 'min', name: 'Minero', role: 'Minería de estrategias', color: '#d9a35f' },
  { id: 'qua', name: 'Quant', role: 'Reparto por riesgo', color: '#a0b4d2' },
];
const agent = (id) => AGENTS.find((a) => a.id === id);

let root = null, current = 'sala', feed = [], timer = null, running = null, lastResult = null, incubated = [], onSay = null;

// Panel del laboratorio: se abre desde los quioscos y los agentes de la oficina 3D.
export function renderLabPanel(body, id = 'sala') {
  root = body; current = ROOMS.some((r) => r.id === id) ? id : 'sala';
  body.innerHTML = `<nav class="lab-tabs" id="labTabs" aria-label="Salas del laboratorio">${ROOMS.map((r) => `<button type="button" class="chip" data-room="${r.id}" aria-pressed="false">${r.name}</button>`).join('')}</nav><section class="lab-main" id="labMain" aria-live="polite"></section>
    <p class="lab-foot">Simulación educativa. Ganar en el pasado no garantiza ganar en el futuro y nada de esto es asesoría financiera. No se ejecutan operaciones.</p>`;
  body.querySelectorAll('[data-room]').forEach((b) => b.addEventListener('click', () => show(b.dataset.room)));
  show(current);
  return () => { if (root === body) { running?.abort(); root = null; } };
}
function show(id) {
  current = id;
  root.querySelectorAll('[data-room]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.room === id)));
  const main = $('#labMain', root);
  ({ sala: viewSala, mineria: viewMineria, incubadora: viewIncubadora, ranking: viewRanking, comite: viewComite, riesgos: viewRiesgos, mercado: viewMercado, conexiones: viewConexiones }[id])(main);
}
export const labAgents = () => AGENTS;
export const feedFor = (id) => feed.filter((m) => m.id === id).slice(0, 6);

// Datos para la pantalla grande del laboratorio (precios reales y estado de la incubadora)
let boardCache = { at: 0, strategies: [] };
export async function labBoardData() {
  if (Date.now() - boardCache.at > 60000) {
    boardCache.at = Date.now();
    const list = await refreshIncubator(loadMiner().strategies).catch(() => []);
    boardCache.strategies = list.map((s) => ({ name: strategyName(s), status: (STATUS[s.status] || STATUS['sin datos'])[0], inPosition: Boolean(s.signal?.inPosition) }));
  }
  return { live: market.status === 'en vivo', prices: Object.entries(SYMBOLS).map(([k, v]) => ({ name: v.short, price: fmt(k, market.prices[k]), change: market.change[k] ?? 0 })), strategies: boardCache.strategies };
}

// ---------- sala: agentes conversando ----------
function say(id, text) {
  feed.unshift({ t: new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' }), id, text });
  feed.length = Math.min(feed.length, 60);
  onSay?.(id, text);
  if (root && current === 'sala') paintFeed();
}
function paintFeed() {
  const el = $('#labFeed', root); if (!el) return;
  el.innerHTML = feed.map((m) => { const a = agent(m.id); return `<div class="lab-msg"><span class="mono muted">${m.t}</span><b style="color:${a.color}">${a.name}</b><span>${esc(m.text)}</span></div>`; }).join('') || '<p class="muted">Los agentes están calentando motores…</p>';
}
async function tick() {
  const strategies = loadMiner().strategies;
  const sym = Object.keys(SYMBOLS)[Math.floor(Math.random() * 4)], p = market.prices[sym], ch = market.change[sym];
  const roll = Math.random();
  try {
    if (roll < 0.28 && p) {
      const a = analyze(await getCandles(sym, '1d'));
      say('ana', `${SYMBOLS[sym].short}: tendencia ${a.trend}, RSI ${a.rsi?.toFixed(0) ?? '—'}. Resistencia ${fmt(sym, a.levels.r1)}, soporte ${fmt(sym, a.levels.s1)}.`);
    } else if (roll < 0.45 && Number.isFinite(ch)) {
      say('mac', `${SYMBOLS[sym].short} ${pct(ch / 100, 2)} en 24 h. ${Math.abs(ch) > 3 ? 'Movimiento fuerte: conviene revisar el riesgo.' : 'Mercado tranquilo, sin sorpresas.'} Evento clave de hoy: ${AGENDA[0].time} ${AGENDA[0].title}.`);
    } else if (roll < 0.62) {
      say('rie', strategies.length ? `Reviso ${strategies.length} estrategia(s) en incubadora: límite de caída ${P(RULES.maxDD)} %, costos x${RULES.costMult} y robustez ≥ ${P(RULES.robustMin)} % siguen siendo condición para pasar.` : 'No hay estrategias para revisar. Que el minero me traiga candidatas.');
    } else if (roll < 0.8) {
      const s = strategies[Math.floor(Math.random() * strategies.length)];
      say('min', s ? `Mi candidata ${strategyName(s)}: robustez ${(s.robust * 100).toFixed(0)} %, fuera de muestra ${pct(s.oos.ret)}.` : 'Sin estrategias guardadas todavía. Abre la sala de Minería y ponme a trabajar.');
    } else {
      say('qua', strategies.length ? `Repartiría el capital simulado en partes iguales entre ${Math.min(strategies.length, 5)} estrategia(s), nunca más de una por activo y marco temporal.` : 'Cuando haya estrategias aprobadas las reparto por riesgo.');
    }
  } catch { /* sin conexión: el siguiente intento lo cubre */ }
}
export function startLabFeed(cb) {
  onSay = cb; clearInterval(timer);
  say('dir', 'Bienvenidos al laboratorio. Hoy minamos, incubamos y solo lo robusto pasa al examen.');
  timer = setInterval(tick, 7000);
  setTimeout(tick, 1500);
}
export function stopLabFeed() { clearInterval(timer); timer = null; onSay = null; }
function viewSala(main) {
  main.innerHTML = `<div class="lab-head"><h2>Sala de traders</h2><button class="btn sm primary" id="labCom" type="button">Convocar comité</button></div>
    <div class="lab-agents">${AGENTS.map((a) => `<span class="lab-agent" style="--c:${a.color}"><i></i><b>${a.name}</b><small>${a.role}</small></span>`).join('')}</div>
    <div class="lab-feed" id="labFeed" role="log" aria-label="Conversación de los agentes"></div>`;
  paintFeed();
  $('#labCom', main).addEventListener('click', () => show('comite'));
}

// ---------- minería ----------
function viewMineria(main) {
  const symOpts = Object.entries(SYMBOLS).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join('');
  main.innerHTML = `<div class="lab-head"><h2>Minería de estrategias</h2></div>
    <form class="lab-form" id="mineF">
      <label>Activo<select name="symbol">${symOpts}</select></label>
      <label>Velas<select name="tf">${Object.entries(MINER_TFS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
      <label>Historia<select name="years"><option value="5">5 años</option><option value="3">3 años</option><option value="2">2 años</option></select></label>
      <label>Pruebas<select name="tests"><option value="600">600</option><option value="1500" selected>1.500</option><option value="3000">3.000</option></select></label>
      <fieldset><legend>Familias</legend>${Object.entries(FAMILIES).map(([k, f]) => `<label class="chk"><input type="checkbox" name="fam" value="${k}" checked>${f.name}</label>`).join('')}</fieldset>
      <button class="btn primary" id="mineGo" type="submit">Empezar minería</button>
      <button class="btn" id="mineStop" type="button" hidden>Detener</button>
    </form>
    <p class="muted lab-note">Divide la historia en 70 % de entrenamiento y 30 % fuera de muestra. Solo conserva lo que gana en ambas partes, no cae más de ${P(RULES.maxDD)} %, sigue ganando con costos x${RULES.costMult} y con parámetros vecinos distintos.</p>
    <div id="mineOut"></div>`;
  const f = $('#mineF', main);
  f.addEventListener('submit', (e) => { e.preventDefault(); runMining(f); });
  $('#mineStop', main).addEventListener('click', () => running?.abort());
  if (lastResult) paintResult(lastResult);
}
function funnelHtml(fn) {
  const steps = [['Probadas', fn.tested], ['Ganan en entrenamiento y fuera de muestra', fn.muestra], [`Caída máxima ≤ ${P(RULES.maxDD)} %`, fn.caida], ['Robustas a cambios de parámetros', fn.robusta], [`Aguantan costos x${RULES.costMult}`, fn.costos]];
  const top = Math.max(1, fn.tested);
  return `<div class="lab-funnel">${steps.map(([l, n]) => `<div><span>${l}</span><div class="bar"><i style="width:${Math.max(n ? 2 : 0, (n / top) * 100)}%"></i></div><b>${n}</b></div>`).join('')}</div>`;
}
async function runMining(form) {
  const fd = new FormData(form), fams = fd.getAll('fam');
  const out = $('#mineOut', root);
  if (!fams.length) { out.innerHTML = '<p class="warn-t">Elige al menos una familia de estrategias.</p>'; return; }
  running = new AbortController();
  $('#mineGo', root).disabled = true; $('#mineStop', root).hidden = false;
  try {
    const result = await mine({
      symbol: fd.get('symbol'), tf: fd.get('tf'), years: +fd.get('years'), tests: +fd.get('tests'), families: fams, signal: running.signal,
      onProgress: (p) => { out.innerHTML = `<p class="muted">${p.phase === 'datos' ? `Descargando velas reales… ${Math.round(p.ratio * 100)} %` : `Minando… ${Math.round(p.ratio * 100)} %`}</p>${p.funnel ? funnelHtml(p.funnel) : ''}`; },
    });
    lastResult = result;
    const st = loadMiner(); st.lastRun = { symbol: result.symbol, at: Date.now(), found: result.survivors.length }; saveMiner(st);
    say('min', `Terminé ${SYMBOLS[result.symbol].short} ${result.tf}: ${result.funnel.tested} pruebas, ${result.survivors.length} sobrevivientes.`);
    paintResult(result);
  } catch (e) {
    out.innerHTML = `<p class="warn-t">${esc(e.message || 'La minería falló.')} Revisa tu conexión e inténtalo de nuevo.</p>`;
  } finally {
    running = null;
    const go = $('#mineGo', root); if (go) go.disabled = false;
    const stop = $('#mineStop', root); if (stop) stop.hidden = true;
  }
}
function sparkline(curve, split) {
  const w = 220, h = 54, max = Math.max(...curve), min = Math.min(...curve), n = curve.length;
  const pts = curve.map((v, i) => `${((i / (n - 1)) * w).toFixed(1)},${(h - ((v - min) / (max - min || 1)) * (h - 4) - 2).toFixed(1)}`).join(' ');
  const sx = (split / (n - 1)) * w;
  return `<svg viewBox="0 0 ${w} ${h}" class="spark" role="img" aria-label="Curva de capital simulada"><line x1="${sx}" x2="${sx}" y1="0" y2="${h}" stroke="rgba(217,191,140,.5)" stroke-dasharray="3 3"/><polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="1.6"/></svg>`;
}
function paintResult(r) {
  const out = $('#mineOut', root); if (!out) return;
  const owner = isOwner();
  out.innerHTML = `<h3>${SYMBOLS[r.symbol].name} · ${r.tf} · ${r.bars} velas</h3>${funnelHtml(r.funnel)}
    ${r.survivors.length ? `<div class="lab-cards">${r.survivors.map((s, i) => `
      <article class="lab-card">
        <div class="row between"><b>${FAMILIES[s.fam].label(s.params)}</b><span class="tag-ok">Robustez ${(s.robust * 100).toFixed(0)} %</span></div>
        <p class="muted">${FAMILIES[s.fam].rule(s.params)}</p>
        ${sparkline(s.curve, r.splitIndex)}
        <dl><dt>Entrenamiento</dt><dd>${pct(s.is.ret)}</dd><dt>Fuera de muestra</dt><dd>${pct(s.oos.ret)}</dd><dt>Caída máx.</dt><dd>${fmtNum(s.full.dd * 100)} %</dd><dt>Operaciones</dt><dd>${s.full.trades} · ganadas ${fmtNum(s.full.winRate * 100, 0)} %</dd><dt>Factor de beneficio</dt><dd>${fmtNum(s.full.pf)}</dd><dt>Comprar y mantener</dt><dd>${pct(s.full.hold)}</dd></dl>
        <button class="btn sm primary" data-send="${i}" type="button" ${owner ? '' : 'disabled title="Solo el dueño envía a incubadora"'}>Enviar a incubadora</button>
      </article>`).join('')}</div>` : '<p class="muted">Ninguna estrategia pasó todos los filtros. Es un resultado normal: prueba más veces u otro activo.</p>'}`;
  out.querySelectorAll('[data-send]').forEach((b) => b.addEventListener('click', () => {
    const ok = addToIncubator(r, r.survivors[+b.dataset.send]);
    b.textContent = ok ? 'En incubadora ✓' : 'Ya estaba'; b.disabled = true;
    if (ok) say('qua', 'Nueva estrategia en incubadora. La vigilo en simulación antes de darle capital.');
  }));
}

// ---------- incubadora ----------
async function loadIncubated() { incubated = await refreshIncubator(loadMiner().strategies); return incubated; }
const STATUS = { 'en examen': ['Examen en curso', 'warn'], aprobada: ['Aprobada en simulación', 'ok'], reprobada: ['Reprobada', 'bad'], 'sin datos': ['Sin datos', 'warn'] };
function viewIncubadora(main) {
  main.innerHTML = `<div class="lab-head"><h2>Incubadora</h2></div>
    <p class="muted lab-note">Cada estrategia corre en simulación desde el día en que entra. Aprueba si tras 30 días y 2 operaciones gana y cae menos de 25 %. Con capital real no se opera aquí.</p><div id="incOut"><p class="muted">Consultando velas recientes…</p></div>`;
  loadIncubated().then(() => { if (current === 'incubadora') paintInc(); });
}
function paintInc() {
  const out = $('#incOut', root); if (!out) return;
  const owner = isOwner();
  out.innerHTML = incubated.length ? `<div class="lab-cards">${incubated.map((s) => {
    const [label, cls] = STATUS[s.status] || STATUS['sin datos'];
    return `<article class="lab-card"><div class="row between"><b>${esc(strategyName(s))}</b><span class="tag-${cls}">${label}</span></div>
      <p class="muted">${FAMILIES[s.fam].rule(s.params)}</p>
      <dl><dt>Señal ahora</dt><dd>${s.signal ? (s.signal.inPosition ? 'En posición (compra)' : 'Fuera del mercado') : '—'}</dd>
      <dt>Simulación en vivo</dt><dd>${s.paper ? `${pct(s.paper.ret)} · ${s.paper.trades} op. · ${s.paper.days} días` : '—'}</dd>
      <dt>Fuera de muestra (minería)</dt><dd>${pct(s.oos.ret)}</dd></dl>
      <button class="btn sm" data-del="${esc(s.id)}" type="button" ${owner ? '' : 'disabled'}>Quitar</button></article>`;
  }).join('')}</div>` : '<p class="muted">La incubadora está vacía. Mina estrategias y envía las mejores.</p>';
  out.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
    const st = loadMiner(); st.strategies = st.strategies.filter((x) => x.id !== b.dataset.del); saveMiner(st);
    incubated = incubated.filter((x) => x.id !== b.dataset.del); paintInc();
  }));
}

// ---------- ranking ----------
function viewRanking(main) {
  main.innerHTML = `<div class="lab-head"><h2>Ranking</h2></div><div id="rankOut"><p class="muted">Calculando…</p></div>`;
  loadIncubated().then(() => {
    if (current !== 'ranking') return;
    const rows = [...incubated].sort((a, b) => (b.paper?.ret ?? -9) - (a.paper?.ret ?? -9) || b.oos.ret - a.oos.ret);
    $('#rankOut', root).innerHTML = rows.length ? `<ol class="lab-rank">${rows.map((s, i) => `<li><b>${i + 1}</b><span>${esc(strategyName(s))}</span><em>${s.paper ? pct(s.paper.ret) : '—'}</em><small>${(STATUS[s.status] || STATUS['sin datos'])[0]}</small></li>`).join('')}</ol>` : '<p class="muted">Aún no hay estrategias que clasificar.</p>';
  });
}

// ---------- dirección y comité ----------
function viewComite(main) {
  main.innerHTML = `<div class="lab-head"><h2>Dirección y comité</h2><button class="btn sm primary" id="comGo" type="button">Convocar comité</button></div>
    <p class="muted lab-note">La directora reúne a Riesgos, Macro, Análisis y Quant. Cada uno aporta con las estrategias de la incubadora y datos reales.</p><div id="comOut"></div>`;
  $('#comGo', main).addEventListener('click', async () => {
    const out = $('#comOut', main); out.innerHTML = '<p class="muted">Reuniendo al equipo…</p>';
    await loadIncubated();
    const live = incubated.filter((s) => s.signal?.inPosition), ok = incubated.filter((s) => s.status !== 'reprobada');
    const bySym = {}; live.forEach((s) => { bySym[s.symbol] = (bySym[s.symbol] || 0) + 1; });
    const crowded = Object.entries(bySym).filter(([, n]) => n > 1).map(([k]) => SYMBOLS[k].short);
    const lines = [
      ['dir', `Comité abierto. Tenemos ${incubated.length} estrategia(s) en incubadora y ${live.length} con señal de compra ahora.`],
      ['ana', Number.isFinite(market.change.BTCUSDT) ? `BTC ${pct(market.change.BTCUSDT / 100, 2)} en 24 h. Comparto niveles en la sala de Macro y análisis.` : 'Sin precio de BTC todavía.'],
      ['mac', `Agenda de hoy: ${AGENDA.map((e) => `${e.time} ${e.title}`).join(' · ')} (ejemplo).`],
      ['rie', crowded.length ? `Alerta: varias estrategias apuntan a ${crowded.join(', ')}. Limito a una por activo.` : `Sin concentración. Ninguna posición supera el límite; mantengo caída máxima ${P(RULES.maxDD)} %.`],
      ['qua', ok.length ? `Reparto simulado en partes iguales entre ${Math.min(ok.length, 5)} estrategia(s) vigentes.` : 'No hay estrategias vigentes para repartir.'],
      ['dir', 'Conclusión: seguimos en simulación. Nada pasa a capital real sin examen aprobado y decisión humana.'],
    ];
    out.innerHTML = `<div class="lab-feed">${lines.map(([id, t]) => { const a = agent(id); return `<div class="lab-msg"><b style="color:${a.color}">${a.name}</b><span>${esc(t)}</span></div>`; }).join('')}</div>`;
    lines.forEach(([id, t]) => say(id, t));
  });
}

// ---------- riesgos ----------
function viewRiesgos(main) {
  main.innerHTML = `<div class="lab-head"><h2>Riesgos</h2></div>
    <p class="muted lab-note">El departamento de riesgos no inventa estrategias: bloquea las que no cumplen estas reglas.</p>
    <ul class="lab-rules">
      <li><b>Dentro y fuera de muestra</b><span>Gana en el 70 % de entrenamiento y en el 30 % que no vio (factor de beneficio ≥ ${RULES.minPF}).</span></li>
      <li><b>Caída máxima</b><span>No más de ${P(RULES.maxDD)} % desde un máximo de capital.</span></li>
      <li><b>Robustez</b><span>Al menos ${P(RULES.robustMin)} % de los parámetros vecinos también ganan.</span></li>
      <li><b>Costos</b><span>Comisión ${P(RULES.fee)} % + deslizamiento ${P(RULES.slip)} % por lado, y sigue ganando con costos x${RULES.costMult}.</span></li>
      <li><b>Actividad mínima</b><span>${RULES.minTrades} operaciones en total y ${RULES.minOosTrades} fuera de muestra.</span></li>
      <li><b>Examen en simulación</b><span>30 días y 2 operaciones, ganando y con caída menor a 25 %.</span></li>
    </ul>`;
}

// ---------- macro y análisis ----------
function viewMercado(main) {
  main.innerHTML = `<div class="lab-head"><h2>Macro y análisis</h2></div><div class="lab-cards" id="mkOut"><p class="muted">Leyendo el mercado…</p></div>
    <h3>Agenda de ejemplo</h3><ul class="lab-rules">${AGENDA.map((e) => `<li><b>${e.time}</b><span>${esc(e.title)} · impacto ${e.impact}</span></li>`).join('')}</ul>`;
  Promise.all(Object.keys(SYMBOLS).map(async (s) => [s, analyze(await getCandles(s, '1d'))])).then((rows) => {
    if (current !== 'mercado') return;
    $('#mkOut', root).innerHTML = rows.map(([s, a]) => `<article class="lab-card"><b>${SYMBOLS[s].name}</b><dl><dt>Precio</dt><dd>${fmt(s, market.prices[s])}</dd><dt>Tendencia</dt><dd>${a.trend}</dd><dt>RSI</dt><dd>${a.rsi?.toFixed(0) ?? '—'}</dd><dt>R1 / S1</dt><dd>${fmt(s, a.levels.r1)} / ${fmt(s, a.levels.s1)}</dd></dl></article>`).join('');
  }).catch(() => { $('#mkOut', root).innerHTML = '<p class="muted">No se pudo leer el mercado ahora.</p>'; });
}

// ---------- conexiones ----------
function viewConexiones(main) {
  const items = [
    ['Precios y velas (Binance público)', 'activa', 'Sin clave. Se usa para el mercado y para minar.'],
    ['Minería y backtest', 'activa', 'Corre en tu navegador con datos de Binance.'],
    ['Precios de Bybit', 'pendiente', 'Falta: elegir proveedor y, si se quiere ejecutar, una API key de solo lectura guardada en un servidor.'],
    ['Agentes con IA de lenguaje', 'pendiente', 'Falta: un servidor propio y una clave de API de un modelo de lenguaje. Hoy los agentes hablan con reglas y datos reales.'],
    ['Webhook de TradingView', 'pendiente', 'Falta: un servidor con una URL pública que reciba las alertas.'],
    ['Ejecución de operaciones', 'no incluida', 'Pulso no opera. Cualquier ejecución real requiere servidor, cuenta del bróker y revisión de riesgos.'],
  ];
  main.innerHTML = `<div class="lab-head"><h2>Conexiones</h2></div><ul class="lab-rules">${items.map(([n, s, d]) => `<li><b>${n}</b><span><em class="st-${s === 'activa' ? 'ok' : 'warn'}">${s}</em> ${d}</span></li>`).join('')}</ul>`;
}
