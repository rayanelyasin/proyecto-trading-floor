// Cuentas locales (demo): usuario + contraseña con hash PBKDF2 guardado en este navegador.
// Para producción esto debe vivir en un servidor (Supabase Auth, Clerk, etc.).
import { store, save } from './store.js';

const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

async function hash(pw, salt) {
  try {
    const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
    return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 120000, hash: 'SHA-256' }, key, 256));
  } catch { // contexto no seguro: respaldo débil, solo para la demo
    let h = 5381; for (const c of salt + pw) h = ((h << 5) + h + c.charCodeAt(0)) | 0; return 'w' + h;
  }
}
const newSalt = () => hex(crypto.getRandomValues(new Uint8Array(12)));
const norm = (u) => u.trim().toLowerCase();

export const currentAccount = () => (store.session && store.accounts[store.session] ? { username: store.session, ...store.accounts[store.session] } : null);
export function logout() { store.session = null; save(); }
export function saveAvatar(avatar, name) {
  const a = store.accounts[store.session]; if (!a) return;
  a.avatar = avatar; if (name) a.name = name.trim().slice(0, 18); save();
}

async function register(user, pw) {
  const u = norm(user);
  if (!/^[a-z0-9_.-]{3,20}$/.test(u)) return 'El usuario debe tener 3 a 20 caracteres: letras, números, punto, guion o guion bajo.';
  if (pw.length < 6) return 'La contraseña debe tener al menos 6 caracteres.';
  if (store.accounts[u]) return 'Ese usuario ya existe. Elige otro o inicia sesión.';
  const salt = newSalt();
  store.accounts[u] = { salt, hash: await hash(pw, salt), name: user.trim().slice(0, 18), avatar: null, created: Date.now() };
  store.session = u; save();
  return null;
}
async function login(user, pw) {
  const u = norm(user), a = store.accounts[u];
  if (!a || (await hash(pw, a.salt)) !== a.hash) return 'Usuario o contraseña incorrectos.';
  store.session = u; save();
  return null;
}

// Diálogo de acceso. Resuelve con la cuenta o null si se cierra.
export function authFlow() {
  return new Promise((resolve) => {
    const dlg = document.createElement('dialog');
    dlg.className = 'dialog auth';
    const hasAccounts = Object.keys(store.accounts).length > 0;
    let mode = hasAccounts ? 'login' : 'register';
    const paint = () => {
      dlg.innerHTML = `
        <form class="form" autocomplete="on">
          <h2>${mode === 'login' ? 'Bienvenido de vuelta' : 'Crea tu cuenta'}</h2>
          <p class="muted">${mode === 'login' ? 'Entra con tu usuario y contraseña.' : 'Después de registrarte, diseñarás tu personaje.'}</p>
          <div class="seg full"><label><input type="radio" name="m" value="login" ${mode === 'login' ? 'checked' : ''}><span>Iniciar sesión</span></label><label><input type="radio" name="m" value="register" ${mode === 'register' ? 'checked' : ''}><span>Crear cuenta</span></label></div>
          <label>Usuario<input name="user" required maxlength="20" autocomplete="username" autofocus></label>
          <label>Contraseña<input name="pw" type="password" required minlength="${mode === 'register' ? 6 : 1}" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}"></label>
          ${mode === 'register' ? '<label>Repite la contraseña<input name="pw2" type="password" required autocomplete="new-password"></label>' : ''}
          <p class="form-err" role="alert" hidden></p>
          <div class="row gap"><button type="button" class="btn cancel">Volver</button><button class="btn primary grow">${mode === 'login' ? 'Entrar' : 'Crear cuenta'}</button></div>
          <p class="hint">Demo: las cuentas se guardan solo en este navegador.</p>
        </form>`;
      const f = dlg.querySelector('form');
      const err = (t) => { const e = f.querySelector('.form-err'); e.textContent = t; e.hidden = !t; };
      f.querySelectorAll('input[name=m]').forEach((r) => r.addEventListener('change', () => { mode = r.value; paint(); }));
      dlg.querySelector('.cancel').onclick = () => { dlg.close(); dlg.remove(); resolve(null); };
      f.onsubmit = async (e) => {
        e.preventDefault();
        const btn = f.querySelector('.primary'); btn.disabled = true;
        let msg;
        if (mode === 'register') msg = f.pw.value !== f.pw2.value ? 'Las contraseñas no coinciden.' : await register(f.user.value, f.pw.value);
        else msg = await login(f.user.value, f.pw.value);
        btn.disabled = false;
        if (msg) return err(msg);
        dlg.close(); dlg.remove(); resolve(currentAccount());
      };
    };
    dlg.addEventListener('cancel', (e) => e.preventDefault());
    document.body.appendChild(dlg); paint(); dlg.showModal();
  });
}
