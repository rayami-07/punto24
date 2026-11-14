/* ============================================================
   PUNTO 24 — configuración
   Aquí vive todo lo que se ajusta sin tocar la lógica (mapa.js).
   Los puestos NO van aquí: van en vendedores.js
============================================================ */
export const CONFIG = {
  /* TESELAS: las imágenes cuadradas que forman el mapa de fondo.
     Para cambiar de proveedor se cambian SOLO estas líneas.
     Las teselas públicas de OpenStreetMap son para uso ligero; antes de
     poner publicidad o tener mucho tráfico hay que cambiar a un proveedor
     cuyo plan lo permita (y poner aquí su URL y su texto de crédito). */
  teselas: {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    credito: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
    zoomMax: 19
  },

  /* FUENTE DE LOS PUESTOS: la base de Firebase propia (proyecto punto24-rayami) (solo los aprobados desde el
     panel /admin/). Se lee por una URL pública, sin login. Si falla o está
     vacía, el mapa usa vendedores.js (los ejemplos). Pon url: "" para
     volver a usar solo vendedores.js. */
  fuente: {
    url: "https://punto24-rayami-default-rtdb.firebaseio.com/punto24/publico.json"
  },

  /* Vista inicial (solo se usa si no hay puestos que mostrar). */
  centro: [19.6439, -99.2160], // Cuautitlán Izcalli
  zoomInicial: 13,
  zoomMin: 11,

  /* Vigencia: si "actualizado" tiene más de estos días, el puesto se
     considera viejo. vencidos: "marcar" lo deja en gris con el aviso
     "puede estar desactualizado"; "ocultar" lo quita del mapa. */
  diasVigencia: 14,
  vencidos: "marcar",

  /* "Cerca de mí": si el puesto más cercano está más lejos que esto,
     solo se avisa y el mapa no se mueve. */
  lejosMetros: 25000,

  /* WhatsApp de RAYAMI Store (con 52 al inicio) y mensajes prellenados. */
  whatsappRayami: "525581074978",
  mensajes: {
    aVendedor: "Hola, te vi en Punto 24.",
    cta: "Hola, vi Punto 24 y quiero saber del menú QR y pedidos por WhatsApp de RAYAMI Store.",
    reportar: "Hola, quiero reportar un puesto de Punto 24. ID del puesto: {id}. Motivo: "
  },

  /* GIROS: nombre que se muestra, ícono y color del pin.
     La clave (tamales, elotes…) es la que se escribe en vendedores.js.
     Se usan emojis antiguos a propósito: los nuevos (como el de tamal)
     salen como un cuadrito vacío en celulares viejos. */
  giroPorDefecto: "otro",
  giros: {
    tamales: { nombre: "Tamales", icono: "🍲", color: "#c2410c" },
    elotes:  { nombre: "Elotes",  icono: "🌽", color: "#b45309" },
    pan:     { nombre: "Pan",     icono: "🥖", color: "#92400e" },
    camotes: { nombre: "Camotes", icono: "🍠", color: "#7e22ce" },
    comida:  { nombre: "Comida",  icono: "🌮", color: "#b91c1c" },
    frutas:  { nombre: "Frutas",  icono: "🍉", color: "#15803d" },
    otro:    { nombre: "Otros",   icono: "🛒", color: "#475569" }
  }
};
