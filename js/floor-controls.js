// Selector de controles de la oficina original: comparte el modo con el campus (teclado, mouse o táctil).
// El joystick táctil envía las mismas teclas W A S D que ya entiende scene.js, sin tocar su lógica.
import { CONTROL_MODES, getControlMode, setControlMode } from './campus.js';

let ready = false;
export function initFloorControls(host) {
  if (ready) return;
  ready = true;
  const switchEl = host.querySelector('#controlSwitch');
  const nameEl = host.querySelector('#controlName');
  if (switchEl) {
    switchEl.innerHTML = Object.entries(CONTROL_MODES).map(([k, v]) => `<button type="button" data-mode="${k}" aria-pressed="false" aria-label="${v.label}"><span aria-hidden="true">${v.icon}</span><span>${v.label}</span></button>`).join('');
    switchEl.addEventListener('click', (e) => { const b = e.target.closest('[data-mode]'); if (b) setControlMode(b.dataset.mode); });
  }
  if (innerWidth < 760) host.querySelectorAll('#cameraTools, #controlTools').forEach((d) => d.removeAttribute('open')); // más espacio en el teléfono
  const joy = document.createElement('div');
  joy.className = 'floor-joy'; joy.hidden = true; joy.innerHTML = '<i></i>'; joy.setAttribute('aria-hidden', 'true');
  host.appendChild(joy);
  const knob = joy.firstChild, held = new Set(); let id = null;
  const press = (key, on) => {
    if (on === held.has(key)) return;
    on ? held.add(key) : held.delete(key);
    dispatchEvent(new KeyboardEvent(on ? 'keydown' : 'keyup', { key, bubbles: true, cancelable: true }));
  };
  const release = () => { ['w', 'a', 's', 'd'].forEach((k) => press(k, false)); knob.style.transform = ''; };
  const move = (e) => {
    const r = joy.getBoundingClientRect(); let dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2), dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
    knob.style.transform = `translate(${dx * 36}px,${dy * 36}px)`;
    press('w', dy < -0.35); press('s', dy > 0.35); press('a', dx < -0.35); press('d', dx > 0.35);
  };
  joy.addEventListener('pointerdown', (e) => { id = e.pointerId; try { joy.setPointerCapture(id); } catch { /* sin captura */ } move(e); });
  joy.addEventListener('pointermove', (e) => { if (e.pointerId === id) move(e); });
  const end = (e) => { if (e.pointerId === id) { id = null; release(); } };
  joy.addEventListener('pointerup', end); joy.addEventListener('pointercancel', end);

  const paint = () => {
    const m = getControlMode();
    switchEl?.querySelectorAll('[data-mode]').forEach((b) => { const on = b.dataset.mode === m; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    if (nameEl) nameEl.textContent = CONTROL_MODES[m].label;
    joy.hidden = m !== 'tactil'; if (m !== 'tactil') release();
    host.dataset.control = m;
  };
  addEventListener('pulso:control', paint);
  paint();
}
