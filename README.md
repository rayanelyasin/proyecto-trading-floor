# Pulso · piso de trading en 3D

Demo funcional de una plataforma para comunidades de trading.

## Cómo abrirlo

En Windows, haz doble clic en **Abrir Pulso.cmd** y abre http://localhost:5173. Para cerrarlo, cierra la ventana del servidor. En macOS o Linux, ejecuta `python3 -m http.server 5173 --bind 127.0.0.1` desde la carpeta del proyecto.

Se necesita un navegador con WebGL y acceso a internet para las bibliotecas del CDN y el mercado. Conserva el mismo navegador, perfil y dirección para abrir tus cuentas y progreso locales después de instalar una actualización.

## Estudio de personajes

Al crear una cuenta se abre el estudio. Si ya tienes cuenta, entra al piso y pulsa tu nombre en la barra superior.

- **Personalizado** ofrece seis estilos de partida, seis ajustes corporales, trece controles faciales, ocho peinados más rapado y nueve opciones de ropa y calzado. Los colores se ajustan por separado. El vestido ocupa las zonas de arriba y abajo y conserva tu elección de parte inferior.
- **Prediseñados** conserva los 22 avatares de Rocketbox, sus ajustes y accesorios. Las cuentas anteriores se abren con su look guardado.
- Puedes rotar el personaje, acercarte al rostro, probar animaciones y deshacer o rehacer cambios antes de guardar. Con el lienzo enfocado, las flechas izquierda y derecha giran el personaje y `+` y `-` controlan el zoom.

## Actividades por piso

Abre **Explorar piso** para entrar directamente a una actividad o caminar hasta su estación.

| Piso | Actividades añadidas |
| --- | --- |
| Clases | Biblioteca con glosario filtrable y un cuaderno de estudio local |
| Análisis | Lista de seguimiento con favoritos y acceso al análisis del activo |
| Conferencias | Programa de ejemplo del auditorio con sesiones guardadas |
| Juegos | Memoria de seis parejas con récord local |

El explorador y los clics en el suelo calculan un camino alrededor del mobiliario. Los favoritos, apuntes, sesiones guardadas y récord de Memoria se guardan por cuenta en este navegador.

## Qué es real y qué es de ejemplo
| Real | De ejemplo |
|---|---|
| Precios de Binance cuando está disponible (API pública, sin clave) | Miembros, salas, cursos y grabaciones |
| Velas, MM50/200, RSI, ATR, soportes/resistencias y escenarios calculados | Agenda de noticias |
| Calculadora de riesgo | Webhook de TradingView y exchange (simulados) |
| Alertas de precio y RSI que se evalúan en vivo | Chat: los demás miembros son bots |
| Compartir pantalla en el aula (solo la ves tú) | |
| Subir y reproducir un video (local) | |
| Progreso, avatar, favoritos y apuntes (guardados en el navegador) | |

Cuando falla el proveedor de mercado, Pulso etiqueta los precios y las velas simuladas.

## Para llevarlo a producción
- Multijugador real (posiciones y chat): servidor WebSocket (por ejemplo Colyseus o Supabase Realtime).
- Voz, video y pantalla compartida para todos: LiveKit o Daily.
- Cuentas y pagos: Supabase Auth o Clerk, y Stripe o Mercado Pago.
- Base de datos para salas, cursos, alertas y progreso: Supabase/Postgres.
- Agentes con IA: un modelo de lenguaje que redacte el análisis a partir de los indicadores ya calculados.
- Webhook de TradingView: un endpoint en el servidor que reciba las alertas.

## Estructura
- `index.html`: portada y piso
- `styles.css`, `floor.css`, `creator.css`: portada, interfaz del edificio y estudio
- `js/scene.js`, `js/floor-path.js`: mundo 3D (Three.js) y rutas entre colisiones
- `js/creator.js`, `js/creator-stage.js`, `js/creator-catalog.js`: estudio, vista 3D y catálogo.
- `js/human.js`, `js/editable-avatar.js`: avatares, morphs, ropa y animaciones.
- `js/market.js`: datos de mercado e indicadores
- `js/ui.js`, `js/floor-activities.js`: paneles, chat y actividades
- `js/data.js`: contenido de ejemplo
- `server.ps1`: servidor local

## Créditos de los personajes (gratis, MIT)
Personas y animaciones: *Microsoft Rocketbox* (licencia MIT, uso personal y comercial), https://github.com/microsoft/Microsoft-Rocketbox
Licencia en `assets/rb/LICENSE_Rocketbox_MIT.md`. Las texturas se redujeron a 1024 px. Altura, complexión, tinte de piel y pelo, y accesorios se ajustan en el código.


## Créditos de los avatares editables (CC0)

Base, morphs, texturas, piezas y esqueleto proceden de [MakeHuman Community](https://static.makehumancommunity.org/about/license.html) y de los archivos CC0 preparados por Kasper Olesen para [CharacterCreator](https://github.com/kblood/CharacterCreator/tree/852e48f316b90a0937234886630e4fb4cdfd1f78). Pulso distribuye los GLB adaptados y los datos de articulaciones, junto con los clips CC0 de reposo, marcha y carrera. Sentarse y hablar se resuelven mediante poses y gestos propios de Pulso. El código GPL del generador se queda fuera de la aplicación.

Los GLB se adaptaron a Three.js r160 y se redujeron a los morphs y clips usados. Cada modelo de pelo o ropa se carga al seleccionarlo. Las miniaturas en `assets/creator/` se renderizaron a partir de esas piezas CC0. Consulta `assets/editable/UPSTREAM-LICENSES.md` para el origen y la licencia de cada pieza. La ropa se ajusta con morphs y pesos del esqueleto. Las faldas y el vestido pueden presentar intersecciones en poses extremas porque el piso no simula tela.
