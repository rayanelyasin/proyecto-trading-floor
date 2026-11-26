import { fmt, fmtNum, market, SYMBOLS } from './market.js';
import { store, save } from './store.js';

const GLOSSARY = [
  ['Apertura y cierre', 'Gráficos', 'Primer y último precio registrados durante el intervalo de una vela.'],
  ['ATR', 'Gráficos', 'Medida de cuánto se mueve un activo en promedio, sin indicar la dirección.'],
  ['Media móvil', 'Gráficos', 'Promedio de precios de un número de períodos. Se desplaza a medida que llegan datos nuevos.'],
  ['RSI', 'Gráficos', 'Indicador de momento entre 0 y 100 que compara la fuerza de subidas y bajadas recientes.'],
  ['Soporte y resistencia', 'Gráficos', 'Zonas donde el precio ha encontrado demanda u oferta en movimientos anteriores.'],
  ['Vela y mecha', 'Gráficos', 'El cuerpo de la vela une apertura y cierre. Las mechas indican el máximo y el mínimo del período.'],
  ['Deslizamiento', 'Riesgo', 'Diferencia entre el precio esperado y el precio al que termina ejecutándose una orden.'],
  ['Drawdown', 'Riesgo', 'Caída desde un máximo previo del valor de una cartera hasta un mínimo posterior.'],
  ['Exposición', 'Riesgo', 'Importe que queda sujeto a la variación de precio de uno o varios activos.'],
  ['Tamaño de posición', 'Riesgo', 'Cantidad de unidades que componen una operación.'],
  ['Liquidez', 'Mercado', 'Facilidad para comprar o vender sin provocar una gran variación en el precio.'],
  ['Spread', 'Mercado', 'Diferencia entre el mejor precio de compra y el mejor precio de venta.'],
];

const CONFERENCES = [
  { id: 'prep', time: '10:00', name: 'Preparar la sesión', host: 'Camila', mins: 25, description: 'De la agenda al gráfico. Cómo documentar un plan antes de abrir el mercado.' },
  { id: 'walkthrough', time: '11:00', name: 'Diario de operaciones', host: 'Valentina', mins: 35, description: 'Un recorrido por el registro de decisiones y la revisión de errores recurrentes.' },
  { id: 'review', time: '12:00', name: 'Revisión semanal', host: 'Diego', mins: 30, description: 'Puesta en común de observaciones, escenarios y preguntas de la audiencia.' },
];

function toolsForAccount() {
  const username = store.session;
  store.floorTools ??= {};
  if (!Object.hasOwn(store.floorTools, username)) {
    Object.defineProperty(store.floorTools, username, {
      value: { note: '', favorites: ['BTCUSDT', 'ETHUSDT'], savedEvents: {}, memoryBest: null },
      enumerable: true, writable: true,
    });
  }
  return store.floorTools[username];
}

const searchable = (text) => text.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

export function renderLibrary(body, openCourses) {
  const profile = toolsForAccount();
  body.innerHTML = `
    <div class="floor-activity-header"><h3>Biblioteca</h3><button class="btn sm" id="libraryCourses" type="button">Ver cursos</button></div>
    <section class="card floor-library">
      <h4>Glosario</h4>
      <div class="floor-library-filters">
        <label>Buscar <input id="librarySearch" type="search" placeholder="Ej. liquidez" autocomplete="off"></label>
        <label>Categoría <select id="libraryCategory"><option value="">Todas</option><option>Gráficos</option><option>Riesgo</option><option>Mercado</option></select></label>
      </div>
      <p id="libraryCount" class="muted" role="status"></p>
      <div id="libraryTerms"></div>
    </section>
    <form class="card form" id="libraryNotes">
      <h4>Cuaderno de estudio</h4>
      <label>Notas privadas en este navegador<textarea name="note" rows="4" maxlength="4000" placeholder="Escribe tus apuntes"></textarea></label>
      <div class="row gap wrap"><button class="btn sm primary">Guardar notas</button><span id="librarySaveState" class="muted" role="status"></span></div>
    </form>`;
  const search = body.querySelector('#librarySearch');
  const category = body.querySelector('#libraryCategory');
  const terms = body.querySelector('#libraryTerms');
  const count = body.querySelector('#libraryCount');
  const notes = body.querySelector('#libraryNotes');
  const saved = body.querySelector('#librarySaveState');
  notes.elements.note.value = profile.note ?? '';
  const paint = () => {
    const query = searchable(search.value.trim());
    const matches = GLOSSARY.filter(([term, group, description]) =>
      (!category.value || group === category.value) && searchable(`${term} ${description}`).includes(query));
    count.textContent = matches.length === 1 ? '1 resultado' : `${matches.length} resultados`;
    terms.innerHTML = matches.length ? matches.map(([term, group, description]) => `
      <details class="floor-term"><summary><strong>${term}</strong><span>${group}</span></summary><p>${description}</p></details>`).join('')
      : '<p class="floor-empty">Cambia la búsqueda o elige otra categoría.</p>';
  };
  search.addEventListener('input', paint);
  category.addEventListener('change', paint);
  notes.elements.note.addEventListener('input', () => { saved.textContent = 'Sin guardar'; });
  notes.addEventListener('submit', (event) => {
    event.preventDefault();
    profile.note = notes.elements.note.value;
    save();
    saved.textContent = 'Guardado en este navegador';
  });
  body.querySelector('#libraryCourses').onclick = openCourses;
  paint();
}

export function renderWatchlist(body, openAnalysis) {
  const profile = toolsForAccount();
  let favoritesOnly = false;
  body.innerHTML = `
    <div class="floor-activity-header"><h3>Lista de seguimiento</h3><span id="watchStatus" class="floor-source"></span></div>
    <div class="seg floor-seg" role="group" aria-label="Activos"><button type="button" data-watch-filter="all" aria-pressed="true">Todos</button><button type="button" data-watch-filter="favorites" aria-pressed="false">Favoritos</button></div>
    <div class="floor-watchlist" id="watchRows"></div>`;
  const rows = body.querySelector('#watchRows');
  const state = body.querySelector('#watchStatus');

  function updatePrices() {
    state.textContent = market.status === 'en vivo' ? 'Datos en vivo' : market.status === 'simulado' ? 'Datos simulados' : 'Conectando…';
    state.dataset.source = market.status === 'en vivo' ? 'live' : 'fallback';
    for (const row of rows.querySelectorAll('[data-symbol]')) {
      const id = row.dataset.symbol;
      row.querySelector('[data-price]').textContent = fmt(id, market.prices[id]);
      const change = market.change[id];
      const output = row.querySelector('[data-change]');
      output.textContent = Number.isFinite(change) ? `${change >= 0 ? '+' : '−'}${fmtNum(Math.abs(change))} %` : '—';
      output.className = !Number.isFinite(change) ? 'muted' : change >= 0 ? 'up' : 'down';
    }
  }

  function paint() {
    const names = Object.entries(SYMBOLS).filter(([id]) => !favoritesOnly || profile.favorites.includes(id));
    rows.innerHTML = names.length ? names.map(([id, item]) => {
      const favorite = profile.favorites.includes(id);
      return `<article class="floor-quote" data-symbol="${id}">
        <button class="floor-star" type="button" data-favorite="${id}" aria-label="Favorito ${item.name}" aria-pressed="${favorite}">${favorite ? '★' : '☆'}</button>
        <div class="floor-quote-name"><strong>${item.short}</strong><small>${item.name}</small></div>
        <div class="floor-quote-value"><strong class="mono" data-price></strong><small data-change></small></div>
        <button type="button" class="btn sm" data-analysis="${id}" aria-label="Ver análisis de ${item.name}">Ver</button>
      </article>`;
    }).join('') : '<p class="floor-empty">Marca una estrella en la lista de todos los activos.</p>';
    updatePrices();
  }
  body.querySelector('.floor-seg').addEventListener('click', (event) => {
    const button = event.target.closest('[data-watch-filter]');
    if (!button) return;
    favoritesOnly = button.dataset.watchFilter === 'favorites';
    for (const option of body.querySelectorAll('[data-watch-filter]')) {
      option.setAttribute('aria-pressed', String(option === button));
    }
    paint();
  });
  rows.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.analysis) { openAnalysis(button.dataset.analysis); return; }
    const id = button.dataset.favorite;
    if (!id) return;
    const favorite = !profile.favorites.includes(id);
    profile.favorites = favorite ? [...profile.favorites, id] : profile.favorites.filter((item) => item !== id);
    save();
    if (favoritesOnly && !favorite) {
      paint();
      (rows.querySelector('[data-favorite]') ?? body.querySelector('[data-watch-filter="all"]')).focus();
    } else {
      button.setAttribute('aria-pressed', String(favorite));
      button.textContent = favorite ? '★' : '☆';
    }
  });
  paint();
  return market.on((type) => {
    if (type === 'tick' || type === 'status') updatePrices();
  });
}

export function renderProgram(body, visitStage) {
  const profile = toolsForAccount();
  body.innerHTML = `
    <div class="floor-activity-header"><h3>Programa del auditorio</h3><span class="floor-source">Agenda de ejemplo</span></div>
    <ol class="floor-program">${CONFERENCES.map((event) => `
      <li><time>${event.time}</time><div class="grow"><h4>${event.name}</h4><p class="muted">${event.host} · ${event.mins} min</p>
      <p>${event.description}</p><button type="button" class="btn sm" aria-pressed="${Boolean(profile.savedEvents[event.id])}" data-event="${event.id}">
        ${profile.savedEvents[event.id] ? 'Guardado' : 'Guardar sesión'}</button></div></li>`).join('')}</ol>
    <button class="btn primary" type="button" id="programStage">Ir a la tarima</button>`;
  for (const button of body.querySelectorAll('[data-event]')) {
    button.onclick = () => {
      const id = button.dataset.event;
      const selected = !profile.savedEvents[id];
      profile.savedEvents[id] = selected;
      button.setAttribute('aria-pressed', String(selected));
      button.textContent = selected ? 'Guardado' : 'Guardar sesión';
      save();
    };
  }
  body.querySelector('#programStage').onclick = visitStage;
}

export function memoryGame(container) {
  const profile = toolsForAccount();
  const symbols = ['BTC', 'ETH', 'SOL', 'ORO', 'RSI', 'ATR'];
  let deck = [];
  let open = [];
  let matched = new Set();
  let attempts = 0;
  let flipTimer;

  container.innerHTML = `
    <p class="muted">Encuentra las seis parejas de símbolos en el menor número de intentos.</p>
    <div class="floor-memory-stats"><span>Intentos <b id="memoryAttempts">0</b></span><span>Récord <b id="memoryBest">${profile.memoryBest ?? '—'}</b></span></div>
    <div class="floor-memory" aria-label="Cartas de memoria">${symbols.concat(symbols).map((_, i) =>
      `<button type="button" aria-label="Carta ${i + 1}" data-memory-card="${i}">?</button>`).join('')}</div>
    <p class="floor-memory-msg" role="status"></p>
    <button type="button" class="btn sm" id="memoryRestart">Nueva partida</button>`;

  const panel = container.querySelector('.floor-memory');
  const buttons = [...panel.querySelectorAll('button')];
  const message = container.querySelector('.floor-memory-msg');
  const score = container.querySelector('#memoryAttempts');
  const best = container.querySelector('#memoryBest');

  function paint() {
    buttons.forEach((button, i) => {
      const visible = matched.has(i) || open.includes(i);
      button.dataset.state = matched.has(i) ? 'match' : visible ? 'open' : 'closed';
      button.disabled = matched.has(i);
      button.textContent = visible ? deck[i] : '?';
      button.setAttribute('aria-label', `Carta ${i + 1}${visible ? `, ${deck[i]}` : ''}`);
    });
    score.textContent = attempts;
  }
  function start() {
    clearTimeout(flipTimer);
    deck = symbols.concat(symbols);
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    open = [];
    matched = new Set();
    attempts = 0;
    message.textContent = 'Elige la primera carta.';
    paint();
  }
  panel.addEventListener('click', (event) => {
    const button = event.target.closest('[data-memory-card]');
    if (!button || open.length === 2) return;
    const i = Number(button.dataset.memoryCard);
    if (open.includes(i) || matched.has(i)) return;
    open.push(i);
    if (open.length === 1) {
      message.textContent = `Salió ${deck[i]}. Busca su pareja.`;
      paint();
      return;
    }
    attempts++;
    const [a, b] = open;
    if (deck[a] === deck[b]) {
      matched.add(a);
      matched.add(b);
      open = [];
      const done = matched.size === deck.length;
      message.textContent = done ? `¡Encontraste todas las parejas en ${attempts} intentos!` : `Pareja de ${deck[i]} encontrada.`;
      if (done && (profile.memoryBest === null || attempts < profile.memoryBest)) {
        profile.memoryBest = attempts;
        best.textContent = attempts;
        save();
      }
      paint();
      const next = buttons.slice(i + 1).find((candidate) => !candidate.disabled) ?? buttons.find((candidate) => !candidate.disabled);
      (next ?? container.querySelector('#memoryRestart')).focus({ preventScroll: true });
    } else {
      message.textContent = 'No coinciden. Recuerda dónde están.';
      paint();
      flipTimer = setTimeout(() => { open = []; message.textContent = 'Elige otra pareja.'; paint(); }, 850);
    }
  });
  container.querySelector('#memoryRestart').onclick = start;
  start();
  return () => clearTimeout(flipTimer);
}
