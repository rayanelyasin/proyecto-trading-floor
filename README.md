# Pulso · piso de trading en 3D

Demo funcional de una plataforma para comunidades de trading.

## Cómo abrirlo
Doble clic en **Abrir Pulso.cmd** (abre http://localhost:5173). Para cerrarlo, cierra la ventana negra.

## Qué es real y qué es de ejemplo
| Real | De ejemplo |
|---|---|
| Precios en vivo (API pública de Binance, sin clave) | Miembros, salas, cursos y grabaciones |
| Velas, MM50/200, RSI, ATR, soportes/resistencias y escenarios calculados | Agenda de noticias |
| Calculadora de riesgo | Webhook de TradingView y exchange (simulados) |
| Alertas de precio y RSI que se evalúan en vivo | Chat: los demás miembros son bots |
| Compartir pantalla en el aula (solo la ves tú) | |
| Subir y reproducir un video (local) | |
| Progreso de cursos, alertas y ajustes (guardados en el navegador) | |

## Para llevarlo a producción
- Multijugador real (posiciones y chat): servidor WebSocket (por ejemplo Colyseus o Supabase Realtime).
- Voz, video y pantalla compartida para todos: LiveKit o Daily.
- Cuentas y pagos: Supabase Auth o Clerk, y Stripe o Mercado Pago.
- Base de datos para salas, cursos, alertas y progreso: Supabase/Postgres.
- Agentes con IA: un modelo de lenguaje que redacte el análisis a partir de los indicadores ya calculados.
- Webhook de TradingView: un endpoint en el servidor que reciba las alertas.

## Estructura
- `index.html`: portada y piso
- `styles.css`: diseño
- `js/scene.js`: mundo 3D (Three.js)
- `js/market.js`: datos de mercado e indicadores
- `js/ui.js`: paneles, chat, alertas y agentes
- `js/data.js`: contenido de ejemplo
- `server.ps1`: servidor local

## Créditos de los personajes (gratis, MIT)
Personas y animaciones: *Microsoft Rocketbox* (licencia MIT, uso personal y comercial), https://github.com/microsoft/Microsoft-Rocketbox
Licencia en `assets/rb/LICENSE_Rocketbox_MIT.md`. Las texturas se redujeron a 1024 px. Altura, complexión, tinte de piel y pelo, y accesorios se ajustan en el código.
