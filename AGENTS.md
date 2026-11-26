# Pulso: guía para agentes (Codex, Claude u otro)

Plataforma web para comunidades de trading: edificio 3D de 4 pisos con personas, clases, análisis con datos reales, alertas y juegos.
Idioma de la interfaz y del contenido: **español**. Sin bundler ni npm: módulos ES nativos + Three.js por CDN (importmap en `index.html`).

## Cómo ejecutar
- Windows: doble clic en `Abrir Pulso.cmd` (usa `server.mjs` con Node, o `server.ps1` si no hay Node; puerto 5173). También `node server.mjs 5173`.
- Abrir http://localhost:5173. No hay build ni tests automáticos: se verifica en el navegador.

## Mapa del código
- `index.html`, `styles.css`, `floor.css` y `creator.css`: portada, HUD y estudio de personajes.
- `js/main.js`: rutas (`#/` portada, `#/piso` app), arranque, login y creador.
- `js/auth.js`: cuentas locales (usuario + contraseña con PBKDF2) en localStorage. **Solo demo**: producción necesita servidor.
- `js/creator.js`: estudio de personajes y borradores. Usa `js/creator-stage.js` para la vista 3D y `js/creator-catalog.js` para los estilos y colores.
- `js/human.js`: interfaz de avatares y estados de animación. Carga los looks Microsoft Rocketbox y dirige los avatares editables a `js/editable-avatar.js`.
- `js/editable-avatar.js`: carga GLB local bajo demanda, aplica morphs, ajusta las articulaciones y equipa mallas de pelo y ropa sobre el mismo esqueleto.
- `js/scene.js`: mundo 3D por pisos (`useFloor(n)`), muebles, colisiones (`OB`), puntos de paseo (`HS`), zonas (`ZONES_BY`), cámaras (primera persona, tercera, maqueta), pantallas con canvas.
- `js/ui.js`: paneles, explorador del piso, chat, alertas y agentes. `js/floor-activities.js` contiene biblioteca, seguimiento, programa y memoria.
- `js/floor-path.js`: búsqueda de una ruta con las colisiones de `js/scene.js` para el suelo, minimapa y destinos del explorador.
- `js/market.js`: precios en vivo (API pública de Binance), velas, RSI, medias, soportes/resistencias, escenarios.
- `js/data.js`: contenido de ejemplo (miembros, salas, cursos, agenda).
- `js/store.js`: estado persistente en localStorage (clave `pulso:v1`).

- `js/campus.js`, `js/campus-ui.js`, `js/campus-data.js`: campus 3D (#/campus), controles (teclado, mouse, táctil), lugares del dueño y su guardado (`/__campus`).
- `js/offices.js`, `js/lab.js`, `js/miner.js`: pisos 5 (Laboratorio) y 6 (Mi oficina IA) dentro del motor de scene.js, sus agentes y el motor de minería (solo simulación).
- `edificio-ai/`: aplicación original de Mi oficina IA (#/ai-full) con sus modelos; `js/oficina-ai-data.js` tiene sus 26 agentes y 17 flujos. `js/floor-controls.js`: selector de controles de los edificios.
- `js/quality.js`: calidad gráfica por dispositivo (auto, alta, media, baja).
- `PROGRESO.md`: estado del campus y bloqueos pendientes.

## Convenciones
- Para añadir algo a un piso: llamar `useFloor(n)` antes de crearlo, registrar obstáculos con `ob(...)`/`obC(...)` y puntos de paseo con `spot(...)`. Para un destino interactivo, añade su zona a `ZONES_BY`, su panel a `PANELS` y deja un punto de aproximación fuera de la colisión.
- Medidas del mundo: 40 x 30 m (x de -20 a 20, z de -15 a 15). Los personajes miran hacia +Z.
- No añadir luces puntuales sin necesidad (cada una encarece todos los materiales).
- Mantener textos en español y la paleta carbón/dorado (`--accent`).

## Assets y licencias
- `assets/rb/`: personas y animaciones de Microsoft Rocketbox (MIT). Texturas reducidas a 1024 px. Licencia en `assets/rb/LICENSE_Rocketbox_MIT.md`.
- Los modelos originales vienen de https://github.com/microsoft/Microsoft-Rocketbox (FBX, esqueleto `Bip01`).

- `assets/editable/`: GLB y datos de articulaciones CC0 de MakeHuman/MPFB2, preparados por Kasper Olesen (CharacterCreator) y adaptados para Pulso. Consulta `assets/editable/UPSTREAM-LICENSES.md` y el README para la revisión exacta. No se incluye código del generador.
- `assets/creator/`: miniaturas renderizadas de las mallas CC0. La portada usa una captura de Pulso.
- Los avatares editables usan movimientos CC0 propios de su rig para reposo, marcha y carrera. Pulso construye las poses de silla y los gestos de conversación. Los looks Rocketbox conservan sus clips FBX.

## Pendiente / ideas
- Multijugador real (WebSocket), voz/video/pantalla compartida (LiveKit), cuentas y pagos en servidor.
- Webhook real de TradingView y agentes con modelo de lenguaje.
- Ajustar la posición de gafas y gorra (`GL` y `CAP` en `js/human.js`).
- Más personajes de Rocketbox (hay ~40 adultos, niños y profesiones).

## Estado actual (relevo entre IAs)
Hecho y probado en navegador:
- 4 pisos: 1 Clases, 2 Análisis, 3 Conferencias (tarima + audiencia sentada), 4 Sala de juegos (3 minijuegos). Selector a la derecha y teclas 1-4.
- 3 vistas de cámara (tecla V): primera persona, tercera persona, maqueta.
- Login local y creador con dos modos. Personalizado ofrece seis estilos de partida, controles de cuerpo y rostro, colores, pelo y ropa modular, deshacer/rehacer y vista de animaciones. Prediseñados conserva los 22 modelos Rocketbox, sus tintes y accesorios.
- Estaciones físicas y explorador por piso. Biblioteca con notas, seguimiento con favoritos, programa con sesiones guardadas y Memoria con récord pertenecen a la cuenta local.

Notas técnicas:
- `preloadAvatars()` prepara los looks Rocketbox cuando se necesitan en el estudio y antes de crear el mundo. `loadEditableAvatar()` prepara el GLB, pelo y prendas seleccionados. Al editar una cuenta existente se pausa el mundo 3D mientras se muestra la vista del estudio.
- `js/store.js` marca los avatares anteriores como `kind: legacy` al leerlos, conservando sus campos. `normalizeLegacyAvatar()` aplica los valores de respaldo. Los nuevos personalizables se guardan con `kind: editable`.
- `server.ps1` acepta `POST /__save?path=assets/...` solo para guardar archivos convertidos; es una herramienta local de desarrollo.
- Repositorio: https://github.com/rayanelyasin/proyecto-trading-floor (rama `master`).

Flujo de trabajo: leer este archivo, abrir `Abrir Pulso.cmd`, hacer cambios pequeños, verificar en el navegador y crear un commit local. Subir a GitHub solo con autorización del usuario.
