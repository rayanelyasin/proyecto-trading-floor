import { loadEditableAvatar } from './editable-avatar.js';
import { store, save } from './store.js';
import { MEMBERS, COURSES, AGENTS, NPC_LINES } from './data.js';
import { market, startTicker, SYMBOLS, fmt } from './market.js';
import { initUI, onZone, onInteract, onChat, onFloor, onView, refreshWall, icon, toast } from './ui.js';
import { authFlow, currentAccount, saveAvatar, logout } from './auth.js';
import { openCreator } from './creator.js';
import { preloadAvatars, randomAvatar } from './human.js';
import { mountCampus, hasCampus, pauseCampus, returnToCampus } from './campus-ui.js';
import { initFloorControls } from './floor-controls.js';

const $ = (s) => document.querySelector(s);
let world = null;

document.querySelectorAll('[data-icon]').forEach((el) => { el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon)); });

// ---------- precios en vivo (también en la portada) ----------
startTicker();
market.on((type) => {
  if (type === 'status') {
    const label = market.status === 'en vivo' ? 'En vivo' : market.status === 'simulado' ? 'Datos simulados' : 'Conectando…';
    $('#heroMarketStatus').textContent = label;
  }
  if (type !== 'tick') return;
  const el = $('#heroTicker');
  if (el) el.innerHTML = Object.entries(SYMBOLS).map(([k, v]) => {
    const c = market.change[k] ?? 0;
    return `<span><b>${v.short}</b> <span class="mono">${fmt(k, market.prices[k])}</span> <span class="mono ${c >= 0 ? 'up' : 'down'}">${c >= 0 ? '+' : ''}${c.toFixed(2)}%</span></span>`;
  }).join('');
});

// ---------- rutas ----------
// #/ portada · #/campus campus 3D · #/piso oficina original (pisos 1 a 4) · #/lab laboratorio (piso 5)
// #/ai Mi oficina IA (piso 6) · #/ai-full aplicación original de Mi oficina IA
const IN_WORLD = ['piso', 'lab', 'ai'];
function currentView() {
  const h = location.hash;
  return h.startsWith('#/piso') ? 'piso' : h.startsWith('#/campus') ? 'campus' : h.startsWith('#/lab') ? 'lab' : h.startsWith('#/ai-full') ? 'aifull' : h.startsWith('#/ai') ? 'ai' : 'landing';
}
function route() {
  const view = currentView();
  const inWorld = IN_WORLD.includes(view);
  $('#landing').hidden = view !== 'landing';
  $('#app').hidden = !inWorld;
  $('#campus').hidden = view !== 'campus';
  $('#ai').hidden = view !== 'aifull';
  document.body.classList.toggle('in-app', view !== 'landing');
  world?.setPaused(!inWorld);
  pauseCampus(view !== 'campus');
  if (inWorld) enterWorld(view);
  if (view === 'campus') enterCampus();
  if (view === 'aifull') enterAIFull();
}
addEventListener('hashchange', route);

// ---------- cuenta y personaje (el mismo en el campus y en los tres edificios) ----------
function syncChip(name, color) {
  const dot = document.createElement('i');
  dot.style.backgroundColor = color;
  const label = document.createElement('span');
  label.textContent = name;
  const chip = $('#meChip');
  chip.replaceChildren(dot, label);
  chip.insertAdjacentHTML('beforeend', icon('person'));
  chip.setAttribute('aria-label', `Editar personaje de ${name}`);
}
let editing = false;
addEventListener('pulso:edit-profile', async () => {
  const account = currentAccount();
  if (!account || editing) return;
  editing = true;
  world?.setPaused(true);
  try {
    const result = await openCreator({ initial: account.avatar, name: account.name });
    if (result) {
      saveAvatar(result.avatar, result.name);
      location.reload();
    }
  } finally {
    world?.setPaused(false);
    editing = false;
  }
});
$('#logoutBtn')?.addEventListener('click', () => { logout(); location.hash = '#/'; location.reload(); });

let profilePromise = null;
function prepareProfile() {
  profilePromise ||= (async () => {
    let acc = currentAccount() || (await authFlow());
    if (!acc) return null;
    if (!acc.avatar) {
      const r = await openCreator({ name: acc.name, first: true });
      if (!r) return null;
      saveAvatar(r.avatar, r.name);
      acc = currentAccount();
    }
    $('#loader').hidden = false;
    try {
      try { await preloadAvatars(); } catch (error) { console.error(error); }
      let avatar = acc.avatar;
      if (avatar.kind === 'editable') {
        try { await loadEditableAvatar(avatar); } catch (error) {
          console.error(error);
          avatar = randomAvatar(acc.username);
          toast('No se pudo cargar tu avatar', 'Puedes reintentar al editar tu personaje.');
        }
      }
      store.profile = { name: acc.name, color: avatar.topColor, avatar };
      save();
      syncChip(acc.name, avatar.topColor);
      return store.profile;
    } finally { $('#loader').hidden = true; }
  })().then((p) => { if (!p) profilePromise = null; return p; }, (e) => { profilePromise = null; throw e; });
  return profilePromise;
}

// ---------- campus ----------
let campusStarting = false;
async function enterCampus() {
  if (hasCampus()) { returnToCampus(); return; }
  if (campusStarting) return;
  campusStarting = true;
  try {
    const profile = await prepareProfile();
    if (!profile) { location.hash = '#/'; return; }
    $('#loader').hidden = false;
    await mountCampus($('#campus'), { profile, toast });
  } catch (e) {
    console.error(e);
    $('#campus').innerHTML = '<div class="fatal"><b>No se pudo iniciar el campus 3D.</b><span>Tu navegador necesita WebGL. Prueba con Chrome, Edge o Safari actualizados.</span><a class="btn" href="#/">Volver al inicio</a></div>';
  } finally { $('#loader').hidden = true; campusStarting = false; }
}

// ---------- edificios: oficina, laboratorio y Mi oficina IA comparten el mismo mundo 3D ----------
let worldPromise = null;
function ensureWorld() {
  worldPromise ||= (async () => {
    const profile = await prepareProfile();
    if (!profile) throw new Error('sin-cuenta');
    $('#loader').hidden = false;
    try {
      const { createWorld } = await import('./scene.js');
      world = createWorld($('#world'), {
        me: profile, members: MEMBERS, courses: COURSES, agents: AGENTS, npcLines: NPC_LINES,
        minimap: $('#minimap'), onZone, onInteract, onChat, onFloor, onView,
      });
      window.pulsoWorld = world; // útil para pruebas manuales en la consola
      initUI(world);
      initFloorControls($('#app'));
      refreshWall('BTCUSDT', '1h');
      return world;
    } finally { $('#loader').hidden = true; }
  })().catch((e) => {
    worldPromise = null;
    if (e.message === 'sin-cuenta') { location.hash = '#/'; return null; }
    console.error(e);
    $('#world').innerHTML = '<div class="fatal"><b>No se pudo iniciar el edificio 3D.</b><span>Tu navegador necesita WebGL. Prueba con Chrome, Edge o Safari actualizados.</span></div>';
    return null;
  });
  return worldPromise;
}
async function enterWorld(view) {
  const w = await ensureWorld();
  if (!w || currentView() !== view) return;
  const wanted = view === 'lab' ? 5 : view === 'ai' ? 6 : (w.floor <= 4 ? w.floor : 1);
  if (w.floor !== wanted) w.setFloor(wanted);
  w.setPaused(false);
}

// ---------- aplicación original de Mi oficina IA (todas sus funciones, vista previa fuera de Claude) ----------
function enterAIFull() {
  const box = $('#ai');
  if (!box.querySelector('iframe')) {
    const f = document.createElement('iframe');
    f.title = 'Mi oficina IA, aplicación original'; f.src = 'edificio-ai/index.html'; f.allow = 'fullscreen; gamepad; clipboard-write';
    box.prepend(f);
  }
  const back = $('#aiBack');
  back.onclick = () => { location.hash = '#/ai'; };
  back.hidden = true;
  clearTimeout(enterAIFull.t);
  enterAIFull.t = setTimeout(() => { try { if (!box.querySelector('iframe').contentDocument.querySelector('#campusBtn')) back.hidden = false; } catch { back.hidden = false; } }, 10000);
}

route();
