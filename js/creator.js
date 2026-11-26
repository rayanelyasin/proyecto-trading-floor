import { buildAvatar, normalizeLegacyAvatar, randomAvatar, preloadAvatars, OPTIONS, MODELS } from './human.js';
import {
  BODY_CONTROLS, BOTTOMS, FACE_CONTROLS, FACE_GROUPS, HAIR, SHOES, TOPS,
  loadEditableAvatar, normalizeEditable, updateEditableAvatar,
} from './editable-avatar.js';
import { createAvatarStage } from './creator-stage.js';
import { LOOKS, PALETTES } from './creator-catalog.js';
import { icon } from './ui.js';
import { escapeHtml as esc } from './scene.js';

const SECTIONS = {
  editable: [
    ['looks', 'Estilo', 'cube'], ['body', 'Cuerpo', 'person'], ['face', 'Rostro', 'eye'],
    ['hair', 'Peinado', 'person'], ['clothes', 'Ropa', 'videoteca'],
  ],
  legacy: [['looks', 'Galería', 'miembros'], ['body', 'Cuerpo', 'person'], ['extras', 'Extras', 'cube']],
};

const WARDROBE = {
  top: { title: 'Prendas', options: TOPS, colorKey: 'topColor' },
  bottom: { title: 'Parte inferior', options: BOTTOMS, colorKey: 'bottomColor' },
  shoes: { title: 'Calzado', options: SHOES, colorKey: 'shoeColor' },
};

const LEGACY_BODY = [['height', 'Altura', 0.92, 1.08], ['build', 'Complexión', 0.92, 1.12]];

function choices(options, attr, value, label) {
  return `<div class="cr-pills" role="group" aria-label="${label}">${options.map(([key, text]) =>
    `<button type="button" data-${attr}="${key}" aria-pressed="${key === value}">${text}</button>`).join('')}</div>`;
}

function card({ key, value, label, image, selected, kind = '' }) {
  return `<button class="cr-card ${kind}" type="button" data-k="${key}" data-v="${value}" aria-pressed="${selected}" aria-label="${esc(label)}">
    <span class="cr-card-image"><img src="${image}" alt="" decoding="async" draggable="false"></span>
    <span class="cr-card-label">${esc(label)}</span>
    <span class="cr-card-check" aria-hidden="true">${icon('check')}</span>
  </button>`;
}

function valueLabel(key, value) {
  if (key === 'age') return `${Math.round(value * 100)} %`;
  const number = Math.round((key === 'height' || key === 'build' ? value - 1 : value) * 100);
  return number === 0 ? '0' : number > 0 ? `+${number}` : `−${-number}`;
}

function sliders(config, rows) {
  return `<div class="cr-sliders">${rows.map(([key, label, min, max]) => {
    const value = Number(config[key]);
    const neutral = key === 'height' || key === 'build' ? 1 : 0;
    const safeValue = Number.isFinite(value) ? value : neutral;
    const id = `crRange-${key}`;
    return `<div class="cr-slider">
      <label for="${id}">${label}</label>
      <output for="${id}">${valueLabel(key, safeValue)}</output>
      <input type="range" id="${id}" min="${min}" max="${max}" step="0.01" value="${safeValue}" data-k="${key}" data-range>
      <button class="cr-icon" type="button" data-reset="${key}" data-neutral="${neutral}" title="Restablecer ${label.toLowerCase()}" aria-label="Restablecer ${label.toLowerCase()}">↺</button>
    </div>`;
  }).join('')}</div>`;
}

function colors(key, label, palette, value, custom = true) {
  const chosen = palette.find(([color]) => color === value)?.[1] ?? 'Personalizado';
  return `<section class="cr-colors" aria-label="${label}">
    <div class="cr-field-title"><h4>${label}</h4><span data-color-name="${key}">${chosen}</span></div>
    <div class="cr-swatches">${palette.map(([color, name]) => `<button type="button" class="cr-swatch" style="--swatch:${color}" aria-label="${name}" title="${name}" data-k="${key}" data-v="${color}" data-color-option aria-pressed="${color === value}">
      <span class="cr-swatch-check" aria-hidden="true">${icon('check')}</span></button>`).join('')}
    ${custom ? `<label class="cr-custom-color" title="Elegir otro color"><span aria-hidden="true">+</span><input type="color" aria-label="${label} personalizado" value="${esc(value)}" data-k="${key}" data-color></label>` : ''}
    </div>
  </section>`;
}

const paletteFor = (key) => PALETTES[key] ?? PALETTES.fabric;
const legacyColors = (key) => OPTIONS[key].map((color, i) => [color, `${i + 1}`]);
const lookIsActive = (look, config) => Object.entries(look.avatar).every(([key, value]) => config[key] === value);
const choose = (options) => options[Math.floor(Math.random() * options.length)];

function panelContent(mode, section, category, config) {
  if (mode === 'legacy') {
    if (section === 'body') return `<h3>Cuerpo</h3>${sliders(config, LEGACY_BODY)}${colors('skin', 'Tinte de piel', legacyColors('skin'), config.skin, false)}${colors('hairTint', 'Tinte de pelo', legacyColors('hairTint'), config.hairTint, false)}`;
    if (section === 'extras') return `<h3>Accesorios</h3>${choices(OPTIONS.accessory, 'accessory', config.accessory, 'Accesorios')}`;
    const gallery = MODELS[config.gender].map((value, index) => card({
      key: 'model', value, label: `Look ${index + 1}`, image: `assets/rb/thumbs/${value}.jpg`,
      selected: config.model === value, kind: 'cr-legacy-card',
    }));
    return `<h3>Looks prediseñados</h3>${choices(OPTIONS.gender, 'gender', config.gender, 'Galería')}<div class="cr-cards">${gallery.join('')}</div>`;
  }

  if (section === 'body') {
    return `<h3>Cuerpo</h3>${sliders(config, BODY_CONTROLS)}${colors('skin', 'Tono de piel', PALETTES.skin, config.skin)}`;
  }
  if (section === 'face') {
    const [, , rows] = FACE_GROUPS.find(([key]) => key === category.face);
    return `<h3>Rostro</h3>${choices(FACE_GROUPS, 'face', category.face, 'Rasgos faciales')}
      ${sliders(config, rows)}${category.face === 'eyes' ? colors('eyeColor', 'Color de ojos', PALETTES.eyeColor, config.eyeColor) : ''}`;
  }
  if (section === 'hair') {
    return `<h3>Peinado</h3>${colors('hairTint', 'Color de pelo', PALETTES.hairTint, config.hairTint)}
      <div class="cr-cards cr-items">${HAIR.map(([value, label]) => card({
        key: 'hair', value, label, image: `assets/creator/hair-${value}.webp`, selected: config.hair === value,
      })).join('')}</div>`;
  }
  if (section === 'clothes') {
    const slots = [['top', 'Arriba'], ['bottom', 'Abajo'], ['shoes', 'Calzado']];
    const { title, options, colorKey } = WARDROBE[category.clothes];
    const disabled = category.clothes === 'bottom' && config.top === 'dress';
    return `<h3>Vestuario</h3>${choices(slots, 'clothes', category.clothes, 'Sección de vestuario')}
      ${disabled ? '<p class="cr-note">El vestido ocupa las dos zonas. Elige otra prenda de arriba para combinar una parte inferior.</p>' : `
        <h4>${title}</h4>
        <div class="cr-cards cr-items">${options.map(([value, label]) => card({
          key: category.clothes, value, label, image: `assets/creator/clothes-${value}.webp`, selected: config[category.clothes] === value,
        })).join('')}</div>
        ${colors(colorKey, 'Color de la prenda', PALETTES.fabric, config[colorKey])}`}`;
  }
  return `<h3>Elige un estilo</h3>
    <div class="cr-cards cr-looks">${LOOKS.map((look) => card({
      key: 'look', value: look.id, label: look.label, image: `assets/creator/look-${look.id}.webp`,
      selected: lookIsActive(look, config),
    })).join('')}</div>`;
}

const viewButton = (command, label, symbol) => `<button class="cr-icon" data-view-command="${command}" type="button" title="${label}" aria-label="${label}">${symbol}</button>`;

function studioMarkup(first, name) {
  return `
    <header class="cr-header">
      <div class="cr-brand"><span class="logo-mark" aria-hidden="true"></span><span>Pulso</span></div>
      <h2 id="crTitle">Estudio de personajes</h2>
      <button class="cr-icon cr-close" type="button" id="crClose" title="Cerrar" aria-label="Cerrar el estudio">${icon('x')}</button>
    </header>
    <div class="cr-grid">
      <section class="cr-preview" aria-label="Vista previa">
        <canvas tabindex="0" aria-label="Personaje en 3D. Usa las flechas izquierda y derecha para girar, y más y menos para acercar o alejar." aria-describedby="crHint"></canvas>
        <div class="cr-stage-top">
          ${choices([['full', 'Completo'], ['face', 'Rostro']], 'frame', 'full', 'Encuadre')}
          <label class="cr-pose"><span class="cr-sr">Animación de prueba</span><select id="crPose">
            <option value="idle">De pie</option><option value="walk">Caminar</option><option value="run">Correr</option>
            <option value="sit">Sentarse</option><option value="talk">Hablar</option></select></label>
        </div>
        <div class="cr-status" role="status" hidden><span></span><button id="crRetry" class="btn sm" type="button" hidden>Reintentar</button></div>
        <div class="cr-stage-bottom">
          <p id="crHint">Arrastra para girar · rueda para acercar</p>
          <div class="cr-view-tools" role="group" aria-label="Girar y acercar el personaje">
            ${viewButton('left', 'Girar a la izquierda', icon('back'))}
            ${viewButton('right', 'Girar a la derecha', icon('chev'))}
            ${viewButton('out', 'Alejar', '−')}
            ${viewButton('in', 'Acercar', '+')}
            ${viewButton('reset', 'Restablecer vista', '↺')}
          </div>
        </div>
      </section>
      <section class="cr-panel" aria-label="Personalización">
        <div class="cr-panel-top">
          ${choices([['editable', 'Personalizado'], ['legacy', 'Prediseñados']], 'mode', 'editable', 'Tipo de personaje')}
          <label class="cr-name" for="crName">Nombre visible <input id="crName" maxlength="18" value="${esc(name)}" required autocomplete="off"></label>
        </div>
        <div class="cr-tabs" role="tablist" aria-label="Secciones del creador"></div>
        <div class="cr-controls" id="crPanelContent" role="tabpanel" tabindex="0"></div>
      </section>
    </div>
    <footer class="cr-footer">
      <div class="cr-edit-actions">
        <button class="cr-icon" id="crUndo" type="button" title="Deshacer" aria-label="Deshacer" disabled>↶</button>
        <button class="cr-icon" id="crRedo" type="button" title="Rehacer" aria-label="Rehacer" disabled>↷</button>
        <button class="btn cr-random" type="button" id="crRandom">Aleatorio</button>
      </div>
      <div class="cr-save-actions">
        <button class="btn ghost" type="button" id="crCancel">${first ? 'Volver' : 'Cancelar'}</button>
        <button class="btn primary" type="button" id="crSave" disabled>${first ? 'Entrar al piso' : 'Guardar'} ${icon(first ? 'chev' : 'check')}</button>
      </div>
    </footer>`;
}

// Devuelve { avatar, name } al guardar o null si se cierra.
export function openCreator({ initial, name = '', first = false } = {}) {
  return new Promise((resolve) => {
    let mode = initial && initial.kind !== 'editable' ? 'legacy' : 'editable';
    let drafts = {
      legacy: normalizeLegacyAvatar(mode === 'legacy' ? initial : randomAvatar()),
      editable: normalizeEditable(initial?.kind === 'editable' ? initial : LOOKS[0].avatar),
    };
    const current = () => drafts[mode];
    let section = 'looks';
    const category = { face: 'structure', clothes: 'top' };
    const history = [];
    const redo = [];
    let inputStart = null;

    const dialog = document.createElement('dialog');
    dialog.className = 'dialog creator';
    dialog.setAttribute('aria-labelledby', 'crTitle');
    dialog.innerHTML = studioMarkup(first, name);
    document.body.append(dialog);
    const find = (selector) => dialog.querySelector(selector);
    const tabs = find('.cr-tabs');
    const panel = find('.cr-controls');
    const canvas = find('canvas');
    const nameInput = find('#crName');
    const saveButton = find('#crSave');
    const undoButton = find('#crUndo');
    const redoButton = find('#crRedo');
    const status = find('.cr-status');
    const retryButton = find('#crRetry');
    let stage;
    let webGLFailed = false;
    let pending = null;
    let renderedKey;
    dialog.showModal();

    function showStatus(message = '', retry = false) {
      status.querySelector('span').textContent = message;
      status.hidden = !message;
      retryButton.hidden = !retry;
    }

    function webGLFailure() {
      webGLFailed = true;
      pending = null;
      saveButton.disabled = true;
      showStatus('La vista 3D necesita WebGL. Cierra el estudio y vuelve a abrirlo en un navegador compatible.');
    }

    try {
      stage = createAvatarStage(canvas, webGLFailure);
    } catch (error) {
      console.error(error);
      webGLFailure();
    }

    function setFrame(frame) {
      stage?.setFrame(frame);
      for (const button of dialog.querySelectorAll('[data-frame]')) {
        button.setAttribute('aria-pressed', String(button.dataset.frame === frame));
      }
    }

    function paintPanel({ top = false, focus = '' } = {}) {
      const scroll = panel.scrollTop;
      const available = SECTIONS[mode];
      tabs.innerHTML = available.map(([id, label, symbol]) => `
        <button id="crTab-${id}" type="button" role="tab" aria-selected="${section === id}"
          aria-controls="crPanelContent" tabindex="${section === id ? 0 : -1}" data-section="${id}">
          ${icon(symbol)}<span>${label}</span>
        </button>`).join('');
      panel.setAttribute('aria-labelledby', `crTab-${section}`);
      for (const button of dialog.querySelectorAll('[data-mode]')) {
        button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
      }
      panel.innerHTML = panelContent(mode, section, category, current());
      panel.scrollTop = top ? 0 : scroll;
      if (focus) find(focus)?.focus({ preventScroll: true });
    }

    function assetKey() {
      const c = current();
      if (mode === 'legacy') return JSON.stringify(c);
      return [mode, c.hair, c.top, c.top === 'dress' ? null : c.bottom, c.shoes].join('|');
    }

    async function refreshPreview() {
      if (webGLFailed) return;
      const key = assetKey();
      if (key === renderedKey) {
        pending = null;
        if (mode === 'editable') updateEditableAvatar(stage.model, current());
        saveButton.disabled = false;
        showStatus();
        return;
      }
      if (pending?.key === key) return;
      const job = { key };
      pending = job;
      saveButton.disabled = true;
      showStatus(stage.model ? 'Aplicando cambios…' : 'Cargando personaje…');
      try {
        if (mode === 'editable') await loadEditableAvatar(current());
        else await preloadAvatars();
        if (pending !== job) return;
        stage.replace(buildAvatar(current()));
        renderedKey = key;
        saveButton.disabled = false;
        showStatus();
      } catch (error) {
        if (pending !== job) return;
        console.error(error);
        showStatus('No se pudo cargar este aspecto.', true);
      } finally {
        if (pending === job) pending = null;
      }
    }

    const snapshot = () => ({ mode, drafts: { editable: { ...drafts.editable }, legacy: { ...drafts.legacy } } });
    function updateHistoryButtons() {
      undoButton.disabled = !history.length && !inputStart;
      redoButton.disabled = !redo.length || Boolean(inputStart);
    }
    function record(before) {
      if (JSON.stringify(before) !== JSON.stringify(snapshot())) {
        history.push(before);
        if (history.length > 40) history.shift();
        redo.length = 0;
      }
      updateHistoryButtons();
    }
    function finishInput() {
      if (!inputStart) return;
      const before = inputStart;
      inputStart = null;
      record(before);
    }
    function mutate(action, options) {
      finishInput();
      const before = snapshot();
      action();
      record(before);
      paintPanel(options);
      refreshPreview();
    }
    function restore(from, to) {
      finishInput();
      if (!from.length) return;
      const entry = from.pop();
      to.push(snapshot());
      if (mode !== entry.mode) {
        section = 'looks';
        setFrame('full');
      }
      mode = entry.mode;
      drafts = entry.drafts;
      updateHistoryButtons();
      paintPanel();
      refreshPreview();
    }

    function openSection(id) {
      finishInput();
      section = id;
      setFrame(id === 'face' || id === 'hair' ? 'face' : 'full');
      paintPanel({ top: true, focus: `[data-section="${id}"]` });
    }

    dialog.addEventListener('click', ({ target }) => {
      const button = target.closest('button');
      if (!button) return;
      const data = button.dataset;
      if (data.mode && data.mode !== mode) {
        mutate(() => { mode = data.mode; section = 'looks'; setFrame('full'); }, { top: true });
      } else if (data.section) {
        openSection(data.section);
      } else if (data.face || data.clothes) {
        finishInput();
        const group = data.face ? 'face' : 'clothes';
        category[group] = data[group];
        paintPanel({ top: true, focus: `[data-${group}="${data[group]}"]` });
      } else if (data.k && data.v !== undefined) {
        mutate(() => {
          if (data.k === 'look') drafts.editable = { ...LOOKS.find((look) => look.id === data.v).avatar };
          else current()[data.k] = data.v;
        }, { focus: `[data-k="${data.k}"][data-v="${data.v}"]` });
      } else if (data.reset) {
        mutate(() => { current()[data.reset] = Number(data.neutral); }, { focus: `[data-reset="${data.reset}"]` });
      } else if (data.gender || data.accessory) {
        mutate(() => {
          if (data.gender && current().gender !== data.gender) {
            current().gender = data.gender;
            current().model = MODELS[data.gender][0];
          } else if (data.accessory) current().accessory = data.accessory;
        });
      } else if (data.frame) {
        setFrame(data.frame);
      } else if (stage && data.viewCommand) {
        const commands = {
          left: () => stage.rotate(-1), right: () => stage.rotate(1),
          in: () => stage.magnify(-0.12), out: () => stage.magnify(0.13), reset: stage.reset,
        };
        commands[data.viewCommand]();
      }
    });

    dialog.addEventListener('input', ({ target }) => {
      if (!target.matches('[data-range], [data-color]')) return;
      inputStart ??= snapshot();
      updateHistoryButtons();
      const { k: key } = target.dataset;
      current()[key] = target.type === 'range' ? Number(target.value) : target.value;
      if (target.type === 'range') {
        const label = valueLabel(key, current()[key]);
        target.closest('.cr-slider').querySelector('output').value = label;
        target.setAttribute('aria-valuetext', label);
      } else {
        const palette = paletteFor(key);
        find(`[data-color-name="${key}"]`).textContent = palette.find(([color]) => color === target.value)?.[1] ?? 'Personalizado';
        for (const button of panel.querySelectorAll(`[data-color-option][data-k="${key}"]`)) {
          button.setAttribute('aria-pressed', String(button.dataset.v === target.value));
        }
      }
      refreshPreview();
    });

    dialog.addEventListener('change', ({ target }) => {
      if (target.matches('[data-range], [data-color]')) finishInput();
      if (target.id === 'crPose') stage?.setPose(target.value);
    });

    dialog.addEventListener('keydown', (event) => {
      if (event.target.dataset.section && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
        const ids = SECTIONS[mode].map(([id]) => id);
        const index = ids.indexOf(section);
        const next = { ArrowLeft: (index - 1 + ids.length) % ids.length, ArrowRight: (index + 1) % ids.length, Home: 0, End: ids.length - 1 };
        event.preventDefault();
        openSection(ids[next[event.key]]);
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && event.target !== nameInput) {
        event.preventDefault();
        if (event.shiftKey) restore(redo, history);
        else restore(history, redo);
      }
      event.stopPropagation();
    });

    const close = (result) => {
      pending = null;
      stage?.dispose();
      dialog.close();
      dialog.remove();
      resolve(result);
    };
    retryButton.onclick = refreshPreview;
    undoButton.onclick = () => restore(history, redo);
    redoButton.onclick = () => restore(redo, history);
    find('#crRandom').onclick = () => mutate(() => {
      if (mode === 'legacy') {
        drafts.legacy = normalizeLegacyAvatar(randomAvatar());
        return;
      }
      const c = { ...choose(LOOKS).avatar };
      for (const [key, , min, max] of [...BODY_CONTROLS, ...FACE_CONTROLS]) {
        c[key] = Math.max(min, Math.min(max, Number((c[key] + (Math.random() - 0.5) * (max - min) * 0.35).toFixed(2))));
      }
      c.hair = choose(HAIR)[0];
      drafts.editable = c;
    });
    find('#crCancel').onclick = find('#crClose').onclick = () => close(null);
    dialog.addEventListener('cancel', (event) => { event.preventDefault(); close(null); });
    nameInput.addEventListener('input', () => nameInput.setCustomValidity(''));
    saveButton.onclick = () => {
      const visibleName = nameInput.value.trim();
      if (!visibleName) {
        nameInput.setCustomValidity('Escribe un nombre para tu personaje.');
        nameInput.reportValidity();
        return;
      }
      close({ avatar: mode === 'editable' ? normalizeEditable(current()) : normalizeLegacyAvatar(current()), name: visibleName });
    };

    paintPanel();
    refreshPreview();
  });
}
