// Interfaz sobre el piso: barra superior, dock, paneles, chat de proximidad, alertas y agentes.
import { store, save, reset } from './store.js';
import { market, SYMBOLS, TIMEFRAMES, getCandles, candlesAreLive, analyze, fmt, fmtNum } from './market.js';
import { ROOMS, SLIDES, COURSES, RECORDINGS, AGENTS, AGENDA, MEMBERS, NPC_REPLIES, NPC_GENERIC, AUDIENCE_REPLIES } from './data.js';
import { escapeHtml as esc, FLOORS } from './scene.js';
import { renderLibrary, renderWatchlist, renderProgram, memoryGame } from './floor-activities.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const isOwner = () => store.role === 'dueno';
const now = () => new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });

export const ICON = {
  piso: '<path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6"/>',
  salas: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  cursos: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
  videoteca: '<rect x="2" y="5" width="15" height="14" rx="2"/><path d="m17 10 5-3v10l-5-3z"/>',
  analisis: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>',
  alertas: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  agentes: '<rect x="4" y="7" width="16" height="12" rx="3"/><path d="M12 7V3M9 13h.01M15 13h.01"/>',
  conexiones: '<path d="M9 17H7A5 5 0 0 1 7 7h2M15 7h2a5 5 0 0 1 0 10h-2M8 12h8"/>',
  miembros: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M16 3.1a4 4 0 0 1 0 7.8M22 21a7 7 0 0 0-5-6.7"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  conferencia: '<rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4"/>',
  juegos: '<rect x="2" y="6" width="20" height="12" rx="6"/><path d="M6 12h4M8 10v4M15 13h.01M18 11h.01"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  person: '<circle cx="12" cy="7" r="4"/><path d="M5 21a7 7 0 0 1 14 0"/>',
  cube: '<path d="m12 2 9 5v10l-9 5-9-5V7z"/><path d="m3 7 9 5 9-5M12 12v10"/>',
  send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
  play: '<path d="m6 3 14 9-14 9z"/>',
  chev: '<path d="m9 18 6-6-6-6"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
  screen: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
};
export const icon = (n, cls = '') => `<svg class="ic ${cls}" aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON[n] || ''}</svg>`;

const PANELS = {
  piso: { title: 'Explorar el piso', render: renderFloorGuide },
  biblioteca: { title: 'Biblioteca', icon: 'cursos', render: (body) => renderLibrary(body, () => openPanel('cursos')) },
  seguimiento: { title: 'Seguimiento', icon: 'analisis', render: (body) => renderWatchlist(body, (symbol) => openPanel('analisis', symbol)) },
  programa: { title: 'Programa', icon: 'cursos', render: (body) => renderProgram(body, () => visit('tarima')) },
  salas: { title: 'Salas y aula', render: renderSalas },
  cursos: { title: 'Cursos', render: renderCursos },
  videoteca: { title: 'Videoteca', render: renderVideoteca },
  analisis: { title: 'Análisis de mercado', render: renderAnalisis, wide: true },
  alertas: { title: 'Indicadores y alertas', render: renderAlertas },
  agentes: { title: 'Piso de agentes', render: renderAgentes },
  conferencia: { title: 'Conferencia', render: renderConferencia },
  juegos: { title: 'Sala de juegos', render: renderJuegos },
  conexiones: { title: 'Conexiones', render: renderConexiones, owner: true },
  miembros: { title: 'Miembros conectados', render: renderMiembros, owner: true },
};

let world = null;
let currentPanel = null;
let unmount = null;
const allCourses = () => [...COURSES, ...store.customCourses];
const allRooms = () => [...ROOMS, ...store.customRooms].sort((a, b) => (b.live ? 1 : 0) - (a.live ? 1 : 0) || a.start - b.start);
const doneCount = (c) => (store.progress[c.id] || []).length;

// ============ inicio ============
export function initUI(w) {
  world = w;
  document.body.dataset.role = store.role;

  // dock
  $$('#dock [data-panel]').forEach((b) => b.addEventListener('click', () => {
    const p = b.dataset.panel;
    if (currentPanel === p) closePanel(); else openPanel(p);
  }));
  $('#drawerClose').addEventListener('click', closePanel);
  $('#exploreFloor').addEventListener('click', () => {
    if (currentPanel === 'piso') closePanel();
    else openPanel('piso');
  });
  addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && currentPanel && !document.querySelector('dialog[open]')) {
      event.preventDefault();
      closePanel();
    }
  });
  const compact = matchMedia('(max-width: 760px)').matches;
  $('#cameraTools').open = !compact;
  const toggleMap = $('#mapToggle');
  const map = $('#floorMap');
  function setMap(open) {
    map.hidden = !open;
    toggleMap.setAttribute('aria-expanded', String(open));
  }
  setMap(!compact);
  toggleMap.onclick = () => setMap(map.hidden);
  paintFloor(world.floor);
  syncPanels();

  // rol
  $$('#roleSwitch button').forEach((b) => b.addEventListener('click', () => setRole(b.dataset.role)));
  syncRole();

  // perfil
  $('#meChip').addEventListener('click', () => window.dispatchEvent(new CustomEvent('pulso:edit-profile')));
  $('#resetDemo')?.addEventListener('click', () => { if (confirm('¿Borrar las cuentas y todos los datos locales de Pulso en este navegador?')) reset(); });

  // zona
  $('#zonePrompt').addEventListener('click', () => { const z = world.currentZone; if (z) openPanel(z.panel, z.arg); });

  // pisos y vistas de cámara
  $$('#floors [data-floor]').forEach((b) => b.addEventListener('click', () => world.setFloor(+b.dataset.floor)));
  $$('#viewSwitch [data-view]').forEach((b) => b.addEventListener('click', () => world.setView(b.dataset.view)));
  // chat
  initChat(compact);
  // ticker
  market.on((type, d) => {
    if (type === 'tick') renderTicker();
    if (type === 'status') renderStatus();
    if (type === 'tick' && d?.symbol) checkPriceAlerts(d.symbol, d.price, d.prev);
  });
  renderStatus();
  renderTicker();

  // contenido 3D inicial
  world.setKiosks(allCourses(), doneCount);
  world.setVideoteca(RECORDINGS.length + uploads.length);
  syncAlertTower();
  startClass();
  startAgents();
  setInterval(checkRsiAlerts, 60000);
  setTimeout(checkRsiAlerts, 4000);
}

function setRole(r) {
  store.role = r; save(); syncRole();
  toast(r === 'dueno' ? 'Vista de dueño' : 'Vista de miembro', r === 'dueno' ? 'Ves las conexiones, los miembros y das tareas a los agentes.' : 'Ves lo que ve un miembro de la comunidad.');
  if (currentPanel) { if (PANELS[currentPanel].owner && r !== 'dueno') closePanel(); else openPanel(currentPanel, lastArg); }
}
function syncRole() {
  document.body.dataset.role = store.role;
  $$('#roleSwitch button').forEach((b) => {
    const active = b.dataset.role === store.role;
    b.classList.toggle('on', active);
    b.setAttribute('aria-pressed', String(active));
  });
}

function zoneLabel(zone) {
  return zone.id.startsWith('kiosk') ? allCourses()[zone.arg]?.title ?? 'Curso' : zone.label;
}

export function onZone(zone) {
  const el = $('#zonePrompt');
  if (!zone) { el.hidden = true; return; }
  el.innerHTML = `<kbd aria-hidden="true">E</kbd><span>Abrir <b>${esc(zoneLabel(zone))}</b></span>`;
  el.hidden = false;
}
export function onInteract(zone) { openPanel(zone.panel, zone.arg); }

function visit(id) {
  const here = world.currentZone?.id === id;
  if (!world.goToZone(id)) {
    toast('No se encontró una ruta', 'Acércate a la zona o abre su panel desde Explorar.');
    return;
  }
  if (here) return;
  closePanel();
  const destination = world.destinations().find((zone) => zone.id === id);
  if (destination) toast(`Caminando a ${zoneLabel(destination)}`);
}

function renderFloorGuide(body) {
  const floor = FLOORS.find(({ n }) => n === world.floor);
  const destinations = world.destinations().filter((zone) => !zone.id.startsWith('kiosk') || allCourses()[zone.arg]);
  if (!destinations.length) return;
  body.innerHTML = `
    <section class="floor-explorer">
      <h3>${floor.name}</h3>
      <p>${floor.description}. Abre una actividad o camina hasta ella.</p>
    </section>
    <div class="floor-directory">
      ${destinations.map((zone) => {
        const label = zoneLabel(zone);
        const activity = PANELS[zone.panel];
        return `<article class="floor-destination">
          <button type="button" class="destination-open" data-open-zone="${zone.id}" aria-label="Abrir ${esc(label)}">
            <span class="destination-icon" aria-hidden="true">${icon(activity.icon ?? zone.panel)}</span>
            <span><strong>${esc(label)}</strong><small>${esc(zone.detail)}</small></span>
          </button>
          <button type="button" class="btn sm" data-visit-zone="${zone.id}" aria-label="Caminar a ${esc(label)}">Ir ${icon('chev')}</button>
        </article>`;
      }).join('')}
    </div>
    <details class="floor-shortcuts"><summary>Controles del piso</summary>
      <p>WASD o un toque en el piso para moverte. Arrastra para cambiar el ángulo, usa V para cambiar de cámara y E para abrir una actividad cercana.</p>
    </details>`;
  for (const button of body.querySelectorAll('[data-open-zone]')) {
    button.onclick = () => onInteract(destinations.find((zone) => zone.id === button.dataset.openZone));
  }
  for (const button of body.querySelectorAll('[data-visit-zone]')) {
    button.onclick = () => visit(button.dataset.visitZone);
  }
}

// ============ paneles ============
let lastArg;
let hideDrawer;
let returnFocus;
function syncPanels() {
  $$('#dock [data-panel]').forEach((button) => {
    const active = button.dataset.panel === currentPanel;
    button.classList.toggle('on', active);
    button.setAttribute('aria-controls', 'drawer');
    button.setAttribute('aria-expanded', String(active));
  });
  $('#exploreFloor').setAttribute('aria-expanded', String(currentPanel === 'piso'));
}
export function openPanel(name, arg) {
  const panel = PANELS[name];
  if (!panel || !world) return;
  if (panel.owner && !isOwner()) { toast('Solo el dueño', 'Cambia a la vista de dueño para ver este panel.'); return; }
  clearTimeout(hideDrawer);
  unmount?.();
  unmount = null;
  const drawer = $('#drawer');
  const active = document.activeElement;
  if (active && !drawer.contains(active) && active !== document.body) returnFocus = active;
  currentPanel = name;
  lastArg = arg;
  world.cancelNavigation();
  drawer.classList.toggle('wide', Boolean(panel.wide));
  const title = $('#drawerTitle');
  title.innerHTML = `${icon(panel.icon ?? name)}<span>${panel.title}</span>`;
  drawer.inert = false;
  drawer.hidden = false;
  document.body.classList.add('panel-open');
  const body = $('#drawerBody');
  const cleanup = panel.render(body, arg);
  unmount = typeof cleanup === 'function' ? cleanup : null;
  body.scrollTop = 0;
  drawer.classList.add('open');
  title.focus({ preventScroll: true });
  syncPanels();
}
export function closePanel() {
  if (!currentPanel) return;
  unmount?.();
  unmount = null;
  currentPanel = null;
  document.body.classList.remove('panel-open');
  const drawer = $('#drawer');
  if (drawer.contains(document.activeElement)) {
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    else document.activeElement.blur();
  }
  returnFocus = null;
  drawer.inert = true;
  drawer.classList.remove('open');
  hideDrawer = setTimeout(() => { if (!currentPanel) drawer.hidden = true; }, 250);
  syncPanels();
}

// ============ salas y aula ============
const cls = { index: 0, timer: 0 };
function liveRoom() { return allRooms().find((r) => r.live); }
function startClass() {
  const r = liveRoom();
  pushSlide();
  clearInterval(cls.timer);
  // si el dueño no la controla, avanza sola cada 25 s (simula a la mentora)
  cls.timer = setInterval(() => { if (!isOwner() || !cls.manual) { cls.index = (cls.index + 1) % SLIDES.length; pushSlide(); } }, 25000);
  return r;
}
function pushSlide() {
  const r = liveRoom();
  world.setSlide({ slide: SLIDES[cls.index], index: cls.index, total: SLIDES.length, host: r?.host || '', live: !!r });
  const el = $('#classSlide'); if (el) el.innerHTML = slideHtml();
}
function slideHtml() {
  const s = SLIDES[cls.index];
  return `<div class="slide-n">${cls.index + 1} / ${SLIDES.length}</div><h3>${esc(s.title)}</h3><ul>${s.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>`;
}
let screenStream = null;

function whenTxt(r) {
  if (r.live) return '<span class="pill live">● En vivo</span>';
  const d = new Date(r.start), t = new Date();
  const days = Math.round((new Date(d.toDateString()) - new Date(t.toDateString())) / 86400000);
  const hh = d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  const day = days === 0 ? 'Hoy' : days === 1 ? 'Mañana' : d.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric' });
  return `<span class="pill">${day} ${hh}</span>`;
}

function renderSalas(body) {
  const live = liveRoom();
  const attendees = world.npcs.filter((n) => world.zoneOf(n)?.id === 'aula').length + (world.currentZone?.id === 'aula' ? 1 : 0);
  body.innerHTML = `
    ${live ? `
    <section class="card class-card">
      <div class="row between"><span class="pill live">● En vivo</span><span class="muted">${attendees} en el aula</span></div>
      <h3 class="mt8">${esc(live.title)}</h3>
      <p class="muted">con ${esc(live.host)} · empezó hace ${Math.max(1, Math.round((Date.now() - live.start) / 60000))} min</p>
      <div id="classSlide" class="slide">${slideHtml()}</div>
      <div class="row gap mt12">
        <button class="btn primary" id="goAula">${icon('piso')} Ir al aula</button>
        <span class="owner-only row gap">
          <button class="btn" id="prevSlide">${icon('back')}</button>
          <button class="btn" id="nextSlide">${icon('chev')}</button>
        </span>
      </div>
      <p class="hint member-only">La mentora controla las diapositivas. Lo que ves aquí es lo mismo que la pantalla del aula.</p>
    </section>` : ''}

    <section class="card owner-only">
      <h4>Compartir pantalla en el aula</h4>
      <p class="muted">Tu pantalla aparece en la pantalla grande del aula en 3D.</p>
      <button class="btn ${screenStream ? 'danger' : 'primary'}" id="shareBtn">${icon('screen')} ${screenStream ? 'Dejar de compartir' : 'Compartir pantalla'}</button>
      <p class="hint">En esta versión solo la ves tú. Para que la vean todos hace falta un servidor de video, por ejemplo LiveKit.</p>
    </section>

    <h4 class="section-t">Próximas salas</h4>
    <div class="list">${allRooms().filter((r) => !r.live).map((r) => `
      <div class="list-item">
        <div class="avatar-dot" style="--c:${MEMBERS.find((m) => m.name === r.host)?.color || '#d9bf8c'}">${esc(r.host[0])}</div>
        <div class="grow"><b>${esc(r.title)}</b><div class="muted">con ${esc(r.host)} · ${r.mins} min</div></div>
        ${whenTxt(r)}
        <button class="btn sm ${store.reminders.includes(r.id) ? 'on' : ''}" data-remind="${r.id}">${store.reminders.includes(r.id) ? 'Te avisaremos' : 'Recordarme'}</button>
      </div>`).join('')}
    </div>

    <section class="card owner-only">
      <h4>Programar una sala</h4>
      <form id="roomForm" class="form">
        <label>Título<input name="title" required maxlength="60" placeholder="Ej.: Sesión de preguntas"></label>
        <div class="row gap">
          <label class="grow">Fecha y hora<input name="when" type="datetime-local" required></label>
          <label>Duración<select name="mins"><option>30</option><option selected>60</option><option>90</option></select></label>
        </div>
        <button class="btn primary">Programar</button>
      </form>
    </section>`;

  $('#goAula')?.addEventListener('click', () => visit('aula'));
  $('#prevSlide')?.addEventListener('click', () => { cls.manual = true; cls.index = (cls.index - 1 + SLIDES.length) % SLIDES.length; pushSlide(); });
  $('#nextSlide')?.addEventListener('click', () => { cls.manual = true; cls.index = (cls.index + 1) % SLIDES.length; pushSlide(); });
  $('#shareBtn')?.addEventListener('click', toggleShare);
  $$('[data-remind]', body).forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.remind; const i = store.reminders.indexOf(id);
    i >= 0 ? store.reminders.splice(i, 1) : store.reminders.push(id); save(); renderSalas(body);
  }));
  const f = $('#roomForm');
  if (f) {
    const d = new Date(Date.now() + 86400000); d.setMinutes(0, 0, 0);
    f.when.value = new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      store.customRooms.push({ id: 'cr' + Date.now(), title: f.title.value.trim(), host: store.profile?.name || 'Dueño', start: new Date(f.when.value).getTime(), mins: +f.mins.value });
      save(); logActivity(`Sala programada: ${f.title.value.trim()}`); toast('Sala programada', 'Ya aparece en el directorio de salas.'); renderSalas(body);
    });
  }
}

async function toggleShare() {
  if (screenStream) { screenStream.getTracks().forEach((t) => t.stop()); screenStream = null; world.setScreenStream(null); if (currentPanel === 'salas') openPanel('salas'); return; }
  try {
    screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    screenStream.getVideoTracks()[0].addEventListener('ended', () => { screenStream = null; world.setScreenStream(null); if (currentPanel === 'salas') openPanel('salas'); });
    world.setScreenStream(screenStream);
    toast('Compartiendo pantalla', 'Mira la pantalla grande del aula.');
    if (currentPanel === 'salas') openPanel('salas');
  } catch { toast('No se pudo compartir', 'El navegador no dio permiso o no lo admite.'); }
}

// ============ cursos ============
function renderCursos(body, arg) {
  const courses = allCourses();
  const view = (state) => {
    if (state.lesson != null) return lessonView(state.course, state.lesson);
    if (state.course) return courseView(state.course);
    return listView();
  };
  const listView = () => {
    const cont = courses.find((c) => doneCount(c) > 0 && doneCount(c) < c.lessons.length);
    body.innerHTML = `
      ${cont ? `<button class="card continue" data-course="${cont.id}"><span class="muted">Continuar</span><b>${esc(cont.title)}</b><span class="muted">Lección ${doneCount(cont) + 1} de ${cont.lessons.length}</span>${bar(doneCount(cont) / cont.lessons.length)}</button>` : ''}
      <div class="grid2">${courses.map((c) => `
        <button class="card course" data-course="${c.id}">
          <span class="pill">${esc(c.level)}</span>
          <b>${esc(c.title)}</b>
          <span class="muted">${doneCount(c)} de ${c.lessons.length} lecciones · ${c.lessons.reduce((a, l) => a + l.mins, 0)} min</span>
          ${bar(doneCount(c) / c.lessons.length)}
        </button>`).join('')}
      </div>
      <p class="hint">También puedes abrir un curso acercándote a los puestos del lado derecho del piso.</p>
      <section class="card owner-only">
        <h4>Crear un curso</h4>
        <form id="courseForm" class="form">
          <label>Título<input name="title" required maxlength="50"></label>
          <label>Lecciones (una por línea)<textarea name="lessons" rows="4" required placeholder="Introducción&#10;Primer concepto&#10;Práctica"></textarea></label>
          <button class="btn primary">Crear curso</button>
        </form>
      </section>`;
    $$('[data-course]', body).forEach((b) => b.addEventListener('click', () => view({ course: courses.find((c) => c.id === b.dataset.course) })));
    $('#courseForm')?.addEventListener('submit', (e) => {
      e.preventDefault(); const f = e.target;
      const lessons = f.lessons.value.split('\n').map((s) => s.trim()).filter(Boolean).map((t) => ({ title: t, mins: 5, body: 'Contenido de la lección. Aquí va el video o el texto que suba el dueño.' }));
      store.customCourses.push({ id: 'cc' + Date.now(), title: f.title.value.trim(), level: 'Nuevo', lessons }); save();
      world.setKiosks(allCourses(), doneCount); logActivity(`Curso creado: ${f.title.value.trim()}`); toast('Curso creado', 'Ya está disponible para los miembros.'); renderCursos(body);
    });
  };
  const courseView = (c) => {
    const done = store.progress[c.id] || [];
    body.innerHTML = `
      <button class="link-back" id="back">${icon('back')} Todos los cursos</button>
      <h3>${esc(c.title)}</h3>
      <p class="muted">${done.length} de ${c.lessons.length} lecciones completadas</p>${bar(done.length / c.lessons.length)}
      <div class="list mt12">${c.lessons.map((l, i) => `
        <button class="list-item lesson ${done.includes(i) ? 'done' : ''}" data-lesson="${i}">
          <span class="num">${done.includes(i) ? icon('check') : i + 1}</span>
          <span class="grow"><b>${esc(l.title)}</b><span class="muted"> · ${l.mins} min</span></span>${icon('chev')}
        </button>`).join('')}
      </div>`;
    $('#back').addEventListener('click', () => view({}));
    $$('[data-lesson]', body).forEach((b) => b.addEventListener('click', () => view({ course: c, lesson: +b.dataset.lesson })));
  };
  const lessonView = (c, i) => {
    const l = c.lessons[i]; const done = store.progress[c.id] || [];
    body.innerHTML = `
      <button class="link-back" id="back">${icon('back')} ${esc(c.title)}</button>
      <div class="video-ph"><div class="play">${icon('play')}</div><span>Lección ${i + 1} · ${l.mins} min</span></div>
      <h3 class="mt12">${esc(l.title)}</h3>
      <p class="lesson-body">${esc(l.body)}</p>
      <div class="row gap mt12">
        <button class="btn ${done.includes(i) ? '' : 'primary'}" id="mark">${done.includes(i) ? `${icon('check')} Completada` : 'Marcar como completada'}</button>
        ${i < c.lessons.length - 1 ? `<button class="btn" id="next">Siguiente ${icon('chev')}</button>` : ''}
      </div>`;
    $('#back').addEventListener('click', () => view({ course: c }));
    $('#mark').addEventListener('click', () => {
      const arr = (store.progress[c.id] ||= []);
      if (!arr.includes(i)) { arr.push(i); save(); world.setKiosks(allCourses(), doneCount); if (arr.length === c.lessons.length) toast('¡Curso terminado!', `Completaste ${c.title}.`); }
      if (i < c.lessons.length - 1) view({ course: c, lesson: i + 1 }); else view({ course: c });
    });
    $('#next')?.addEventListener('click', () => view({ course: c, lesson: i + 1 }));
  };
  view(arg != null && courses[arg] ? { course: courses[arg] } : {});
}
const bar = (p) => `<div class="bar"><i style="width:${Math.round(p * 100)}%"></i></div>`;

// ============ videoteca ============
const uploads = [];
function renderVideoteca(body) {
  body.innerHTML = `
    <div id="player" class="video-ph"><div class="play">${icon('play')}</div><span>Elige una grabación</span></div>
    <div class="list mt12">
      ${uploads.map((u, i) => `<button class="list-item" data-up="${i}"><span class="thumb">${icon('play')}</span><span class="grow"><b>${esc(u.title)}</b><div class="muted">Subido por ti · ahora</div></span></button>`).join('')}
      ${RECORDINGS.map((r) => `<button class="list-item" data-rec="${r.id}"><span class="thumb">${icon('play')}</span><span class="grow"><b>${esc(r.title)}</b><div class="muted">${esc(r.host)} · ${r.date}</div></span><span class="pill">${r.mins} min</span></button>`).join('')}
    </div>
    <section class="card owner-only">
      <h4>Subir un video</h4>
      <p class="muted">Se reproduce aquí mismo. En producción se guarda en un almacenamiento de video y lo ven todos.</p>
      <label class="btn"><input type="file" accept="video/*" id="upload" hidden>Elegir archivo</label>
    </section>`;
  const player = $('#player');
  $$('[data-rec]', body).forEach((b) => b.addEventListener('click', () => {
    const r = RECORDINGS.find((x) => x.id === b.dataset.rec);
    player.innerHTML = `<div class="play">${icon('play')}</div><span><b>${esc(r.title)}</b> · ${r.mins} min</span><small>Grabación de ejemplo: aquí se reproduce la sesión grabada del aula.</small>`;
  }));
  $$('[data-up]', body).forEach((b) => b.addEventListener('click', () => { player.innerHTML = `<video src="${uploads[+b.dataset.up].url}" controls autoplay playsinline></video>`; }));
  $('#upload')?.addEventListener('change', (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    uploads.unshift({ title: f.name.replace(/\.[^.]+$/, ''), url: URL.createObjectURL(f) });
    world.setVideoteca(RECORDINGS.length + uploads.length);
    logActivity(`Video subido: ${f.name}`); renderVideoteca(body);
    $('#player').innerHTML = `<video src="${uploads[0].url}" controls autoplay playsinline></video>`;
  });
}

// ============ análisis ============
const an = { symbol: 'BTCUSDT', tf: '1h', last: null };
let wallRequest = 0;
export async function refreshWall(symbol = an.symbol, tf = an.tf) {
  const request = ++wallRequest;
  const candles = await getCandles(symbol, tf);
  const a = analyze(candles);
  const live = candlesAreLive(symbol, tf);
  const report = { symbol, tf, candles, a, live };
  if (request === wallRequest) {
    an.last = report;
    world.setChart({ candles, a, name: SYMBOLS[symbol].name, tf: TIMEFRAMES[tf], price: a.price, live, fmt: (v) => fmt(symbol, v) });
    agentReport(symbol, tf, a);
  }
  return report;
}

function renderAnalisis(body, selectedSymbol) {
  if (Object.hasOwn(SYMBOLS, selectedSymbol)) an.symbol = selectedSymbol;
  let charts = [];
  let series, currentData;
  let loadId = 0;
  body.innerHTML = `
    <div class="row gap wrap toolbar">
      <div class="seg" id="symSeg">${Object.entries(SYMBOLS).map(([k, v]) => `<button data-sym="${k}" class="${k === an.symbol ? 'on' : ''}">${v.short}</button>`).join('')}</div>
      <div class="seg" id="tfSeg">${Object.entries(TIMEFRAMES).map(([k, v]) => `<button data-tf="${k}" class="${k === an.tf ? 'on' : ''}">${v}</button>`).join('')}</div>
      <a class="btn sm ghost" id="tvLink" target="_blank" rel="noopener">Abrir en TradingView ↗</a>
    </div>
    <div class="an-grid">
      <div class="an-main">
        <div class="card chart-card"><div class="chart-head"><b id="anName"></b><span id="anPrice" class="mono"></span><span id="anTrend" class="pill"></span></div><p id="anStatus" class="analysis-state" role="status">Cargando mercado…</p><div id="chart" class="chart"></div><div id="rsiChart" class="chart rsi"></div></div>
        <div class="card"><h4>Agenda del día <span class="pill">ejemplo</span></h4>
          <div class="list">${AGENDA.map((e) => `<div class="list-item tight"><span class="mono muted">${e.time}</span><span class="grow">${esc(e.title)}</span><span class="pill imp-${e.impact}">${e.impact}</span></div>`).join('')}</div>
        </div>
      </div>
      <div class="an-side">
        <div class="card" id="levels"></div>
        <div class="grid2" id="scenarios"></div>
        <div class="card" id="risk"></div>
      </div>
    </div>
    <p class="hint">El análisis muestra si las velas provienen del mercado o de la simulación de Pulso. El piso no ejecuta operaciones.</p>`;

  const notice = body.querySelector('#anStatus');
  const load = async () => {
    const id = ++loadId;
    const { symbol, tf } = an;
    notice.textContent = 'Cargando mercado…';
    body.querySelector('#anName').textContent = `${SYMBOLS[symbol].name} · ${TIMEFRAMES[tf]}`;
    body.querySelector('#tvLink').href = `https://www.tradingview.com/chart/?symbol=BINANCE:${symbol}`;
    let report;
    try {
      report = await refreshWall(symbol, tf);
    } catch (error) {
      if (id !== loadId) return;
      console.error(error);
      notice.textContent = 'No se pudo cargar el análisis. Elige otro activo o intervalo.';
      return;
    }
    if (id !== loadId) return;
    currentData = report;
    const { candles, a, live } = report;
    const f = (v) => fmt(symbol, v);
    notice.textContent = live ? 'Velas de mercado' : 'Velas simuladas';
    body.querySelector('#anPrice').textContent = f(a.price);
    const trend = body.querySelector('#anTrend');
    trend.textContent = `Tendencia ${a.trend}`;
    trend.className = `pill trend-${a.trend}`;
    $('#levels').innerHTML = `
      <h4>Niveles <span class="muted">· agente Niveles</span></h4>
      <div class="lv"><span class="r">R2</span><b class="mono">${f(a.levels.r2)}</b></div>
      <div class="lv"><span class="r">R1</span><b class="mono">${f(a.levels.r1)}</b></div>
      <div class="lv now"><span>Precio</span><b class="mono">${f(a.price)}</b></div>
      <div class="lv"><span class="s">S1</span><b class="mono">${f(a.levels.s1)}</b></div>
      <div class="lv"><span class="s">S2</span><b class="mono">${f(a.levels.s2)}</b></div>
      <div class="row between mt8 muted"><span>RSI (14): <b class="mono">${a.rsi?.toFixed(1) ?? '—'}</b> ${a.rsiTxt}</span><span>ATR: <b class="mono">${f(a.atr)}</b></span></div>
      ${a.cross ? `<div class="pill ${a.cross === 'golden' ? 'trend-alcista' : 'trend-bajista'} mt8">${a.cross === 'golden' ? 'Cruce dorado reciente (50/200)' : 'Cruce de la muerte reciente (50/200)'}</div>` : ''}`;
    $('#scenarios').innerHTML = [['Alcista', a.bull, 'up'], ['Bajista', a.bear, 'down']].map(([n, s, k]) => `
      <div class="card scen ${k}">
        <h4>Escenario ${n.toLowerCase()}</h4>
        <div class="kv"><span>Entrada</span><b class="mono">${f(s.entry)}</b></div>
        <div class="kv"><span>Invalidez</span><b class="mono">${f(s.stop)}</b></div>
        <div class="kv"><span>Objetivo</span><b class="mono">${f(s.target)}</b></div>
        <div class="kv"><span>R:R</span><b class="mono">${(Math.abs(s.target - s.entry) / Math.abs(s.entry - s.stop)).toFixed(2)}</b></div>
        <button class="btn sm mt8" data-use="${k}">Usar en la calculadora</button>
      </div>`).join('');
    renderRisk(a, a.bull);
    $$('[data-use]', body).forEach((b) => b.addEventListener('click', () => renderRisk(a, b.dataset.use === 'up' ? a.bull : a.bear)));
    drawCharts(candles, a);
  };

  const drawCharts = (candles, a) => {
    charts.forEach((c) => c.remove()); charts = []; series = null;
    const LW = window.LightweightCharts;
    if (!LW) { $('#chart').innerHTML = '<p class="muted pad">No se pudo cargar la librería de gráficos.</p>'; return; }
    const base = {
      layout: { background: { color: 'transparent' }, textColor: '#8b95a7', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 },
      grid: { vertLines: { color: 'rgba(255,255,255,0.04)' }, horzLines: { color: 'rgba(255,255,255,0.04)' } },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)', minimumWidth: 84 },
      timeScale: { borderColor: 'rgba(255,255,255,0.08)', timeVisible: true },
      crosshair: { mode: 0 }, autoSize: true,
      localization: { priceFormatter: (p) => fmt(an.symbol, p) },
    };
    const ch = LW.createChart($('#chart'), base);
    const cs = ch.addCandlestickSeries({ upColor: '#4fd1a1', downColor: '#f06272', borderVisible: false, wickUpColor: '#4fd1a1', wickDownColor: '#f06272' });
    cs.setData(candles);
    const line = (arr, color) => { const s = ch.addLineSeries({ color, lineWidth: 2, priceLineVisible: false, lastValueVisible: false }); s.setData(candles.map((c, i) => (arr[i] == null ? null : { time: c.time, value: arr[i] })).filter(Boolean)); };
    line(a.series.s50, 'rgba(160,180,210,0.9)'); line(a.series.s200, 'rgba(217,191,140,0.9)');
    const pl = (price, title, color, style = 2) => cs.createPriceLine({ price, color, lineWidth: 1, lineStyle: style, axisLabelVisible: true, title });
    pl(a.levels.r2, 'R2', 'rgba(240,98,114,0.6)'); pl(a.levels.r1, 'R1', '#f06272'); pl(a.levels.s1, 'S1', '#4fd1a1'); pl(a.levels.s2, 'S2', 'rgba(79,209,161,0.6)');
    ch.timeScale().setVisibleLogicalRange({ from: candles.length - 120, to: candles.length + 4 });

    const rc = LW.createChart($('#rsiChart'), { ...base, timeScale: { ...base.timeScale, visible: false }, localization: {} });
    const rs = rc.addLineSeries({ color: '#d9bf8c', lineWidth: 2, priceLineVisible: false });
    rs.setData(candles.map((c, i) => (a.series.rsi[i] == null ? null : { time: c.time, value: a.series.rsi[i] })).filter(Boolean));
    rs.createPriceLine({ price: 70, color: 'rgba(240,98,114,0.6)', lineWidth: 1, lineStyle: 2, title: '70' });
    rs.createPriceLine({ price: 30, color: 'rgba(79,209,161,0.6)', lineWidth: 1, lineStyle: 2, title: '30' });
    rc.timeScale().setVisibleLogicalRange({ from: candles.length - 120, to: candles.length + 4 });
    ch.timeScale().subscribeVisibleLogicalRangeChange((r) => r && rc.timeScale().setVisibleLogicalRange(r));
    charts = [ch, rc];
    series = cs;
  };

  $$('#symSeg button', body).forEach((b) => b.addEventListener('click', () => { an.symbol = b.dataset.sym; $$('#symSeg button').forEach((x) => x.classList.toggle('on', x === b)); load(); }));
  $$('#tfSeg button', body).forEach((b) => b.addEventListener('click', () => { an.tf = b.dataset.tf; $$('#tfSeg button').forEach((x) => x.classList.toggle('on', x === b)); load(); }));
  const off = market.on((type, d) => {
    if (type !== 'tick' || d?.symbol !== an.symbol || !series || currentData?.symbol !== an.symbol || currentData?.tf !== an.tf) return;
    const k = currentData.candles.at(-1);
    k.close = d.price; k.high = Math.max(k.high, d.price); k.low = Math.min(k.low, d.price);
    series.update({ ...k });
    const el = $('#anPrice'); if (el) el.textContent = fmt(an.symbol, d.price);
  });
  load();
  const timer = setInterval(load, 60000);
  return () => {
    loadId++;
    off();
    clearInterval(timer);
    charts.forEach((chart) => chart.remove());
    series = null;
  };
}

function renderRisk(a, scen) {
  const el = $('#risk'); if (!el) return;
  const prev = { cap: +($('#rCap')?.value || 1000), pct: +($('#rPct')?.value || 1) };
  const dec = SYMBOLS[an.symbol].dec;
  el.innerHTML = `
    <h4>Calculadora de riesgo</h4>
    <div class="form calc">
      <div class="row gap"><label class="grow">Capital (USD)<input id="rCap" type="number" min="1" step="any" value="${prev.cap}"></label><label>Riesgo %<input id="rPct" type="number" min="0.1" max="100" step="0.1" value="${prev.pct}"></label></div>
      <div class="row gap"><label class="grow">Entrada<input id="rEn" type="number" step="any" value="${scen.entry.toFixed(dec)}"></label><label class="grow">Stop<input id="rSt" type="number" step="any" value="${scen.stop.toFixed(dec)}"></label><label class="grow">Objetivo<input id="rTp" type="number" step="any" value="${scen.target.toFixed(dec)}"></label></div>
    </div>
    <div class="calc-out" id="rOut"></div>`;
  const calc = () => {
    const cap = +$('#rCap').value, pct = +$('#rPct').value, en = +$('#rEn').value, st = +$('#rSt').value, tp = +$('#rTp').value;
    const risk = (cap * pct) / 100, dist = Math.abs(en - st);
    const out = $('#rOut');
    if (!cap || !pct || !en || !st || !dist) { out.innerHTML = '<p class="muted">Completa los campos.</p>'; return; }
    const size = risk / dist, notional = size * en, rr = Math.abs(tp - en) / dist, gain = size * Math.abs(tp - en);
    const side = tp > en ? 'Compra' : 'Venta';
    out.innerHTML = `
      <div><span>Lado</span><b>${side}</b></div>
      <div><span>Riesgo</span><b class="mono">${fmtNum(risk)} USD</b></div>
      <div><span>Tamaño</span><b class="mono">${fmtNum(size, size < 1 ? 4 : 2)} ${SYMBOLS[an.symbol].short}</b></div>
      <div><span>Valor de la posición</span><b class="mono">${fmtNum(notional)} USD</b></div>
      <div><span>Riesgo/beneficio</span><b class="mono ${rr >= 1.5 ? 'up' : 'warn'}">${rr.toFixed(2)} R</b></div>
      <div><span>Ganancia si llega</span><b class="mono up">+${fmtNum(gain)} USD</b></div>
      ${notional > cap ? `<p class="warn-t">La posición vale ${(notional / cap).toFixed(1)} veces tu capital: necesitarías apalancamiento.</p>` : ''}`;
  };
  $$('input', el).forEach((i) => i.addEventListener('input', calc));
  calc();
}

// ============ agentes ============
const agentState = Object.fromEntries(AGENTS.map((a) => [a.id, { status: 'En espera', line: a.role, busy: false }]));
const agentLog = [];
function setAgent(id, patch) { Object.assign(agentState[id], patch); world.setAgent(id, patch); if (currentPanel === 'agentes') renderAgentes($('#drawerBody')); }
function logAgent(agentId, text) {
  agentLog.unshift({ t: now(), agent: AGENTS.find((a) => a.id === agentId), text });
  agentLog.length = Math.min(agentLog.length, 40);
}
function startAgents() {
  setAgent('a4', { status: 'Agenda lista', line: `${AGENDA.length} eventos hoy · ${AGENDA[0].time} ${AGENDA[0].title}` });
  logAgent('a4', `Agenda del día: ${AGENDA.map((e) => `${e.time} ${e.title}`).join(' · ')}`);
}
function agentReport(symbol, tf, a) {
  const n = SYMBOLS[symbol].name, f = (v) => fmt(symbol, v);
  setAgent('a1', { status: `${n} · ${TIMEFRAMES[tf]}`, line: `R1 ${f(a.levels.r1)} · S1 ${f(a.levels.s1)}` });
  setAgent('a2', { status: `Tendencia ${a.trend}`, line: `RSI ${a.rsi?.toFixed(0) ?? '—'} · MM50 ${f(a.sma50)}` });
  setAgent('a3', { status: 'Escenarios listos', line: `↑ ${f(a.bull.entry)} → ${f(a.bull.target)} · ↓ ${f(a.bear.entry)} → ${f(a.bear.target)}` });
  logAgent('a1', `Niveles en ${n} ${TIMEFRAMES[tf]}: R1 ${f(a.levels.r1)}, S1 ${f(a.levels.s1)}.`);
  logAgent('a2', `${n}: tendencia ${a.trend}, RSI ${a.rsi?.toFixed(1)} ${a.rsiTxt}.`);
  logAgent('a3', `${n}: alcista sobre ${f(a.bull.entry)} con objetivo ${f(a.bull.target)}; bajista bajo ${f(a.bear.entry)} con objetivo ${f(a.bear.target)}.`);
}

async function runTask(agentId, text) {
  const sym = Object.keys(SYMBOLS).find((s) => new RegExp(`\\b(${SYMBOLS[s].short}|${s.replace('USDT', '')})\\b`, 'i').test(text) || (s === 'PAXGUSDT' && /oro|gold/i.test(text))) || 'BTCUSDT';
  const tf = Object.keys(TIMEFRAMES).find((t) => new RegExp(`\\b${t}\\b`, 'i').test(text)) || '1h';
  setAgent(agentId, { busy: true, status: 'Trabajando…', line: text });
  logAgent(agentId, `Tarea recibida: “${text}”`);
  await new Promise((r) => setTimeout(r, 2500 + Math.random() * 2500));
  if (agentId === 'a4') {
    setAgent(agentId, { busy: false, status: 'Tarea completada', line: `Eventos de impacto alto: ${AGENDA.filter((e) => e.impact === 'alto').map((e) => e.time).join(', ')}` });
    logAgent(agentId, `Revisé la agenda: ${AGENDA.filter((e) => e.impact === 'alto').map((e) => `${e.time} ${e.title}`).join(' · ')} (ejemplo).`);
  } else {
    const a = analyze(await getCandles(sym, tf));
    const f = (v) => fmt(sym, v), n = `${SYMBOLS[sym].name} ${TIMEFRAMES[tf]}`;
    const res = {
      a1: `${n}: R2 ${f(a.levels.r2)}, R1 ${f(a.levels.r1)}, S1 ${f(a.levels.s1)}, S2 ${f(a.levels.s2)}.`,
      a2: `${n}: tendencia ${a.trend}, RSI ${a.rsi?.toFixed(1)} ${a.rsiTxt}, MM50 ${f(a.sma50)}, MM200 ${f(a.sma200)}.`,
      a3: `${n}: alcista ${f(a.bull.entry)} → ${f(a.bull.target)} (stop ${f(a.bull.stop)}); bajista ${f(a.bear.entry)} → ${f(a.bear.target)} (stop ${f(a.bear.stop)}).`,
    }[agentId];
    setAgent(agentId, { busy: false, status: 'Tarea completada', line: res });
    logAgent(agentId, res);
  }
  toast(`Agente ${AGENTS.find((x) => x.id === agentId).name}`, 'Terminó la tarea. El resultado está en el piso de agentes.');
  if (currentPanel === 'agentes') renderAgentes($('#drawerBody'));
}

function renderAgentes(body) {
  body.innerHTML = `
    <div class="grid2">${AGENTS.map((a) => { const s = agentState[a.id]; return `
      <div class="card agent" style="--c:${a.color}">
        <div class="row between"><b>${a.name}</b><span class="dot ${s.busy ? 'busy' : ''}"></span></div>
        <span class="muted">${a.role}</span>
        <div class="agent-status">${esc(s.status)}</div>
        <div class="agent-line mono">${esc(s.line)}</div>
      </div>`; }).join('')}
    </div>
    <section class="card owner-only">
      <h4>Dar una tarea</h4>
      <form id="taskForm" class="form">
        <label>Agente<select name="agent">${AGENTS.map((a) => `<option value="${a.id}">${a.name} · ${a.role}</option>`).join('')}</select></label>
        <label>Tarea<input name="task" required maxlength="120" placeholder="Ej.: niveles de ETH en 4h"></label>
        <div class="chips">${['Niveles de ETH en 4h', 'Tendencia del oro en 1d', 'Escenarios de SOL en 1h', 'Eventos de hoy'].map((t) => `<button type="button" class="chip" data-task="${t}">${t}</button>`).join('')}</div>
        <button class="btn primary">Enviar tarea</button>
      </form>
    </section>
    <p class="hint member-only">Ves el trabajo de los agentes, pero solo el dueño les da tareas.</p>
    <h4 class="section-t">Registro</h4>
    <div class="log">${agentLog.map((l) => `<div class="log-row"><span class="mono muted">${l.t}</span><span class="tag" style="--c:${l.agent.color}">${l.agent.name}</span><span>${esc(l.text)}</span></div>`).join('') || '<p class="muted">Sin actividad todavía.</p>'}</div>`;
  const f = $('#taskForm');
  $$('[data-task]', body).forEach((c) => c.addEventListener('click', () => {
    f.task.value = c.dataset.task;
    f.agent.value = /evento/i.test(c.dataset.task) ? 'a4' : /tendencia/i.test(c.dataset.task) ? 'a2' : /escenario/i.test(c.dataset.task) ? 'a3' : 'a1';
  }));
  f?.addEventListener('submit', (e) => { e.preventDefault(); runTask(f.agent.value, f.task.value.trim()); f.task.value = ''; });
}

// ============ alertas ============
const ALERT_TYPES = { price_above: 'El precio sube sobre', price_below: 'El precio baja de', rsi_above: 'RSI (14) sube sobre', rsi_below: 'RSI (14) baja de' };
const alertText = (a) => `${SYMBOLS[a.symbol].short} · ${ALERT_TYPES[a.type]} ${a.type.startsWith('rsi') ? a.value : fmt(a.symbol, a.value)}${a.type.startsWith('rsi') ? ` · ${TIMEFRAMES[a.tf]}` : ''}`;
function syncAlertTower() { world.setAlerts(store.alerts.map((a) => ({ text: alertText(a), active: a.active }))); }

function fillAutoAlerts() {
  let changed = false;
  for (const a of store.alerts) if (a.auto && !a.value && market.prices[a.symbol]) { a.value = +(market.prices[a.symbol] * a.auto).toFixed(SYMBOLS[a.symbol].dec); changed = true; }
  if (changed) { save(); syncAlertTower(); }
}
function fire(a, detail) {
  store.alertLog.unshift({ t: now(), text: alertText(a), detail }); store.alertLog.length = Math.min(store.alertLog.length, 30); save();
  toast('Alerta cumplida', `${alertText(a)} · ${detail}`, 'alert');
  if (currentPanel === 'alertas') renderAlertas($('#drawerBody'));
}
function checkPriceAlerts(symbol, price, prev) {
  fillAutoAlerts();
  if (prev == null) return;
  for (const a of store.alerts) {
    if (!a.active || a.symbol !== symbol || !a.value) continue;
    if (a.type === 'price_above' && prev < a.value && price >= a.value) fire(a, `precio ${fmt(symbol, price)}`);
    if (a.type === 'price_below' && prev > a.value && price <= a.value) fire(a, `precio ${fmt(symbol, price)}`);
  }
}
const rsiPrev = {};
async function checkRsiAlerts() {
  for (const a of store.alerts.filter((x) => x.active && x.type.startsWith('rsi'))) {
    const r = analyze(await getCandles(a.symbol, a.tf)).rsi;
    const key = a.id, p = rsiPrev[key]; rsiPrev[key] = r;
    a.lastRsi = r;
    if (p == null) continue;
    if (a.type === 'rsi_above' && p < a.value && r >= a.value) fire(a, `RSI ${r.toFixed(1)}`);
    if (a.type === 'rsi_below' && p > a.value && r <= a.value) fire(a, `RSI ${r.toFixed(1)}`);
  }
  if (currentPanel === 'alertas') renderAlertas($('#drawerBody'));
}

function renderAlertas(body) {
  fillAutoAlerts();
  body.innerHTML = `
    <div class="list">${store.alerts.map((a) => `
      <div class="list-item">
        <span class="dot ${a.active ? '' : 'off'}"></span>
        <span class="grow"><b>${esc(alertText(a))}</b><div class="muted">${a.type.startsWith('rsi') ? `RSI actual: ${a.lastRsi != null ? a.lastRsi.toFixed(1) : 'calculando…'}` : `Precio actual: ${fmt(a.symbol, market.prices[a.symbol])}`}</div></span>
        <button class="btn sm" data-toggle="${a.id}">${a.active ? 'Pausar' : 'Activar'}</button>
        <button class="btn sm ghost icon-only" data-del="${a.id}" aria-label="Borrar">${icon('trash')}</button>
      </div>`).join('') || '<p class="muted">No tienes alertas.</p>'}
    </div>
    <section class="card">
      <h4>Nueva alerta</h4>
      <form id="alertForm" class="form">
        <div class="row gap">
          <label class="grow">Activo<select name="symbol">${Object.entries(SYMBOLS).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join('')}</select></label>
          <label class="grow">Temporalidad<select name="tf">${Object.entries(TIMEFRAMES).map(([k, v]) => `<option value="${k}" ${k === '1h' ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        </div>
        <div class="row gap">
          <label class="grow">Condición<select name="type">${Object.entries(ALERT_TYPES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
          <label class="grow">Valor<input name="value" type="number" step="any" required></label>
        </div>
        <button class="btn primary">Crear alerta</button>
      </form>
      <p class="hint">Las alertas de precio se revisan con cada precio en vivo y las de RSI, cada minuto. En producción también llegan por webhook desde TradingView.</p>
    </section>
    <h4 class="section-t">Historial</h4>
    <div class="log">${store.alertLog.map((l) => `<div class="log-row"><span class="mono muted">${l.t}</span><span>${esc(l.text)} · ${esc(l.detail)}</span></div>`).join('') || '<p class="muted">Ninguna alerta se ha cumplido todavía.</p>'}</div>`;
  const f = $('#alertForm');
  const suggest = () => { const p = market.prices[f.symbol.value]; f.value.value = f.type.value.startsWith('rsi') ? (f.type.value === 'rsi_above' ? 70 : 30) : p ? (+p).toFixed(SYMBOLS[f.symbol.value].dec) : ''; };
  f.symbol.addEventListener('change', suggest); f.type.addEventListener('change', suggest); suggest();
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    store.alerts.unshift({ id: 'al' + Date.now(), symbol: f.symbol.value, type: f.type.value, value: +f.value.value, tf: f.tf.value, active: true });
    save(); syncAlertTower(); toast('Alerta creada', alertText(store.alerts[0])); renderAlertas(body); checkRsiAlerts();
  });
  $$('[data-toggle]', body).forEach((b) => b.addEventListener('click', () => { const a = store.alerts.find((x) => x.id === b.dataset.toggle); a.active = !a.active; save(); syncAlertTower(); renderAlertas(body); }));
  $$('[data-del]', body).forEach((b) => b.addEventListener('click', () => { store.alerts = store.alerts.filter((x) => x.id !== b.dataset.del); save(); syncAlertTower(); renderAlertas(body); }));
}

// ============ conexiones ============
function logActivity(text) { store.activity.unshift({ t: now(), text }); store.activity.length = Math.min(store.activity.length, 30); save(); }
function renderConexiones(body) {
  const age = market.lastTick ? Math.round((Date.now() - market.lastTick) / 1000) : null;
  body.innerHTML = `
    <div class="card conn">
      <div class="row between"><b>Proveedor de precios</b><span class="pill ${market.status === 'en vivo' ? 'ok' : 'warn'}">${market.status === 'en vivo' ? 'En vivo' : market.status === 'simulado' ? 'Simulado' : 'Conectando'}</span></div>
      <p class="muted">Binance, datos públicos de mercado (no necesita clave). ${age != null ? `Último precio hace ${age} s.` : ''}</p>
    </div>
    <div class="card conn">
      <div class="row between"><b>TradingView · alertas por webhook</b><span class="pill ${store.connections.tradingview ? 'ok' : ''}">${store.connections.tradingview ? 'Recibiendo' : 'Apagado'}</span></div>
      <p class="muted">En TradingView, crea una alerta y pega esta URL en “Webhook”.</p>
      <code class="code">https://tu-dominio.com/api/webhooks/tradingview?token=••••••</code>
      <pre class="code">{ "ticker": "{{ticker}}", "price": {{close}}, "msg": "{{strategy.order.comment}}" }</pre>
      <div class="row gap"><button class="btn primary sm" id="testHook">Enviar alerta de prueba</button><button class="btn sm" id="toggleTv">${store.connections.tradingview ? 'Apagar' : 'Encender'}</button></div>
    </div>
    <div class="card conn">
      <div class="row between"><b>Exchange · saldos</b><span class="pill ${store.connections.exchange ? 'ok' : ''}">${store.connections.exchange ? 'Conectado' : 'Sin conectar'}</span></div>
      <p class="muted">Usa una clave de solo lectura: puede ver saldos y precios, pero no operar ni retirar.</p>
      <button class="btn sm" id="toggleEx">${store.connections.exchange ? 'Desconectar' : 'Conectar (demo)'}</button>
      <p class="hint">En esta demo no se piden claves. En producción la clave se guarda cifrada en el servidor, nunca en el navegador.</p>
    </div>
    <h4 class="section-t">Actividad</h4>
    <div class="log">${store.activity.map((l) => `<div class="log-row"><span class="mono muted">${l.t}</span><span>${esc(l.text)}</span></div>`).join('') || '<p class="muted">Sin actividad.</p>'}</div>`;
  $('#testHook').addEventListener('click', () => {
    const p = market.prices.BTCUSDT;
    logActivity(`Alerta recibida de TradingView: BTCUSDT ${fmt('BTCUSDT', p)}`);
    logAgent('a1', `Webhook de TradingView: BTCUSDT a ${fmt('BTCUSDT', p)}. Reviso niveles.`);
    toast('Webhook recibido', `TradingView · BTCUSDT ${fmt('BTCUSDT', p)}`, 'alert');
    refreshWall('BTCUSDT', '1h');
    renderConexiones(body);
  });
  $('#toggleTv').addEventListener('click', () => { store.connections.tradingview = !store.connections.tradingview; save(); logActivity(`Webhook de TradingView ${store.connections.tradingview ? 'encendido' : 'apagado'}`); renderConexiones(body); });
  $('#toggleEx').addEventListener('click', () => { store.connections.exchange = !store.connections.exchange; save(); logActivity(store.connections.exchange ? 'Exchange conectado (solo lectura)' : 'Exchange desconectado'); renderConexiones(body); });
}

// ============ miembros ============
function renderMiembros(body) {
  const rows = [{ name: `${store.profile?.name || 'Tú'} (tú)`, color: store.profile?.color, role: 'dueño', zone: world.currentZone, floor: world.floor }, ...world.npcs.map((n) => ({ name: n.name, color: n.color, role: n.member.role, zone: world.zoneOf(n), floor: n.floor }))];
  body.innerHTML = `
    <p class="muted">${rows.length} personas en el piso ahora.</p>
    <div class="list">${rows.map((r) => `
      <div class="list-item"><div class="avatar-dot" style="--c:${r.color}">${esc(r.name[0])}</div>
      <span class="grow"><b>${esc(r.name)}</b><div class="muted">Piso ${r.floor} · ${r.zone ? `en ${r.zone.id.startsWith('kiosk') ? 'los cursos' : r.zone.label.toLowerCase()}` : 'paseando'}</div></span><span class="pill">${r.role}</span></div>`).join('')}
    </div>
    <section class="card"><h4>Invitar</h4><p class="muted">Comparte el enlace del piso con tu comunidad.</p><button class="btn sm" id="copyLink">Copiar enlace</button></section>`;
  $('#copyLink').addEventListener('click', async () => { try { await navigator.clipboard.writeText(location.href); toast('Enlace copiado', ''); } catch { toast('No se pudo copiar', location.href); } });
}

// ============ chat de proximidad ============
// ============ pisos y vistas ============
function paintFloor(number) {
  const floor = FLOORS.find(({ n }) => n === number);
  $('#app').style.setProperty('--level-color', floor.color);
  $('#floorLevel').textContent = `Piso ${floor.n}`;
  $('#floorName').textContent = floor.name;
  $('#floorDetail').textContent = floor.description;
  for (const button of $$('#floors [data-floor]')) {
    const selected = Number(button.dataset.floor) === number;
    button.classList.toggle('on', selected);
    if (selected) button.setAttribute('aria-current', 'location');
    else button.removeAttribute('aria-current');
  }
}
export function onFloor(number) {
  paintFloor(number);
  const fade = $('#fade');
  fade.classList.remove('go');
  void fade.offsetWidth;
  fade.classList.add('go');
  if (currentPanel === 'piso') openPanel('piso');
  else if (currentPanel && !['cursos', 'alertas', 'conexiones', 'miembros'].includes(currentPanel)) closePanel();
}
export function onView(view) {
  for (const button of $$('#viewSwitch [data-view]')) {
    const selected = button.dataset.view === view;
    button.classList.toggle('on', selected);
    button.setAttribute('aria-pressed', String(selected));
    if (selected) $('#cameraName').textContent = button.textContent.trim();
  }
}

// ============ conferencia ============
function renderConferencia(body) {
  const onStage = world.currentZone?.id === 'tarima';
  body.innerHTML = `
    <section class="card class-card">
      <div class="row between"><span class="pill ${onStage ? 'live' : ''}">${onStage ? '● En la tarima' : 'En la audiencia'}</span><span class="muted">${world.floorNpcs().length} asistentes</span></div>
      <h3 class="mt8">Conferencia</h3>
      <p class="muted">${onStage ? 'Estás en la tarima. Lo que escribas en el chat lo escucha toda la audiencia.' : 'Sube a la tarima para hablarle a la audiencia sentada.'}</p>
      <div id="classSlide" class="slide">${slideHtml()}</div>
      <div class="row gap mt12 wrap">
        ${onStage ? '' : '<button class="btn primary" id="goStage">Subir a la tarima</button>'}
        <button class="btn" id="cPrev" aria-label="Anterior">${icon('back')}</button>
        <button class="btn" id="cNext" aria-label="Siguiente">${icon('chev')}</button>
        <button class="btn" id="cClap">👏 Aplausos</button>
      </div>
    </section>
    <section class="card owner-only">
      <h4>Compartir pantalla en la conferencia</h4>
      <p class="muted">Tu pantalla aparece en la pantalla gigante detrás de la tarima.</p>
      <button class="btn ${screenStream ? 'danger' : 'primary'}" id="shareBtn">${icon('screen')} ${screenStream ? 'Dejar de compartir' : 'Compartir pantalla'}</button>
    </section>
    <p class="hint">Consejo: cambia a primera persona (tecla V) para ver a la audiencia desde el escenario.</p>`;
  $('#goStage')?.addEventListener('click', () => visit('tarima'));
  $('#cPrev').addEventListener('click', () => { cls.manual = true; cls.index = (cls.index - 1 + SLIDES.length) % SLIDES.length; pushSlide(); });
  $('#cNext').addEventListener('click', () => { cls.manual = true; cls.index = (cls.index + 1) % SLIDES.length; pushSlide(); });
  $('#cClap').addEventListener('click', () => world.applause('👏'));
  $('#shareBtn')?.addEventListener('click', toggleShare);
}

// ============ sala de juegos ============
let gameTimer = 0;
function renderJuegos(body, arg) {
  const games = [
    ['vela', 'Sube o baja', gameVela], ['reflejos', 'Reflejos', gameReflejos], ['memoria', 'Memoria', memoryGame],
  ];
  let game = games[arg]?.[0] ?? 'vela', cleanup;
  store.games ||= { vela: 0, reflejos: 0 };
  const clearGame = () => { clearInterval(gameTimer); cleanup?.(); cleanup = null; };
  const paint = () => {
    clearGame();
    body.innerHTML = `<div class="seg floor-seg" aria-label="Juegos" role="group">${games.map(([id, label]) =>
      `<button type="button" data-g="${id}" aria-pressed="${game === id}">${label}</button>`).join('')}</div><div id="gbox" class="gbox"></div>`;
    for (const button of body.querySelectorAll('[data-g]')) {
      button.addEventListener('click', () => {
        if (game === button.dataset.g) return;
        game = button.dataset.g;
        paint();
        body.querySelector('[aria-pressed="true"]').focus();
      });
    }
    const onClose = games.find(([id]) => id === game)[2](body.querySelector('#gbox'));
    if (typeof onClose === 'function') cleanup = onClose;
  };
  paint();
  return clearGame;
}

function gameVela(box) {
  const g = store.games; let streak = 0, data = null, answered = false, active = true;
  box.innerHTML = `<p class="muted">Mira el gráfico y adivina si el precio estará más arriba o más abajo tres velas después.</p>
    <div class="row between"><b id="vSym">Cargando velas…</b><span class="muted">Racha: <b id="vStreak">0</b> · Récord: <b id="vBest">${g.vela}</b></span></div>
    <canvas id="vCv" width="460" height="220" class="vcv"></canvas>
    <p id="vMsg" class="vmsg" role="status"></p>
    <div class="row gap"><button class="btn primary grow" data-a="up" disabled>▲ Sube</button><button class="btn grow" data-a="down" disabled>▼ Baja</button><button class="btn" id="vNext" hidden>Siguiente</button></div>`;
  const cv = $('#vCv', box), ctx = cv.getContext('2d');
  const choices = $$('[data-a]', box);
  const message = $('#vMsg', box);
  const nextButton = $('#vNext', box);
  const draw = (candles, mark) => {
    ctx.clearRect(0, 0, cv.width, cv.height);
    const hi = Math.max(...candles.map((k) => k.high)), lo = Math.min(...candles.map((k) => k.low)), cw = cv.width / (candles.length + 1);
    const y = (v) => 10 + ((hi - v) / (hi - lo)) * (cv.height - 20);
    candles.forEach((k, i) => {
      const col = k.close >= k.open ? '#4fd1a1' : '#f06272', x = (i + 0.5) * cw + 4;
      ctx.strokeStyle = col; ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, y(k.high)); ctx.lineTo(x, y(k.low)); ctx.stroke();
      const t = y(Math.max(k.open, k.close)); ctx.fillRect(x - cw * 0.32, t, cw * 0.64, Math.max(2, y(Math.min(k.open, k.close)) - t));
      if (mark != null && i === mark) { ctx.fillStyle = 'rgba(217,191,140,.12)'; ctx.fillRect(x - cw / 2, 0, cv.width, cv.height); }
    });
  };
  const next = async () => {
    answered = false;
    data = null;
    message.textContent = 'Cargando una ronda…';
    nextButton.hidden = true;
    choices.forEach((button) => { button.disabled = true; });
    const symbols = Object.keys(SYMBOLS);
    const sym = symbols[Math.floor(Math.random() * symbols.length)];
    const c = await getCandles(sym, '1h', 300);
    if (!active) return;
    if (c.length < 43) {
      message.textContent = 'No hay suficientes velas. Intenta otra ronda.';
      nextButton.hidden = false;
      return;
    }
    const i = 40 + Math.floor(Math.random() * (c.length - 42));
    data = { view: c.slice(i - 40, i), next: c.slice(i, i + 3) };
    $('#vSym', box).textContent = `${SYMBOLS[sym].name} · ${candlesAreLive(sym, '1h') ? 'mercado' : 'simulado'}`;
    message.textContent = '';
    choices.forEach((button) => { button.disabled = false; });
    draw(data.view);
  };
  choices.forEach((b) => b.addEventListener('click', () => {
    if (answered || !data) return; answered = true;
    const last = data.view[data.view.length - 1].close, end = data.next[2].close, up = end > last;
    const ok = (b.dataset.a === 'up') === up; streak = ok ? streak + 1 : 0;
    if (streak > g.vela) { g.vela = streak; save(); }
    draw([...data.view, ...data.next], data.view.length);
    message.innerHTML = `${ok ? '<b class="up">¡Acertaste!</b>' : '<b class="down">Fallaste.</b>'} El precio ${up ? 'subió' : 'bajó'} ${(Math.abs(end - last) / last * 100).toFixed(2)} %.`;
    $('#vStreak', box).textContent = streak; $('#vBest', box).textContent = g.vela; nextButton.hidden = false;
    choices.forEach((x) => (x.disabled = true));
  }));
  nextButton.addEventListener('click', next);
  next();
  return () => { active = false; };
}

function gameReflejos(box) {
  const g = store.games; let score = 0, left = 30, on = false;
  box.innerHTML = `<p class="muted">Pulsa los círculos lo más rápido que puedas durante 30 segundos.</p>
    <div class="row between"><span>Puntos: <b id="rS">0</b></span><span id="rT" class="muted">30 s</span><span class="muted">Récord: <b id="rB">${g.reflejos}</b></span></div>
    <div id="arena" class="arena"></div><button class="btn primary mt12" id="rGo">Empezar</button>`;
  const arena = $('#arena');
  const spawn = (keyboard = arena.contains(document.activeElement)) => {
    arena.innerHTML = ''; if (!on) return;
    const t = document.createElement('button'); t.className = 'tgt'; t.setAttribute('aria-label', 'Objetivo');
    t.style.left = Math.random() * (arena.clientWidth - 48) + 'px'; t.style.top = Math.random() * (arena.clientHeight - 48) + 'px';
    t.addEventListener('click', (event) => { score++; $('#rS', box).textContent = score; spawn(event.detail === 0); });
    arena.appendChild(t);
    if (keyboard) t.focus({ preventScroll: true });
  };
  $('#rGo', box).addEventListener('click', (event) => {
    clearInterval(gameTimer);
    score = 0; left = 30; on = true;
    $('#rS', box).textContent = 0;
    $('#rT', box).textContent = '30 s';
    $('#rGo', box).disabled = true;
    spawn(event.detail === 0);
    gameTimer = setInterval(() => {
      left--; $('#rT').textContent = left + ' s';
      if (left <= 0) {
        clearInterval(gameTimer); on = false; arena.innerHTML = `<div class="vmsg" style="padding:24px">Terminaste con <b>${score}</b> puntos.</div>`; $('#rGo').disabled = false; $('#rGo').textContent = 'Jugar de nuevo';
        if (score > g.reflejos) { g.reflejos = score; save(); $('#rB').textContent = score; toast('¡Nuevo récord!', `${score} puntos en Reflejos`); }
      } else if (left % 2 === 0) spawn();
    }, 1000);
  });
}

const CHAT_RADIUS = 8;
function initChat(compact) {
  const form = $('#chatForm'), input = $('#chatInput');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim(); if (!text) return;
    input.value = '';
    world.say(world.me, text);
    addMsg({ name: store.profile?.name || 'Tú', color: store.profile?.color, me: true }, text);
    if (world.currentZone?.id === 'tarima') { // desde la tarima te oye toda la audiencia
      world.floorNpcs().sort(() => Math.random() - 0.5).slice(0, 4).forEach((n, i) => setTimeout(() => {
        const line = AUDIENCE_REPLIES[(Math.random() * AUDIENCE_REPLIES.length) | 0];
        world.say(n, line); if (i === 0) addMsg(n, line);
      }, 900 + i * 700 + Math.random() * 600));
      return;
    }
    const near = world.nearby(CHAT_RADIUS);
    if (!near.length) { setTimeout(() => addSys('Nadie te escucha. Acércate a alguien para conversar.'), 400); return; }
    const low = text.toLowerCase();
    const match = NPC_REPLIES.find((r) => r.k.some((k) => low.includes(k)));
    const pool = [...(match ? match.r : NPC_GENERIC)].sort(() => Math.random() - 0.5);
    near.slice(0, match ? 2 : 1).forEach((n, i) => {
      if (!match && Math.random() < 0.35) return;
      setTimeout(() => {
        const line = pool[i % pool.length];
        world.say(n, line);
        if (world.distanceTo(n) < CHAT_RADIUS) addMsg(n, line);
      }, 1200 + i * 1400 + Math.random() * 800);
    });
  });
  const toggle = $('#chatToggle');
  const chat = $('#chat');
  function setChat(open) {
    chat.classList.toggle('collapsed', !open);
    toggle.setAttribute('aria-expanded', String(open));
  }
  setChat(!compact);
  toggle.addEventListener('click', () => setChat(chat.classList.contains('collapsed')));
  if (innerWidth < 760) $('#chat').classList.add('collapsed');
  setInterval(() => {
    const near = world.nearby(CHAT_RADIUS);
    $('#nearby').innerHTML = near.length ? near.slice(0, 5).map((n) => `<span class="avatar-dot xs" style="--c:${n.color}" title="${esc(n.name)}">${esc(n.name[0])}</span>`).join('') + `<span class="muted">${near.length} cerca</span>` : '<span class="muted">Nadie cerca</span>';
  }, 800);
  addSys('Habla con quien tengas cerca. Camina con WASD o haz clic en el suelo.');
}
export function onChat(npc, text, d) { if (d < CHAT_RADIUS) addMsg(npc, text); }
function addMsg(who, text) {
  const list = $('#chatList');
  const el = document.createElement('div');
  el.className = 'msg' + (who.me ? ' me' : '');
  el.innerHTML = `<span class="who" style="color:${who.color}">${esc(who.name)}</span><span>${esc(text)}</span>`;
  list.appendChild(el);
  while (list.children.length > 60) list.firstChild.remove();
  list.scrollTop = list.scrollHeight;
}
function addSys(text) { const el = document.createElement('div'); el.className = 'msg sys'; el.textContent = text; $('#chatList').appendChild(el); $('#chatList').scrollTop = 1e9; }

// ============ ticker, estado, toasts ============
function renderTicker() {
  const items = Object.entries(SYMBOLS).map(([k, v]) => ({ k, label: v.short, price: fmt(k, market.prices[k]), chg: market.change[k] ?? 0 }));
  $('#ticker').innerHTML = items.map((i) => `<span class="tk"><b>${i.label}</b><span class="mono">${i.price}</span><span class="mono ${i.chg >= 0 ? 'up' : 'down'}">${i.chg >= 0 ? '+' : ''}${i.chg.toFixed(2)}%</span></span>`).join('');
  world.setTicker(items);
  if (an.last && market.prices[an.last.symbol]) world.updatePrice(market.prices[an.last.symbol]);
}
function renderStatus() {
  const s = market.status;
  $('#liveStatus').className = `status ${s === 'en vivo' ? 'ok' : s === 'simulado' ? 'warn' : ''}`;
  const label = s === 'en vivo' ? 'En vivo' : s === 'simulado' ? 'Simulado' : 'Conectando';
  $('#liveStatus').title = label;
  $('#marketSource').textContent = label;
}
export function toast(title, body = '', kind = '') {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.innerHTML = `<b>${esc(title)}</b>${body ? `<span>${esc(body)}</span>` : ''}`;
  $('#toasts').appendChild(el);
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 300); }, kind === 'alert' ? 7000 : 3800);
}
