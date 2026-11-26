# Pulso · piso de trading en 3D

Demo funcional de una plataforma para comunidades de trading.

## Cómo abrirlo
Doble clic en **Abrir Pulso.cmd** (abre http://localhost:5173). Para cerrarlo, cierra la ventana negra.

## Creador de personajes

**Personalizado** permite ajustar forma corporal, altura, edad adulta, peso, musculatura y ocho rasgos del rostro. Incluye color de piel, iris y pelo, ocho peinados y opción de rapado. La ropa tiene colores independientes y alternativas por zona. Hay camiseta, camisa, sudadera, vestido, pantalón, short, falda, zapatos y botines. El vestido ocupa las dos zonas de ropa y conserva la elección de parte inferior para cuando vuelvas a usar una parte superior independiente.

**Looks prediseñados** conserva los 22 avatares Rocketbox, sus ajustes y accesorios. Las cuentas anteriores se abren con su look guardado. Solo cambian de modo al guardar un personaje del otro tipo.

En Linux puedes servir la carpeta del proyecto con `python -m http.server 5173 --bind 127.0.0.1` y abrir http://localhost:5173.

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
- `js/creator.js`, `js/human.js`, `js/editable-avatar.js`: editor, avatares y animaciones.
- `js/market.js`: datos de mercado e indicadores
- `js/ui.js`: paneles, chat, alertas y agentes
- `js/data.js`: contenido de ejemplo
- `server.ps1`: servidor local

## Créditos de los personajes (gratis, MIT)
Personas y animaciones: *Microsoft Rocketbox* (licencia MIT, uso personal y comercial), https://github.com/microsoft/Microsoft-Rocketbox
Licencia en `assets/rb/LICENSE_Rocketbox_MIT.md`. Las texturas se redujeron a 1024 px. Altura, complexión, tinte de piel y pelo, y accesorios se ajustan en el código.


## Créditos de los avatares editables (CC0)

Base, morphs, texturas, piezas y esqueleto proceden de [MakeHuman Community](https://static.makehumancommunity.org/about/license.html) y de los archivos CC0 preparados por Kasper Olesen para [CharacterCreator](https://github.com/kblood/CharacterCreator/tree/852e48f316b90a0937234886630e4fb4cdfd1f78). Pulso distribuye los GLB adaptados y los datos de articulaciones, junto con los clips CC0 de reposo, marcha y carrera. Sentarse y hablar se resuelven mediante poses y gestos propios de Pulso. El código GPL del generador se queda fuera de la aplicación.

Los GLB se adaptaron a Three.js r160 y se redujeron a los morphs y clips usados. El catálogo se descarga por selección. Consulta `assets/editable/UPSTREAM-LICENSES.md` para el origen y la licencia de cada pieza. La ropa se ajusta con morphs y pesos del esqueleto. Las faldas y el vestido pueden presentar intersecciones en poses extremas porque el piso no simula tela.
