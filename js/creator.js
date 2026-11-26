// Creador de personaje: vista 3D en vivo + controles de cuerpo, rostro, pelo, ropa y extras.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildAvatar, animateAvatar, randomAvatar, OPTIONS, DEFAULT_AVATAR, MODELS } from './human.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const TABS = [
  ['Persona', [['choice', 'gender', 'Género', OPTIONS.gender], ['gallery', 'model', 'Elige tu look (rostro, peinado y ropa)']]],
  ['Cuerpo', [['range', 'height', 'Altura', 0.92, 1.08], ['range', 'build', 'Complexión', 0.92, 1.12], ['swatch', 'skin', 'Tono de piel (tinte)', OPTIONS.skin], ['swatch', 'hairTint', 'Tinte de pelo', OPTIONS.hairTint]]],
  ['Extras', [['choice', 'accessory', 'Accesorios', OPTIONS.accessory]]],
];

// Devuelve { avatar, name } al guardar, o null si se cancela.
export function openCreator({ initial, name = '', first = false } = {}) {
  return new Promise((resolve) => {
    const cfg = { ...DEFAULT_AVATAR, ...(initial || randomAvatar()) };
    let tab = 0;

    const dlg = document.createElement('dialog');
    dlg.className = 'dialog creator';
    dlg.innerHTML = `
      <div class="cr-grid">
        <div class="cr-preview"><canvas></canvas><div class="cr-hint">Arrastra para girar</div></div>
        <div class="cr-panel">
          <h2>${first ? 'Diseña tu personaje' : 'Editar personaje'}</h2>
          <label class="cr-name">Nombre visible<input id="crName" maxlength="18" value="${esc(name)}" placeholder="Cómo te verán los demás"></label>
          <div class="cr-tabs" role="tablist">${TABS.map((t, i) => `<button type="button" role="tab" data-t="${i}">${t[0]}</button>`).join('')}</div>
          <div class="cr-controls"></div>
          <div class="row gap cr-actions">
            <button type="button" class="btn" id="crRandom">Aleatorio</button>
            ${first ? '' : '<button type="button" class="btn" id="crCancel">Cancelar</button>'}
            <button type="button" class="btn primary grow" id="crSave">${first ? 'Entrar al piso' : 'Guardar'}</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(dlg);
    dlg.addEventListener('cancel', (e) => e.preventDefault());
    dlg.showModal();

    // ----- vista previa 3D -----
    const canvas = dlg.querySelector('canvas');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    const scene = new THREE.Scene();
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.add(new THREE.HemisphereLight(0xfff1e0, 0x2a2420, 0.5));
    const key = new THREE.DirectionalLight(0xffe2bf, 2.2); key.position.set(2, 4, 3); key.castShadow = true; scene.add(key);
    const rim = new THREE.DirectionalLight(0x9db4d8, 1.2); rim.position.set(-3, 2, -3); scene.add(rim);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.9, 48), new THREE.MeshStandardMaterial({ color: 0x2a2724, roughness: 0.7 }));
    disc.rotation.x = -Math.PI / 2; disc.receiveShadow = true; scene.add(disc);
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    let yaw = 0.35, dragging = false, lastX = 0, zoomF = 1;
    const holder = new THREE.Group(); scene.add(holder);
    const fake = { model: null, phase: 0 };

    const rebuild = () => {
      holder.clear();
      fake.model = buildAvatar(cfg);
      holder.add(fake.model.group);
    };
    canvas.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', (e) => { if (dragging) { yaw += (e.clientX - lastX) * 0.012; lastX = e.clientX; } });
    canvas.addEventListener('pointerup', () => { dragging = false; });
    canvas.addEventListener('wheel', (e) => { zoomF = THREE.MathUtils.clamp(zoomF + Math.sign(e.deltaY) * 0.08, 0.55, 1.4); e.preventDefault(); }, { passive: false });

    let raf = 0, last = performance.now(), alive = true;
    const loop = (t) => {
      if (!alive) return;
      raf = requestAnimationFrame(loop);
      const dt = Math.min((t - last) / 1000, 0.05); last = t;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (canvas.width !== Math.floor(w * renderer.getPixelRatio())) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
      if (!dragging) yaw += dt * 0.35;
      holder.rotation.y = yaw;
      const H = (fake.model?.height || 1.8);
      const focus = zoomF < 0.8 ? H * 0.88 : H * 0.52;
      camera.position.set(0, focus + 0.1, (H * 2.1) * zoomF);
      camera.lookAt(0, focus, 0);
      animateAvatar(fake, false, 1, dt);
      renderer.render(scene, camera);
    };

    // ----- controles -----
    const box = dlg.querySelector('.cr-controls');
    const paintControls = () => {
      dlg.querySelectorAll('.cr-tabs button').forEach((b, i) => { b.classList.toggle('on', i === tab); b.setAttribute('aria-selected', i === tab); });
      box.innerHTML = TABS[tab][1].map(([kind, key, label, a, b]) => {
        if (kind === 'gallery') return `<div class="cr-group"><span class="lbl">${label}</span><div class="cr-gallery">${MODELS[cfg.gender].map((n) => `<button type="button" class="cr-th ${cfg.model === n ? 'on' : ''}" data-k="model" data-v="${n}" aria-label="${n}"><img src="assets/rb/thumbs/${n}.jpg" alt=""></button>`).join('')}</div></div>`;
        if (kind === 'swatch') return `<div class="cr-group"><span class="lbl">${label}</span><div class="cr-swatches">${a.map((c) => `<button type="button" class="cr-sw ${cfg[key] === c ? 'on' : ''}" data-k="${key}" data-v="${c}" style="--c:${c}" aria-label="${c}"></button>`).join('')}</div></div>`;
        if (kind === 'choice') return `<div class="cr-group"><span class="lbl">${label}</span><div class="cr-choices">${a.map(([v, l]) => `<button type="button" class="chip ${cfg[key] === v ? 'on' : ''}" data-k="${key}" data-v="${v}">${l}</button>`).join('')}</div></div>`;
        return `<label class="cr-group"><span class="lbl">${label}</span><input type="range" min="${a}" max="${b}" step="0.01" value="${cfg[key]}" data-k="${key}" data-range></label>`;
      }).join('');
    };
    dlg.addEventListener('click', (e) => {
      const t = e.target.closest('[data-t]'); if (t) { tab = +t.dataset.t; paintControls(); return; }
      const o = e.target.closest('[data-k][data-v]'); if (o) { cfg[o.dataset.k] = o.dataset.v; if (o.dataset.k === 'gender') cfg.model = MODELS[o.dataset.v][0]; rebuild(); paintControls(); }
    });
    dlg.addEventListener('input', (e) => { if (e.target.dataset.range !== undefined) { cfg[e.target.dataset.k] = +e.target.value; rebuild(); } });

    const close = (val) => { alive = false; cancelAnimationFrame(raf); renderer.dispose(); dlg.close(); dlg.remove(); resolve(val); };
    dlg.querySelector('#crRandom').onclick = () => { Object.assign(cfg, randomAvatar()); rebuild(); paintControls(); };
    dlg.querySelector('#crCancel')?.addEventListener('click', () => close(null));
    dlg.querySelector('#crSave').onclick = () => {
      const nm = dlg.querySelector('#crName').value.trim();
      if (!nm) { dlg.querySelector('#crName').focus(); dlg.querySelector('.cr-name').classList.add('err'); return; }
      close({ avatar: { ...cfg }, name: nm });
    };

    rebuild(); paintControls(); requestAnimationFrame(loop);
  });
}
