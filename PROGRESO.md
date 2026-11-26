# Progreso: campus Pulso

## Cómo abrirlo
- Doble clic en `Abrir Pulso.cmd` (usa Node si existe: `node server.mjs 5173`; si no, `server.ps1`). Abre http://localhost:5173 y entra con «Entrar al campus».
- Teléfono en la misma red Wi-Fi: `server.mjs` imprime una dirección `http://<IP>:5173`. Si Windows pregunta por el firewall, permite redes privadas.
- Rutas: `#/campus` campus, `#/piso` oficina original, `#/lab` laboratorio, `#/ai` Mi oficina IA.

## Hecho y probado en el navegador (escritorio y 375 px)
- **Campus 3D** (`js/campus.js`, `js/campus-ui.js`, `campus.css`): plaza con fuente, caminos, árboles, estacionamiento con carros, estanque, montañas, visitantes, minimapa y acceso rápido a los tres edificios. Puertas con aviso «Entrar» y regreso al campus desde cada edificio (aparece frente a la puerta por la que salió).
- **Oficina Pulso** (original): sin cambios en sus 4 pisos, solo botón «← Campus» y selector de controles.
- **Laboratorio Pulso** (edificio nuevo, `js/lab.js`, `js/miner.js`, `lab.css`): minería con velas reales de Binance (entrenamiento 70 % / fuera de muestra 30 %, caída máx. 55 %, robustez a parámetros vecinos, costos x3), incubadora con examen en simulación, ranking, comité, riesgos, macro y análisis, y conexiones. Los agentes conversan con datos reales y la sala de agentes de la oficina muestra las estrategias.
- **Mi oficina IA** (`edificio-ai/index.html`): código y modelos del artefacto «Mi Oficina IA · Copia» sin cambios visuales (personajes, animaciones, muebles, selector táctil/ratón/mando). Botón «← Campus» añadido en su barra superior.
- **Controles**: selector Teclado / Mouse / Táctil (se elige según el dispositivo y se recuerda). Joystick táctil en el campus y en la oficina original.
- **Lugares del dueño**: el dueño añade, edita y elimina lugares (nombre, descripción, color, ubicación y proyecto enlazado). Se guardan en el navegador y en el servidor (`/__campus` → `data/campus.json`). Tras borrar el almacenamiento local, el lugar vuelve desde el servidor. Hay 4 terrenos reservados para edificios futuros. Los miembros solo visitan.

## Pendiente por un bloqueo concreto
- **Publicar para abrirlo sin la laptop**: no hay un entorno de despliegue autorizado. El proyecto es estático salvo `/__campus`; hace falta un hosting con un servicio que guarde ese JSON (por ejemplo Vercel con una función y almacenamiento). Falta: acceso al hosting.
- **Otro dispositivo con la misma cuenta**: las cuentas, el rol (Dueño/Miembro) y el progreso son locales (demo). Solo los lugares viajan por el servidor, y `/__campus` no tiene autenticación. Hace falta un servidor de cuentas.
- **Mi oficina IA fuera de Claude**: funciona en «vista previa». Gmail, Calendar, Drive, la base de datos y las órdenes a los agentes dependen del entorno de Claude. Opcionales que no estaban en el artefacto: `cotizaciones.js`, `video.js` y los datos de «Mi negocio».
- **Laboratorio**: faltan Bybit (clave de solo lectura en un servidor), agentes con modelo de lenguaje (servidor y clave de API) y webhook de TradingView (URL pública).
- No se probó con mando físico ni en un teléfono real; se simuló con el emulador del navegador.

## Notas técnicas
- `edificio-ai/original.html` es la copia sin cambios del artefacto; `index.html` solo añade el botón al campus.
- `assets/oficina-ai/` quedó vacía (los modelos se movieron a `edificio-ai/modelos/`).
- `.claude/launch.json` arranca `server.mjs` en el puerto 5174 para las pruebas.
