import { loadEditableAvatar } from './editable-avatar.js';
import { store, save } from './store.js';
import { MEMBERS, COURSES, AGENTS, NPC_LINES } from './data.js';
import { market, startTicker, SYMBOLS, fmt } from './market.js';
import { initUI, onZone, onInteract, onChat, onFloor, onView, refreshWall, icon } from './ui.js';
import { authFlow, currentAccount, saveAvatar, logout } from './auth.js';
import { openCreator } from './creator.js';
import { preloadAvatars } from './human.js';

const $ = (s) => document.querySelector(s);
let world = null;

document.querySelectorAll('[data-icon]').forEach((el) => { el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon)); });

// ---------- precios en vivo (también en la portada) ----------
startTicker();
market.on((type) => {
  if (type !== 'tick') return;
  const el = $('#heroTicker');
  if (el) el.innerHTML = Object.entries(SYMBOLS).map(([k, v]) => {
    const c = market.change[k] ?? 0;
    return `<span><b>${v.short}</b> <span class="mono">${fmt(k, market.prices[k])}</span> <span class="mono ${c >= 0 ? 'up' : 'down'}">${c >= 0 ? '+' : ''}${c.toFixed(2)}%</span></span>`;
  }).join('');
});

// ---------- rutas ----------
function route() {
  const inApp = location.hash.startsWith('#/piso');
  $('#landing').hidden = inApp;
  $('#app').hidden = !inApp;
  document.body.classList.toggle('in-app', inApp);
  if (inApp) enterApp();
}
addEventListener('hashchange', route);

// ---------- cuenta y personaje ----------
function syncChip(acc) {
  $('#meChip').innerHTML = `<i style="background:${acc.avatar.topColor}"></i><span>${acc.name}</span>`;
}
addEventListener('pulso:edit-profile', async () => {
  const acc = currentAccount(); if (!acc) return;
  await preloadAvatars();
  const r = await openCreator({ initial: acc.avatar, name: acc.name });
  if (r) { saveAvatar(r.avatar, r.name); location.reload(); }
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
  $('#loader').hidden = false;
  try { await preloadAvatars(); } catch (e) { console.error(e); }
  $('#loader').hidden = true;
  if (!acc.avatar) {
    const r = await openCreator({ name: acc.name, first: true });
    if (!r) return back();
    saveAvatar(r.avatar, r.name);
    acc = currentAccount();
  }
  let avatar = acc.avatar;
  if (avatar.kind === 'editable') {
    $('#loader').hidden = false;
    try { await loadEditableAvatar(avatar); } catch (error) {
      console.error(error);
      const { randomAvatar } = await import('./human.js');
      avatar = randomAvatar(acc.username);
      const { toast } = await import('./ui.js');
      toast('No se pudo cargar tu avatar', 'Puedes reintentar al editar tu personaje.');
    } finally { $('#loader').hidden = true; }
  }
  store.profile = { name: acc.name, color: avatar.topColor, avatar };
  save();
  syncChip(acc);
  $('#loader').hidden = false;
  try {
    const { createWorld } = await import('./scene.js');
    world = createWorld($('#world'), {
      me: store.profile, members: MEMBERS, courses: COURSES, agents: AGENTS, npcLines: NPC_LINES,
      minimap: $('#minimap'), onZone, onInteract, onChat, onFloor, onView,
    });
    initUI(world);
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
