// Contenido de ejemplo. En producción viene de la base de datos de la comunidad.

export const BRAND = 'Pulso';

export const MEMBERS = [
  { id: 'm1', name: 'Camila', color: '#c47b5a', role: 'mentora', floor: 1 },
  { id: 'm2', name: 'Andrés', color: '#6f8fb3', role: 'miembro', floor: 1 },
  { id: 'm3', name: 'Valentina', color: '#a8677a', role: 'miembro', floor: 2 },
  { id: 'm4', name: 'Diego', color: '#c9a96e', role: 'miembro', floor: 2 },
  { id: 'm5', name: 'Sofía', color: '#6f9a7f', role: 'miembro', floor: 2 },
  { id: 'm6', name: 'Mateo', color: '#8a82a8', role: 'miembro', floor: 4 },
  { id: 'm7', name: 'Lucía', color: '#b98a5e', role: 'miembro', floor: 4 },
  { id: 'm8', name: 'Tomás', color: '#8fa9b5', role: 'miembro', floor: 4 },
  ...['Bruno', 'Elena', 'Pablo', 'Marta', 'Iván', 'Nora', 'Hugo', 'Alba', 'Raúl', 'Inés', 'Leo', 'Carla'].map((name, i) => ({ id: 'a' + i, name, color: '#8a8478', role: 'miembro', floor: 3 })),
];

export const AVATAR_COLORS = ['#d9bf8c', '#6f8fb3', '#c47b5a', '#6f9a7f', '#a8677a', '#8a82a8', '#e8e2d6', '#3a3d44'];

const at = (h, m = 0, dayOffset = 0) => { const d = new Date(); d.setDate(d.getDate() + dayOffset); d.setHours(h, m, 0, 0); return d.getTime(); };

export const ROOMS = [
  { id: 'r1', title: 'Apertura de Londres', host: 'Camila', start: Date.now() - 25 * 60000, mins: 60, live: true },
  { id: 'r2', title: 'Revisión del oro', host: 'Andrés', start: at(18), mins: 45 },
  { id: 'r3', title: 'Gestión del riesgo en vivo', host: 'Valentina', start: at(19, 30, 1), mins: 60 },
  { id: 'r4', title: 'Análisis semanal', host: 'Diego', start: at(11, 0, 3), mins: 90 },
];

export const SLIDES = [
  { title: 'Apertura de Londres', bullets: ['Qué mirar en los primeros 30 minutos', 'Rango asiático: máximos y mínimos', 'Liquidez antes del movimiento real'] },
  { title: 'Marcar el rango asiático', bullets: ['Desde las 00:00 hasta las 07:00 GMT', 'El máximo y el mínimo son imanes de liquidez', 'No operar dentro del rango'] },
  { title: 'Confirmación', bullets: ['Barrido del extremo del rango', 'Cierre de vela de regreso dentro', 'Entrada con stop detrás del barrido'] },
  { title: 'Gestión de la posición', bullets: ['Riesgo fijo: 0,5 % a 1 % por operación', 'Primer objetivo: el extremo opuesto', 'Mover el stop a cero tras 1R'] },
  { title: 'Preguntas', bullets: ['Escribe en el chat del piso', 'La grabación queda en la videoteca'] },
];

export const COURSES = [
  {
    id: 'c1', title: 'Lectura de velas', level: 'Inicial', lessons: [
      { title: 'Qué cuenta una vela', mins: 6, body: 'Cada vela resume cuatro precios de un período: apertura, máximo, mínimo y cierre. El cuerpo muestra quién ganó el período; las mechas, hasta dónde se intentó llevar el precio y fue rechazado.' },
      { title: 'Mechas largas y rechazo', mins: 7, body: 'Una mecha larga en un nivel importante indica que el precio visitó la zona y fue devuelto con fuerza. Sola no es una señal: gana valor cuando aparece en un soporte o resistencia que ya marcaste.' },
      { title: 'Velas envolventes', mins: 8, body: 'Una envolvente cubre por completo el cuerpo de la vela anterior. Muestra un cambio de control entre compradores y vendedores, y es más fiable en temporalidades altas.' },
      { title: 'Doji e indecisión', mins: 5, body: 'Apertura y cierre casi iguales: nadie ganó. Tras una tendencia larga puede anticipar una pausa; en medio de un rango no aporta mucho.' },
      { title: 'Contexto antes que patrón', mins: 9, body: 'El mismo patrón significa cosas distintas según dónde aparece. Primero define tendencia y niveles; después busca la vela que confirme tu idea.' },
      { title: 'Práctica guiada', mins: 12, body: 'Abre el gráfico del muro, elige BTC en 4 h y marca las últimas cinco velas de rechazo. Compara dónde aparecieron con los niveles que calculó el agente.' },
    ],
  },
  {
    id: 'c2', title: 'Gestión del riesgo', level: 'Esencial', lessons: [
      { title: 'El riesgo se decide antes de entrar', mins: 6, body: 'Antes de abrir una operación debes saber cuánto puedes perder en dinero. Ese número define el tamaño de la posición, no al revés.' },
      { title: 'Tamaño de posición', mins: 8, body: 'Tamaño = dinero en riesgo ÷ distancia al stop. Con 1.000 USD de capital y 1 % de riesgo arriesgas 10 USD; si el stop está a 50 USD del precio de entrada, el tamaño es 0,2 unidades. La calculadora del análisis lo hace por ti.' },
      { title: 'Relación riesgo/beneficio', mins: 7, body: 'Si arriesgas 1 para ganar 2 (2R), con un 40 % de aciertos sigues siendo rentable. Busca operaciones de al menos 1,5R.' },
      { title: 'Rachas y drawdown', mins: 7, body: 'Diez pérdidas seguidas pasan incluso con un buen sistema. Con 1 % por operación pierdes cerca del 10 %; con 5 %, cerca del 40 %. El riesgo bajo te mantiene en el juego.' },
      { title: 'Diario de operaciones', mins: 6, body: 'Anota entrada, stop, objetivo, motivo y resultado. Al mes sabrás qué configuraciones te funcionan de verdad.' },
    ],
  },
  {
    id: 'c3', title: 'Estructura de mercado', level: 'Intermedio', lessons: [
      { title: 'Máximos y mínimos', mins: 7, body: 'Tendencia alcista: máximos y mínimos cada vez más altos. Bajista: cada vez más bajos. Cuando se rompe esa secuencia, la estructura cambia.' },
      { title: 'Soportes y resistencias', mins: 8, body: 'Son zonas donde el precio giró antes. El agente de niveles las detecta buscando giros en las últimas velas y agrupando los que están cerca.' },
      { title: 'Rupturas y retesteos', mins: 8, body: 'Una resistencia rota suele convertirse en soporte. Esperar el retesteo da entradas con stop más corto.' },
      { title: 'Medias móviles de 50 y 200', mins: 6, body: 'Cuando la de 50 cruza por encima de la de 200 se habla de cruce dorado; por debajo, de cruce de la muerte. Sirven para filtrar la dirección, no para entrar.' },
      { title: 'Multitemporalidad', mins: 9, body: 'Define la dirección en diario, los niveles en 4 h y la entrada en 1 h o 15 min.' },
    ],
  },
  {
    id: 'c4', title: 'Psicología del trading', level: 'Todos', lessons: [
      { title: 'Miedo a quedarse fuera', mins: 5, body: 'Entrar tarde a un movimiento suele dejar el stop lejos y el objetivo cerca. Si no estaba en tu plan, no es tu operación.' },
      { title: 'Venganza tras una pérdida', mins: 5, body: 'Duplicar el tamaño para recuperar es la forma más rápida de vaciar una cuenta. Ponte un límite diario de pérdidas.' },
      { title: 'Rutina antes de operar', mins: 6, body: 'Revisa la agenda económica, marca niveles, define escenarios y solo entonces mira las entradas.' },
      { title: 'Revisión semanal', mins: 7, body: 'Una vez por semana revisa tu diario con la comunidad. La sala de análisis semanal está pensada para esto.' },
    ],
  },
];

export const RECORDINGS = [
  { id: 'v1', title: 'Apertura de Londres', host: 'Camila', mins: 54, date: 'Ayer' },
  { id: 'v2', title: 'Revisión semanal', host: 'Diego', mins: 72, date: 'Sáb' },
  { id: 'v3', title: 'Cómo marcar niveles en 4 h', host: 'Andrés', mins: 38, date: 'Jue' },
  { id: 'v4', title: 'Preguntas y respuestas: riesgo', host: 'Valentina', mins: 46, date: 'Mar' },
];

export const AGENTS = [
  { id: 'a1', name: 'Niveles', role: 'Soportes y resistencias', color: '#d9bf8c' },
  { id: 'a2', name: 'Tendencia', role: 'Medias móviles y RSI', color: '#6f8fb3' },
  { id: 'a3', name: 'Escenarios', role: 'Plan alcista y bajista', color: '#8a82a8' },
  { id: 'a4', name: 'Agenda', role: 'Noticias y eventos', color: '#d9a35f' },
];

// Agenda de ejemplo (en producción viene de un proveedor de noticias).
export const AGENDA = [
  { time: '09:30', title: 'Dato de inflación mensual (EE. UU.)', impact: 'alto' },
  { time: '11:00', title: 'Discurso de un miembro de la Fed', impact: 'medio' },
  { time: '15:00', title: 'Inventarios de petróleo', impact: 'bajo' },
];

export const NPC_LINES = [
  '¿Alguien está mirando BTC en 1 h?', 'Ese R1 ya lo tocó dos veces hoy', 'Voy al aula, empieza la clase',
  'Hoy hay dato de inflación, ojo', 'Esperando el retesteo antes de entrar', 'Mi regla: nunca más de 1 %',
  'El oro está muy lateral', '¿Vieron el RSI en ETH?', 'Buenísima la lección de velas envolventes',
  'Hoy no opero, solo miro', 'Anoté todo en el diario', 'Ese barrido del rango asiático fue de libro',
];

export const NPC_REPLIES = [
  { k: ['hola', 'buenas', 'hey', 'saludos'], r: ['¡Hola! Bienvenido al piso', 'Buenas, ¿cómo va?', '¡Hey! ¿Vienes a la clase?'] },
  { k: ['btc', 'bitcoin'], r: ['BTC sigue respetando los niveles del muro', 'Yo espero que confirme sobre R1'] },
  { k: ['oro', 'gold', 'xau', 'paxg'], r: ['El oro lo revisa Andrés hoy a las 18:00', 'Oro en rango, paciencia'] },
  { k: ['riesgo', 'stop', 'lote', 'tamaño'], r: ['Usa la calculadora del análisis, te da el tamaño exacto', '1 % por operación y duermes tranquilo'] },
  { k: ['clase', 'aula', 'sala'], r: ['La de Camila está en vivo ahora en el aula', 'Vamos al aula, está buena'] },
  { k: ['curso', 'lección', 'leccion'], r: ['Los cursos están en los puestos de la derecha', 'Empieza por Gestión del riesgo'] },
];
export const NPC_GENERIC = ['Buena pregunta', 'Totalmente', 'Jaja sí', 'Mmm, no sé, ¿qué dice el agente?', 'Coincido'];

export const AUDIENCE_REPLIES = ['👏 ¡Excelente!', 'Muy claro, gracias', '¿Puedes repetir eso?', 'Buen punto', '👏👏', 'Tomando nota', 'Me gustó el ejemplo', '¿Habrá grabación?'];
