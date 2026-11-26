// Interfaz del campus: barra superior, modos de control, acceso rápido, minimapa y editor de lugares.
import { createCampus, CONTROL_MODES, getControlMode, setControlMode } from './campus.js';
import { BUILDINGS, PLACE_COLORS, MAX_PLACES, loadPlaces, savePlaces, newPlaceId } from './campus-data.js';
import { store, save } from './store.js';

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isOwner = () => store.role === 'dueno';
const safeUrl = (u) => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : ''; } catch { return ''; } };

let campus = null, root = null, places = [], editing = null, status = '';

export function hasCampus() { return Boolean(campus); }
export function pauseCampus(v) { campus?.setPaused(v); }
export function returnToCampus() {
  let id = null; try { id = sessionStorage.getItem('pulso:spawn'); } catch { /* ignorar */ }
  if (id && campus) campus.teleport(id);
}

export async function mountCampus(el, { profile = {}, toast = () => {} } = {}) {
  const name = profile.name || 'Visitante';
  root = el;
  root.innerHTML = `
    <div class="cmp-world" id="cmpWorld"></div>
    <header class="cmp-top">
      <a class="logo" href="#/" aria-label="Inicio de Pulso"><span class="logo-mark"></span><span class="hide-sm">Pulso</span></a>
      <div class="cmp-title"><b>Campus</b><small id="cmpWho"></small></div>
      <div class="seg cmp-modes" id="cmpModes" role="group" aria-label="Modo de control">${Object.entries(CONTROL_MODES).map(([k, v]) => `<button type="button" data-mode="${k}" aria-pressed="false" title="${v.label}"><span aria-hidden="true">${v.icon}</span><span class="cmp-lab">${v.label}</span></button>`).join('')}</div>
      <div class="seg cmp-role" id="cmpRole" role="group" aria-label="Rol"><button type="button" data-role="dueno">Dueño</button><button type="button" data-role="miembro">Miembro</button></div>
      <button class="btn sm" id="cmpPlacesBtn" type="button" aria-controls="cmpPanel" aria-expanded="false">Lugares</button>
    </header>
    <nav class="cmp-quick" id="cmpQuick" aria-label="Acceso rápido a los edificios"></nav>
    <aside class="cmp-map" aria-label="Mapa del campus"><canvas id="cmpMap" width="180" height="180" aria-label="Mapa del campus. Toca un punto para caminar hasta allí."></canvas></aside>
    <div class="cmp-prompt" id="cmpPrompt" hidden><div><b id="cmpPName"></b><small id="cmpPDetail"></small></div><button class="btn primary" id="cmpEnter" type="button">Entrar</button></div>
    <p class="cmp-help" id="cmpHelp" role="status"></p>
    <aside class="cmp-panel" id="cmpPanel" hidden aria-labelledby="cmpPanelTitle"><header><h2 id="cmpPanelTitle">Lugares del campus</h2><button class="btn ghost sm" id="cmpPanelX" type="button" aria-label="Cerrar">✕</button></header><div id="cmpPanelBody"></div></aside>`;
  $('#cmpWho', root).textContent = name;
  const loading = document.createElement('div'); loading.className = 'cmp-load'; loading.textContent = 'Armando el campus…'; $('#cmpWorld', root).appendChild(loading);

  campus = createCampus($('#cmpWorld', root), {
    me: profile,
    onEnter: (t) => enter(t),
    onNear: (t) => {
      const p = $('#cmpPrompt', root); p.hidden = !t;
      if (t) { $('#cmpPName', p).textContent = t.label; $('#cmpPDetail', p).textContent = t.detail || ''; $('#cmpEnter', p).textContent = t.kind === 'building' ? 'Entrar' : 'Abrir'; }
    },
  });
  loading.remove();
  window.pulsoCampus = campus; // útil para pruebas manuales en la consola
  campus.bindMinimap($('#cmpMap', root));
  places = await loadPlaces(); campus.setPlaces(places);
  paintQuick(); paintModes(); paintRole();
  $('#cmpEnter', root).addEventListener('click', () => campus.interact());
  $('#cmpModes', root).addEventListener('click', (e) => { const b = e.target.closest('[data-mode]'); if (b) setControlMode(b.dataset.mode); });
  addEventListener('pulso:control', paintModes);
  $('#cmpRole', root).addEventListener('click', (e) => { const b = e.target.closest('[data-role]'); if (!b) return; store.role = b.dataset.role; save(); document.body.dataset.role = store.role; paintRole(); if (!isOwner()) { editing = null; } if (!$('#cmpPanel', root).hidden) paintPanel(); });
  $('#cmpPlacesBtn', root).addEventListener('click', () => togglePanel());
  $('#cmpPanelX', root).addEventListener('click', () => togglePanel(false));
  returnToCampus();
  return campus;
}

function enter(t) {
  try { sessionStorage.setItem('pulso:spawn', t.id); } catch { /* ignorar */ }
  if (t.kind === 'building') { location.hash = t.route; return; }
  openPlace(t.place);
}
function openPlace(p) {
  if (p.link.type === 'building') { const b = BUILDINGS.find((x) => x.id === p.link.value); if (b) { location.hash = b.route; return; } }
  if (p.link.type === 'url') { const u = safeUrl(p.link.value); if (u) { window.open(u, '_blank', 'noopener'); return; } }
  togglePanel(true); status = ''; paintPanel(p.id);
}

function paintQuick() {
  const q = $('#cmpQuick', root);
  q.innerHTML = BUILDINGS.map((b) => `<button type="button" class="cmp-chip" data-open="${b.id}" style="--c:${b.color}"><i></i><span><b>${b.name}</b><small>${b.detail}</small></span></button>`).join('')
    + places.map((p) => `<button type="button" class="cmp-chip cmp-place" data-place="${esc(p.id)}" style="--c:${p.color}"><i></i><span><b>${esc(p.name)}</b><small>Lugar</small></span></button>`).join('');
  q.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => { const t = BUILDINGS.find((x) => x.id === b.dataset.open); try { sessionStorage.setItem('pulso:spawn', t.id); } catch { /* ignorar */ } location.hash = t.route; }));
  q.querySelectorAll('[data-place]').forEach((b) => b.addEventListener('click', () => { const p = places.find((x) => x.id === b.dataset.place); if (p) openPlace(p); }));
}
function paintModes() {
  const m = getControlMode(); campus?.setMode(m);
  root.querySelectorAll('#cmpModes [data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
  $('#cmpHelp', root).textContent = CONTROL_MODES[m].help;
  root.dataset.mode = m;
}
function paintRole() { root.querySelectorAll('#cmpRole [data-role]').forEach((b) => b.classList.toggle('on', b.dataset.role === store.role)); }
function togglePanel(open) {
  const p = $('#cmpPanel', root), show = open ?? p.hidden;
  p.hidden = !show; $('#cmpPlacesBtn', root).setAttribute('aria-expanded', String(show));
  if (show) paintPanel(); else { editing = null; campus.showMarker(null); }
}

// ---------- panel de lugares y editor (solo el dueño edita) ----------
function paintPanel(highlight) {
  const body = $('#cmpPanelBody', root), owner = isOwner();
  if (editing) { paintEditor(body); return; }
  body.innerHTML = `
    <div class="seg cmp-role-inline" id="cmpRole2" role="group" aria-label="Rol"><button type="button" data-role="dueno" class="${owner ? 'on' : ''}">Dueño</button><button type="button" data-role="miembro" class="${owner ? '' : 'on'}">Miembro</button></div>
    ${owner ? `<button class="btn primary" id="cmpNew" type="button" ${places.length >= MAX_PLACES ? 'disabled' : ''}>＋ Añadir lugar</button>` : '<p class="muted cmp-note">Solo el dueño puede añadir o editar lugares. Tú puedes visitarlos.</p>'}
    ${status ? `<p class="cmp-status" role="status">${esc(status)}</p>` : ''}
    <ul class="cmp-list">${places.length ? places.map((p) => `
      <li class="${p.id === highlight ? 'hl' : ''}" style="--c:${p.color}"><div><b>${esc(p.name)}</b><small>${esc(p.description || 'Sin descripción')}</small>
        <small class="muted">${p.link.type === 'building' ? `Enlazado a ${esc(BUILDINGS.find((b) => b.id === p.link.value)?.name || 'un edificio')}` : p.link.type === 'url' ? 'Enlace a un proyecto web' : 'Sin proyecto enlazado todavía'}</small></div>
        <div class="cmp-act"><button class="btn sm" data-go="${esc(p.id)}" type="button">Ir</button>${owner ? `<button class="btn sm" data-edit="${esc(p.id)}" type="button">Editar</button>` : ''}</div></li>`).join('') : '<li class="muted">Aún no hay lugares. Los terrenos libres del campus esperan nuevos proyectos.</li>'}</ul>`;
  $('#cmpRole2', body)?.addEventListener('click', (e) => { const r = e.target.closest('[data-role]'); if (!r) return; store.role = r.dataset.role; save(); document.body.dataset.role = store.role; paintRole(); paintPanel(); });
  $('#cmpNew', body)?.addEventListener('click', () => { const pos = campus.playerPos(); editing = { isNew: true, id: newPlaceId(), name: '', description: '', color: PLACE_COLORS[0], x: +(pos.x + Math.sin(pos.yaw) * 5).toFixed(1), z: +(pos.z + Math.cos(pos.yaw) * 5).toFixed(1), link: { type: 'none', value: '' } }; status = ''; paintPanel(); });
  body.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => { campus.goTo(b.dataset.go); if (innerWidth < 700) togglePanel(false); }));
  body.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => { editing = JSON.parse(JSON.stringify(places.find((p) => p.id === b.dataset.edit))); status = ''; paintPanel(); }));
}
function paintEditor(body) {
  const e = editing;
  body.innerHTML = `
    <form class="cmp-form" id="cmpForm" novalidate>
      <h3>${e.isNew ? 'Nuevo lugar' : 'Editar lugar'}</h3>
      <label>Nombre<input name="name" maxlength="40" required value="${esc(e.name)}" placeholder="Ej.: Sala de inversión"></label>
      <label>Descripción<textarea name="description" maxlength="200" rows="3" placeholder="¿Qué se hará aquí?">${esc(e.description)}</textarea></label>
      <fieldset><legend>Color</legend><div class="cmp-colors">${PLACE_COLORS.map((c) => `<label style="--c:${c}"><input type="radio" name="color" value="${c}" ${c === e.color ? 'checked' : ''}><span></span></label>`).join('')}</div></fieldset>
      <fieldset><legend>Ubicación</legend>
        <p class="cmp-note" id="cmpPos">Posición: ${e.x}, ${e.z}</p>
        <div class="cmp-row"><button class="btn sm" id="cmpHere" type="button">Aquí delante</button><button class="btn sm" id="cmpPickMap" type="button">Elegir en el campus</button></div></fieldset>
      <label>Proyecto enlazado<select name="linkType"><option value="none">Ninguno todavía</option>${BUILDINGS.map((b) => `<option value="building:${b.id}" ${e.link.type === 'building' && e.link.value === b.id ? 'selected' : ''}>${b.name}</option>`).join('')}<option value="url" ${e.link.type === 'url' ? 'selected' : ''}>Enlace web</option></select></label>
      <label id="cmpUrlRow" ${e.link.type === 'url' ? '' : 'hidden'}>Dirección web<input name="url" type="url" inputmode="url" placeholder="https://" value="${e.link.type === 'url' ? esc(e.link.value) : ''}"></label>
      <p class="cmp-status" id="cmpErr" role="alert"></p>
      <div class="cmp-row"><button class="btn primary" type="submit">Guardar</button><button class="btn" id="cmpCancel" type="button">Cancelar</button>${e.isNew ? '' : '<button class="btn danger" id="cmpDel" type="button">Eliminar</button>'}</div>
    </form>`;
  const f = $('#cmpForm', body), err = $('#cmpErr', body);
  const setPos = (x, z) => { e.x = +x.toFixed(1); e.z = +z.toFixed(1); $('#cmpPos', body).textContent = `Posición: ${e.x}, ${e.z}`; campus.showMarker(e.x, e.z); };
  campus.showMarker(e.x, e.z);
  f.linkType.addEventListener('change', () => { $('#cmpUrlRow', body).hidden = f.linkType.value !== 'url'; });
  $('#cmpHere', body).addEventListener('click', () => { const p = campus.playerPos(); setPos(p.x + Math.sin(p.yaw) * 5, p.z + Math.cos(p.yaw) * 5); });
  $('#cmpPickMap', body).addEventListener('click', () => { err.textContent = 'Toca el campus o el mapa para elegir el lugar.'; campus.pick((x, z) => { setPos(x, z); err.textContent = ''; }); });
  $('#cmpCancel', body).addEventListener('click', () => { editing = null; campus.showMarker(null); paintPanel(); });
  $('#cmpDel', body)?.addEventListener('click', async () => { if (!confirm(`¿Eliminar «${e.name}»?`)) return; places = places.filter((p) => p.id !== e.id); await commit('Lugar eliminado'); });
  f.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const fd = new FormData(f), name = String(fd.get('name')).trim(), lt = String(fd.get('linkType'));
    if (!isOwner()) { err.textContent = 'Solo el dueño puede guardar cambios.'; return; }
    if (!name) { err.textContent = 'Escribe un nombre para el lugar.'; f.name.focus(); return; }
    const link = lt.startsWith('building:') ? { type: 'building', value: lt.slice(9) } : lt === 'url' ? { type: 'url', value: safeUrl(String(fd.get('url')).trim()) } : { type: 'none', value: '' };
    if (lt === 'url' && !link.value) { err.textContent = 'Escribe una dirección web válida que empiece por https://'; return; }
    const others = places.filter((p) => p.id !== e.id);
    campus.setPlaces(others);
    if (!campus.canPlace(e.x, e.z)) { campus.setPlaces(places); err.textContent = 'Ese punto está ocupado o fuera del campus. Elige otro.'; return; }
    const next = { id: e.id, name, description: String(fd.get('description')).trim(), color: String(fd.get('color')), x: e.x, z: e.z, link };
    places = e.isNew ? [...others, next] : places.map((p) => (p.id === e.id ? next : p));
    await commit(e.isNew ? 'Lugar creado' : 'Cambios guardados');
  });
}
async function commit(msg) {
  const where = await savePlaces(places);
  campus.setPlaces(places); campus.showMarker(null); paintQuick();
  status = `${msg}. ${where === 'servidor' ? 'Guardado también en el servidor: aparecerá en otros dispositivos.' : 'Guardado en este navegador. Para verlo desde otro dispositivo hace falta el servidor de datos.'}`;
  editing = null; paintPanel();
}
