# Progreso: campus Pulso

## Cómo abrirlo
- Doble clic en `Abrir Pulso.cmd` (usa Node si existe: `node server.mjs 5173`; si no, `server.ps1`). Abre http://localhost:5173 y pulsa «Entrar al campus».
- Teléfono en la misma red Wi-Fi: `server.mjs` imprime una dirección `http://<IP>:5173`. Si Windows pregunta por el firewall, permite redes privadas.
- Rutas: `#/campus` campus, `#/piso` oficina original (pisos 1 a 4), `#/lab` laboratorio (piso 5), `#/ai` Mi oficina IA (piso 6), `#/ai-full` aplicación original de Mi oficina IA.

## Un solo juego
Los tres edificios son interiores del mismo motor 3D de Pulso (`js/scene.js`): mismo personaje, avatares Rocketbox y editables, animaciones, cámara (1ª, 3ª, maqueta), controles, muros, mobiliario, materiales e iluminación. El campus usa tu mismo personaje y los mismos avatares como visitantes, con la lente de la cámara de Pulso.
- **Oficina Pulso:** pisos 1 a 4 sin cambios.
- **Laboratorio Pulso (piso 5, `js/offices.js`, `js/lab.js`, `js/miner.js`):** escritorios con seis agentes sentados (Directora, Riesgos, Macro, Análisis, Minero, Quant) más dos paseantes. Pantalla grande con precios reales e incubadora. Quioscos de Minería, Incubadora, Ranking y Riesgos, sala de comité, servidores (conexiones), y los quioscos de Alertas, Seguimiento y Agentes de Pulso, más el muro de mercado (Análisis). Acercarse a un agente abre su estado y su herramienta; los agentes hablan con datos reales.
- **Mi oficina IA (piso 6, `js/oficina-ai-data.js`):** los 26 agentes del artefacto, cada uno en su escritorio y departamento (Creación, Negocio, Pedidos, Crecimiento) y el director al fondo. Quioscos de Nuevo trabajo (17 flujos que los agentes simulan con burbujas), Mi negocio y Entregas. Cada agente abre su ficha (puesto, qué hace, qué entrega y en qué trabajos participa). La aplicación original con todas sus funciones sigue en `#/ai-full`.

## Probado en el navegador (escritorio y 375 px)
- Campus: puertas, aviso «Entrar», acceso rápido, entrada y salida de los tres edificios, minimapa, lugares del dueño guardados en el navegador y en el servidor.
- Edificios: pisos 1 a 4, las 10 zonas del laboratorio y las de Mi oficina IA abren sus paneles, el trabajo simulado hace hablar a los agentes, la minería corre desde el panel.
- Controles: Teclado, Mouse y Táctil (modo inicial según dispositivo, se recuerda). Joystick táctil en el campus y dentro de los edificios; formularios y paneles caben en 375 px.

## Pendiente por un bloqueo concreto
- **Publicar para abrirlo sin la laptop:** no hay un entorno de despliegue autorizado. Hace falta un hosting con un servicio que guarde `/__campus` (los lugares).
- **Entrar desde otro dispositivo con la misma cuenta:** las cuentas, el rol (Dueño/Miembro) y el progreso son locales (demo); `/__campus` no tiene autenticación. Hace falta un servidor de cuentas.
- **Mi oficina IA con agentes reales:** Gmail, Calendar, Drive, entregas y las órdenes dependen del entorno de Claude. En Pulso los flujos son simulación. El artefacto no traía `cotizaciones.js`, `video.js` ni los datos de «Mi negocio».
- **Laboratorio:** faltan Bybit (clave de solo lectura en un servidor), agentes con modelo de lenguaje (servidor y clave de API) y el webhook de TradingView (URL pública).
- No se probó con mando físico ni en un teléfono real; se simuló con el emulador del navegador.

## Notas técnicas
- Pisos 5 y 6 reutilizan el casco del edificio de Pulso; sus interiores y zonas están en `js/offices.js` y se registran en `scene.js` (`ZONES_BY[5|6]`, `OB`, `HS`, `SPAWN`).
- `edificio-ai/original.html` es la copia sin cambios del artefacto; `index.html` solo añade el botón al campus.
- `.claude/launch.json` (ignorado por git) arranca `server.mjs` en el puerto 5174 para las pruebas. En la consola existen `pulsoWorld` y `pulsoCampus` para pruebas manuales.
