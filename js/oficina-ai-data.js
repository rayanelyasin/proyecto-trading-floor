// Datos de «Mi oficina IA», extraídos del artefacto original (edificio-ai/original.html).
// Cada empleado es un agente; cada trabajo es una cadena de agentes que se pasan el encargo.
export const OFICINA = {
  "marca": "ELAURAVZLA",
  "dueno": "Rayan",
  "meta": {
    "titulo": "Mi meta",
    "valor": "$10,000/mes",
    "detalle": "contenido · ventas · libertad"
  },
  "empleados": [
    {
      "id": "director",
      "puesto": "Director",
      "hace": "Reparte el trabajo a todos",
      "haciendo": "Repartiendo el trabajo",
      "entrega": "el brief"
    },
    {
      "id": "ganchos",
      "puesto": "El del gancho",
      "hace": "Escribe los primeros 3 segundos",
      "haciendo": "Escribiendo 7 ganchos",
      "entrega": "7 ganchos"
    },
    {
      "id": "guiones",
      "puesto": "Guionista",
      "hace": "Convierte ideas en guiones",
      "haciendo": "Armando el guion",
      "entrega": "el guion"
    },
    {
      "id": "captions",
      "puesto": "Captions",
      "hace": "Escribe captions con tu voz",
      "haciendo": "Escribiendo el caption",
      "entrega": "el caption"
    },
    {
      "id": "calendario",
      "puesto": "Calendario",
      "hace": "Planifica tu semana o mes",
      "haciendo": "Agendando la semana",
      "entrega": "el calendario"
    },
    {
      "id": "carruseles",
      "puesto": "Carruseles",
      "hace": "Clona carruseles ganadores",
      "haciendo": "Armando el carrusel",
      "entrega": "el carrusel"
    },
    {
      "id": "ideas",
      "puesto": "Investigador",
      "hace": "Encuentra ideas que funcionan",
      "haciendo": "Buscando ideas",
      "entrega": "10 ideas"
    },
    {
      "id": "mi-voz",
      "puesto": "Estratega de marca",
      "hace": "Guarda tu voz y tu marca",
      "haciendo": "Puliendo tu voz",
      "entrega": "tu guía de voz"
    },
    {
      "id": "contratar",
      "puesto": "Recursos Humanos",
      "hace": "Contrata empleados nuevos",
      "haciendo": "Entrevistando un empleado",
      "entrega": "un empleado nuevo"
    },
    {
      "id": "atencion-clientes",
      "puesto": "Atención al cliente",
      "hace": "Responde a tus clientes con tu voz",
      "haciendo": "Respondiendo mensajes",
      "entrega": "las respuestas"
    },
    {
      "id": "contabilidad",
      "puesto": "Cuentas",
      "hace": "Ordena tus cuentas, cruza pagos y proyecta tu caja",
      "haciendo": "Cuadrando las cuentas",
      "entrega": "el reporte del mes"
    },
    {
      "id": "correos",
      "puesto": "Correos",
      "hace": "Escribe tus correos importantes",
      "haciendo": "Escribiendo el correo",
      "entrega": "el correo"
    },
    {
      "id": "cotizaciones",
      "puesto": "Cotizaciones",
      "hace": "Arma cotizaciones y propuestas",
      "haciendo": "Armando la cotización",
      "entrega": "la cotización"
    },
    {
      "id": "whatsapp-crm",
      "puesto": "WhatsApp y CRM",
      "hace": "Responde WhatsApp y lleva tu CRM",
      "haciendo": "Respondiendo WhatsApp",
      "entrega": "las respuestas"
    },
    {
      "id": "confirmar-pedidos",
      "puesto": "Pedidos",
      "hace": "Confirma tus pedidos nuevos",
      "haciendo": "Confirmando pedidos",
      "entrega": "las confirmaciones"
    },
    {
      "id": "enviar-guias",
      "puesto": "Guías",
      "hace": "Avisa las guías a tus clientes",
      "haciendo": "Armando las guías",
      "entrega": "los avisos de envío"
    },
    {
      "id": "rastrear-pedidos",
      "puesto": "Rastreo",
      "hace": "Rastrea tus envíos",
      "haciendo": "Rastreando envíos",
      "entrega": "el reporte de envíos"
    },
    {
      "id": "cobranzas",
      "puesto": "Cobranzas",
      "hace": "Cobra lo que te deben con amabilidad",
      "haciendo": "Revisando quién debe",
      "entrega": "los recordatorios de pago"
    },
    {
      "id": "reporte-semanal",
      "puesto": "Reporte del lunes",
      "hace": "Resume tu semana y tus prioridades",
      "haciendo": "Armando el reporte",
      "entrega": "el reporte semanal"
    },
    {
      "id": "anuncios",
      "puesto": "Anuncios",
      "hace": "Escribe tus anuncios de Meta y TikTok",
      "haciendo": "Escribiendo anuncios",
      "entrega": "los anuncios"
    },
    {
      "id": "meta-ads",
      "puesto": "Meta Ads",
      "hace": "Revisa y prepara tus campañas de Meta",
      "haciendo": "Revisando tus campañas",
      "entrega": "el plan de campañas"
    },
    {
      "id": "inventario",
      "puesto": "Inventario",
      "hace": "Lleva tu stock y avisa qué se acaba",
      "haciendo": "Contando el stock",
      "entrega": "el reporte de inventario"
    },
    {
      "id": "resenas",
      "puesto": "Reseñas",
      "hace": "Responde y pide reseñas",
      "haciendo": "Respondiendo reseñas",
      "entrega": "las respuestas"
    },
    {
      "id": "panel",
      "puesto": "Panel",
      "hace": "Pone tu negocio a la vista en la oficina",
      "haciendo": "Actualizando tu panel",
      "entrega": "tu panel al día"
    },
    {
      "id": "editor",
      "puesto": "Editor",
      "hace": "Arma tu storyboard y plan de edición",
      "haciendo": "Armando tu storyboard",
      "entrega": "el storyboard"
    },
    {
      "id": "color",
      "puesto": "Color",
      "hace": "Le da color de cine a tu video",
      "haciendo": "Preparando tu color",
      "entrega": "los pasos para colorear tu video"
    }
  ],
  "trabajos": [
    {
      "nombre": "Reel",
      "color": "#D2463C",
      "cadena": [
        "director",
        "ideas",
        "ganchos",
        "guiones",
        "captions"
      ],
      "listo": "Reel listo para grabar",
      "ejemplos": [
        "Reel · 3 errores de principiante",
        "Reel · Mi rutina de la mañana"
      ]
    },
    {
      "nombre": "Semana",
      "color": "#E0A526",
      "cadena": [
        "director",
        "calendario",
        "ganchos",
        "captions"
      ],
      "listo": "Semana de contenido lista",
      "ejemplos": [
        "Semana de contenido · lunes a viernes"
      ]
    },
    {
      "nombre": "Carrusel",
      "color": "#3E9B5B",
      "cadena": [
        "director",
        "carruseles",
        "captions"
      ],
      "listo": "Carrusel listo",
      "ejemplos": [
        "Carrusel · 5 herramientas gratis"
      ]
    },
    {
      "nombre": "Cliente",
      "color": "#3D7DCA",
      "cadena": [
        "director",
        "atencion-clientes",
        "correos"
      ],
      "listo": "Respuestas listas",
      "ejemplos": [
        "Cliente · ¿hacen envíos?",
        "Cliente · pedido atrasado"
      ]
    },
    {
      "nombre": "Venta",
      "color": "#6E4A8E",
      "cadena": [
        "director",
        "cotizaciones",
        "correos"
      ],
      "listo": "Cotización lista",
      "ejemplos": [
        "Cotización · paquete de 5 videos"
      ]
    },
    {
      "nombre": "Cuentas",
      "color": "#E0A526",
      "cadena": [
        "director",
        "contabilidad"
      ],
      "listo": "Reporte del mes listo",
      "ejemplos": [
        "Cuentas · octubre"
      ]
    },
    {
      "nombre": "Pedido",
      "color": "#2E8C83",
      "cadena": [
        "director",
        "whatsapp-crm",
        "confirmar-pedidos",
        "enviar-guias"
      ],
      "listo": "Pedido confirmado y enviado",
      "ejemplos": [
        "Pedido · crema 250 ml",
        "Pedido · 2 camisetas"
      ]
    },
    {
      "nombre": "Envíos",
      "color": "#6E4A8E",
      "cadena": [
        "director",
        "rastrear-pedidos",
        "whatsapp-crm"
      ],
      "listo": "Reporte de envíos listo",
      "ejemplos": [
        "Envíos · rastreo del día"
      ]
    },
    {
      "nombre": "Cobros",
      "color": "#3E9B5B",
      "cadena": [
        "director",
        "cobranzas",
        "correos"
      ],
      "listo": "Recordatorios de pago listos",
      "ejemplos": [
        "Cobros · pagos pendientes"
      ]
    },
    {
      "nombre": "Lunes",
      "color": "#E0A526",
      "cadena": [
        "director",
        "reporte-semanal"
      ],
      "listo": "Reporte de la semana listo",
      "ejemplos": [
        "Reporte · semana pasada"
      ]
    },
    {
      "nombre": "Meta Ads",
      "color": "#3D7DCA",
      "cadena": [
        "director",
        "anuncios",
        "meta-ads"
      ],
      "listo": "Plan de campañas listo",
      "ejemplos": [
        "Meta Ads · revisión de campañas"
      ]
    },
    {
      "nombre": "Anuncio",
      "color": "#D2463C",
      "cadena": [
        "director",
        "anuncios",
        "captions"
      ],
      "listo": "Anuncios listos",
      "ejemplos": [
        "Anuncio · producto estrella"
      ]
    },
    {
      "nombre": "Stock",
      "color": "#2E8C83",
      "cadena": [
        "director",
        "inventario"
      ],
      "listo": "Inventario al día",
      "ejemplos": [
        "Inventario · qué se acaba"
      ]
    },
    {
      "nombre": "Reseñas",
      "color": "#3D7DCA",
      "cadena": [
        "director",
        "resenas"
      ],
      "listo": "Respuestas a reseñas listas",
      "ejemplos": [
        "Reseñas · Google"
      ]
    },
    {
      "nombre": "Panel",
      "color": "#1F2A44",
      "cadena": [
        "director",
        "contabilidad",
        "panel"
      ],
      "listo": "Tu panel está al día",
      "ejemplos": [
        "Panel · facturación del mes"
      ]
    },
    {
      "nombre": "Storyboard",
      "color": "#6E4A8E",
      "cadena": [
        "director",
        "editor"
      ],
      "listo": "Storyboard listo",
      "ejemplos": [
        "Storyboard · reel de la semana"
      ]
    },
    {
      "nombre": "Color",
      "color": "#BA7517",
      "cadena": [
        "director",
        "color"
      ],
      "listo": "Pasos de color listos",
      "ejemplos": [
        "Color · video del reel"
      ]
    }
  ]
};
