import { loadEditableAvatar } from './editable-avatar.js';
import { store, save } from './store.js';
import { MEMBERS, COURSES, AGENTS, NPC_LINES } from './data.js';
import { market, startTicker, SYMBOLS, fmt } from './market.js';
import { initUI, onZone, onInteract, onChat, onFloor, onView, refreshWall, icon, toast } from './ui.js';
import { authFlow, currentAccount, saveAvatar, logout } from './auth.js';
import { openCreator } from './creator.js';
import { preloadAvatars, randomAvatar } from './human.js';
import { mountCampus, hasCampus, pauseCampus, returnToCampus } from './campus-ui.js';
import { mountLab, unmountLab } from './lab.js';
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
// #/ portada · #/campus campus 3D · #/piso oficina original · #/lab laboratorio · #/ai Mi oficina IA
const VIEWS = { campus: '#campus', piso: '#app', lab: '#lab', ai: '#ai' };
function currentView() {
  const h = location.hash;
  return h.startsWith('#/piso') ? 'piso' : h.startsWith('#/campus') ? 'campus' : h.startsWith('#/lab') ? 'lab' : h.startsWith('#/ai') ? 'ai' : 'landing';
}
function route() {
  const view = currentView();
  $('#landing').hidden = view !== 'landing';
  for (const [name, sel] of Object.entries(VIEWS)) $(sel).hidden = name !== view;
  document.body.classList.toggle('in-app', view !== 'landing');
  world?.setPaused(view !== 'piso');
  pauseCampus(view !== 'campus');
  if (view !== 'lab') unmountLab();
  if (view === 'piso') enterApp();
  if (view === 'campus') enterCampus();
  if (view === 'lab') enterLab();
  if (view === 'ai') enterAI();
}
addEventListener('hashchange', route);

async function requireAccount() {
  const acc = currentAccount() || (await authFlow());
  if (!acc) location.hash = '#/';
  return acc;
}
let campusStarting = false;
async function enterCampus() {
  if (hasCampus()) { returnToCampus(); return; }
  if (campusStarting) return;
  campusStarting = true;
  try {
    const acc = await requireAccount(); if (!acc) return;
    $('#loader').hidden = false;
    await mountCampus($('#campus'), { name: acc.name, color: acc.avatar?.topColor });
  } catch (e) {
    console.error(e);
    $('#campus').innerHTML = '<div class="fatal"><b>No se pudo iniciar el campus 3D.</b><span>Tu navegador necesita WebGL. Prueba con Chrome, Edge o Safari actualizados.</span><a class="btn" href="#/">Volver al inicio</a></div>';
  } finally { $('#loader').hidden = true; campusStarting = false; }
}
async function enterLab() {
  const acc = await requireAccount(); if (!acc) return;
  mountLab($('#lab'), { onBack: () => { location.hash = '#/campus'; } });
}
async function enterAI() {
  const acc = await requireAccount(); if (!acc) return;
  const box = $('#ai');
  if (!box.querySelector('iframe')) {
    const f = document.createElement('iframe');
    f.title = 'Mi oficina IA'; f.src = 'edificio-ai/index.html'; f.allow = 'fullscreen; gamepad; clipboard-write';
    box.prepend(f);
  }
  const back = $('#aiBack');
  back.onclick = () => { location.hash = '#/campus'; };
  // el botón del propio edificio es el principal; este solo aparece si ese no cargó
  back.hidden = true;
  clearTimeout(enterAI.t);
  enterAI.t = setTimeout(() => { try { if (!box.querySelector('iframe').contentDocument.querySelector('#campusBtn')) back.hidden = false; } catch { back.hidden = false; } }, 10000);
}

// ---------- cuenta y personaje ----------
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

// ---------- entrar al piso ----------
let starting = false;
async function enterApp() {
  if (world || starting) return;
  starting = true;
  const back = () => { starting = false; location.hash = '#/'; };
  let acc = currentAccount() || (await authFlow());
  if (!acc) return back();
  if (!acc.avatar) {
    const r = await openCreator({ name: acc.name, first: true });
    if (!r) return back();
    saveAvatar(r.avatar, r.name);
    acc = currentAccount();
  }
  $('#loader').hidden = false;
  try { await preloadAvatars(); } catch (error) { console.error(error); }
  let avatar = acc.avatar;
  if (avatar.kind === 'editable') {
    $('#loader').hidden = false;
    try { await loadEditableAvatar(avatar); } catch (error) {
      console.error(error);
      avatar = randomAvatar(acc.username);
      toast('No se pudo cargar tu avatar', 'Puedes reintentar al editar tu personaje.');
    } finally { $('#loader').hidden = true; }
  }
  store.profile = { name: acc.name, color: avatar.topColor, avatar };
  save();
  syncChip(acc.name, avatar.topColor);
  $('#loader').hidden = false;
  try {
    const { createWorld } = await import('./scene.js');
    world = createWorld($('#world'), {
      me: store.profile, members: MEMBERS, courses: COURSES, agents: AGENTS, npcLines: NPC_LINES,
      minimap: $('#minimap'), onZone, onInteract, onChat, onFloor, onView,
    });
    initUI(world);
    initFloorControls($('#app'));
    refreshWall('BTCUSDT', '1h');
  } catch (e) {
    console.error(e);
    $('#world').innerHTML = `<div class="fatal"><b>No se pudo iniciar el piso 3D.</b><span>Tu navegador necesita WebGL. Prueba con Chrome, Edge o Safari actualizados.</span></div>`;
  } finally {
    $('#loader').hidden = true;
    starting = false;
  }
}

route();
