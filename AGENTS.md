# Pulso: guía para agentes (Codex, Claude u otro)

Plataforma web para comunidades de trading: edificio 3D de 4 pisos con personas, clases, análisis con datos reales, alertas y juegos.
Idioma de la interfaz y del contenido: **español**. Sin bundler ni npm: módulos ES nativos + Three.js por CDN (importmap en `index.html`).

## Cómo ejecutar
- Windows: doble clic en `Abrir Pulso.cmd` (usa `server.ps1`, puerto 5173), o `powershell -ExecutionPolicy Bypass -File server.ps1`.
- Abrir http://localhost:5173. No hay build ni tests automáticos: se verifica en el navegador.

## Mapa del código
- `index.html`, `styles.css`: portada y HUD (pisos, vistas de cámara, dock, chat, panel lateral).
- `js/main.js`: rutas (`#/` portada, `#/piso` app), arranque, login y creador.
- `js/auth.js`: cuentas locales (usuario + contraseña con PBKDF2) en localStorage. **Solo demo**: producción necesita servidor.
- `js/creator.js`: creador de personaje con vista 3D previa.
- `js/human.js`: interfaz de avatares y estados de animación. Carga los looks Microsoft Rocketbox y dirige los avatares editables a `js/editable-avatar.js`.
- `js/editable-avatar.js`: carga GLB local bajo demanda, aplica morphs, ajusta las articulaciones y equipa mallas de pelo y ropa sobre el mismo esqueleto.
- `js/scene.js`: mundo 3D por pisos (`useFloor(n)`), muebles, colisiones (`OB`), puntos de paseo (`HS`), zonas (`ZONES_BY`), cámaras (primera persona, tercera, maqueta), pantallas con canvas.
- `js/ui.js`: paneles (salas, cursos, videoteca, análisis, alertas, agentes, conferencia, juegos), chat, minijuegos.
- `js/market.js`: precios en vivo (API pública de Binance), velas, RSI, medias, soportes/resistencias, escenarios.
- `js/data.js`: contenido de ejemplo (miembros, salas, cursos, agenda).
- `js/store.js`: estado persistente en localStorage (clave `pulso:v1`).

## Convenciones
- Para añadir algo a un piso: llamar `useFloor(n)` antes de crearlo, registrar obstáculos con `ob(...)`/`obC(...)` y puntos de paseo con `spot(...)`.
- Medidas del mundo: 40 x 30 m (x de -20 a 20, z de -15 a 15). Los personajes miran hacia +Z.
- No añadir luces puntuales sin necesidad (cada una encarece todos los materiales).
- Mantener textos en español y la paleta carbón/dorado (`--accent`).

## Assets y licencias
- `assets/rb/`: personas y animaciones de Microsoft Rocketbox (MIT). Texturas reducidas a 1024 px. Licencia en `assets/rb/LICENSE_Rocketbox_MIT.md`.
- Los modelos originales vienen de https://github.com/microsoft/Microsoft-Rocketbox (FBX, esqueleto `Bip01`).

- `assets/editable/`: GLB y datos de articulaciones CC0 de MakeHuman/MPFB2, preparados por Kasper Olesen (CharacterCreator) y adaptados para Pulso. Consulta `assets/editable/UPSTREAM-LICENSES.md` y el README para la revisión exacta. No se incluye código del generador.
- Los avatares editables usan movimientos CC0 propios de su rig para reposo, marcha y carrera. Pulso construye las poses de silla y los gestos de conversación. Los looks Rocketbox conservan sus clips FBX.

## Pendiente / ideas
- Multijugador real (WebSocket), voz/video/pantalla compartida (LiveKit), cuentas y pagos en servidor.
- Webhook real de TradingView y agentes con modelo de lenguaje.
- Ajustar la posición de gafas y gorra (`GL` y `CAP` en `js/human.js`).
- Más personajes de Rocketbox (hay ~40 adultos, niños y profesiones).

## Estado actual (relevo entre IAs)
Hecho y probado en navegador:
- 4 pisos: 1 Clases, 2 Análisis, 3 Conferencias (tarima + audiencia sentada), 4 Sala de juegos (2 minijuegos). Selector a la derecha y teclas 1-4.
- 3 vistas de cámara (tecla V): primera persona, tercera persona, maqueta.
- Login local y creador con dos modos. Personalizado ofrece sliders de cuerpo y rostro, colores, ocho peinados más rapado y ropa modular. Looks prediseñados conserva los 22 modelos Rocketbox, sus tintes y sus accesorios.
- Decoración por piso (biblioteca, centro de cómputo, trading desks, foyer, bar, casino, arcades).

Notas técnicas:
- `preloadAvatars()` prepara los looks Rocketbox antes del creador y del mundo. `loadEditableAvatar()` prepara el GLB, el pelo y las prendas seleccionadas antes de construir el avatar editable.
- `js/store.js` marca los avatares anteriores como `kind: legacy` al leerlos, conservando sus campos. `normalizeLegacyAvatar()` aplica los valores de respaldo. Los nuevos personalizables se guardan con `kind: editable`.
- `server.ps1` acepta `POST /__save?path=assets/...` solo para guardar archivos convertidos; es una herramienta local de desarrollo.
- Repositorio: https://github.com/rayanelyasin/proyecto-trading-floor (rama `master`).

Flujo de trabajo: leer este archivo, abrir `Abrir Pulso.cmd`, hacer cambios pequeños, verificar en el navegador y crear un commit local. Subir a GitHub solo con autorización del usuario.
