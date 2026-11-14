/* ============================================================
   PUNTO 24 — formulario del puesto
   Lo usan tres páginas: registro (vendedor nuevo), edición (con su
   link privado) y el panel del admin. Aquí vive la captura y la
   validación; guardar en la base lo hace cada página.
============================================================ */
import { CONFIG } from "./config.js";

const L = window.L;
const nodo = (tag, clase, texto) => { const n = document.createElement(tag); if (clase) n.className = clase; if (texto != null) n.textContent = texto; return n; };
const hoyISO = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };

/* Zona del piloto: fuera de esta caja no se acepta (las reglas de la base
   piden lo mismo). Cubre el Valle de México con holgura. */
export const CAJA = { latMin: 19.2, latMax: 20.1, lngMin: -99.7, lngMax: -98.7 };
export const RADIOS = [300, 500, 1000];

/* Centro desplazado para el modo zona: el punto real NUNCA se guarda.
   Se mueve entre 1/3 y 2/3 del radio, en una dirección al azar. */
export function desplazar(lat, lng, radio) {
  const d = radio * (1 / 3 + Math.random() / 3);
  const a = Math.random() * 2 * Math.PI;
  const dLat = (d * Math.cos(a)) / 111320;
  const dLng = (d * Math.sin(a)) / (111320 * Math.cos((lat * Math.PI) / 180));
  return { lat: +(lat + dLat).toFixed(3), lng: +(lng + dLng).toFixed(3) };
}

const limpiaTel = (t) => { let d = String(t || "").replace(/\D/g, ""); if (d.length === 12 && d.indexOf("52") === 0) d = d.slice(2); return d; };

/* opciones: { valores, admin, aviso (url del aviso de privacidad) } */
export function crearFormulario(cont, opciones) {
  const op = Object.assign({ valores: null, admin: false, aviso: "https://rayamistore.com/privacidad/" }, opciones || {});
  const v = op.valores || {};
  const f = nodo("form", "p24-form");
  f.noValidate = true;
  f.addEventListener("submit", (e) => e.preventDefault());

  const campo = (etiqueta, el, ayuda) => {
    const w = nodo("label", "p24-campo");
    w.appendChild(nodo("span", "p24-etq", etiqueta));
    w.appendChild(el);
    if (ayuda) w.appendChild(nodo("small", "p24-ayuda", ayuda));
    f.appendChild(w);
    return el;
  };
  const texto = (nombre, ph, max) => { const i = nodo("input"); i.type = "text"; i.name = nombre; i.placeholder = ph || ""; i.maxLength = max || 120; i.autocomplete = "off"; return i; };

  /* 1. Giro y qué vende */
  f.appendChild(nodo("h2", "p24-f-sec", "1. Tu puesto"));
  const giro = nodo("select"); giro.name = "giro";
  Object.keys(CONFIG.giros).forEach((k) => { const o = nodo("option", "", CONFIG.giros[k].icono + " " + CONFIG.giros[k].nombre); o.value = k; giro.appendChild(o); });
  giro.value = CONFIG.giros[v.giro] ? v.giro : "";
  if (!giro.value) { const o = nodo("option", "", "Elige…"); o.value = ""; o.disabled = true; o.selected = true; giro.insertBefore(o, giro.firstChild); }
  campo("¿Qué tipo de puesto es? *", giro);

  /* Si es "Otros", ¿cuál? (ej. tlacoyos, ropa, flores) */
  const giroOtro = texto("giroOtro", "Ej. tlacoyos, flores, ropa, reparación de celulares", 40);
  giroOtro.value = v.giroOtro || "";
  const cajaOtro = nodo("label", "p24-campo");
  cajaOtro.appendChild(nodo("span", "p24-etq", "¿Cuál? *"));
  cajaOtro.appendChild(giroOtro);
  cajaOtro.appendChild(nodo("small", "p24-ayuda", "Así aparece en el mapa en lugar de \"Otros\"."));
  f.appendChild(cajaOtro);

  /* ¿Qué vendes? — opciones para tocar (varias) + agregar lo que falte */
  const vendeSel = []; // en el orden en que los marca
  const norm = (t) => String(t || "").trim().replace(/\s+/g, " ").replace(/[,;]+/g, "").slice(0, 40);
  const clave = (t) => norm(t).toLowerCase();
  String(v.vende || "").split(/\s*[,;]\s*/).map(norm).filter(Boolean).forEach((t) => { if (!vendeSel.some((x) => clave(x) === clave(t))) vendeSel.push(t); });
  const cajaVende = nodo("div", "p24-campo");
  cajaVende.appendChild(nodo("span", "p24-etq", "¿Qué vendes? *"));
  cajaVende.appendChild(nodo("small", "p24-ayuda", "Toca todo lo que vendes (puedes marcar varias). Si falta algo, escríbelo abajo y dale Agregar."));
  const chipsVende = nodo("div", "p24-prod-chips");
  chipsVende.setAttribute("role", "group");
  chipsVende.setAttribute("aria-label", "Lo que vendes");
  cajaVende.appendChild(chipsVende);
  const filaAgregar = nodo("div", "p24-prod-agregar");
  const nuevoProd = texto("nuevoProducto", "Otra cosa que vendes…", 40);
  nuevoProd.setAttribute("aria-label", "Agregar otra cosa que vendes");
  const btnAgregar = nodo("button", "btn p24-prod-btn"); btnAgregar.type = "button";
  btnAgregar.appendChild(nodo("i", "fa-solid fa-plus")); btnAgregar.appendChild(document.createTextNode(" Agregar"));
  filaAgregar.appendChild(nuevoProd); filaAgregar.appendChild(btnAgregar);
  cajaVende.appendChild(filaAgregar);
  const resumenVende = nodo("p", "p24-prod-resumen");
  resumenVende.setAttribute("aria-live", "polite");
  cajaVende.appendChild(resumenVende);
  f.appendChild(cajaVende);

  function opcionesVende() {
    const g = CONFIG.giros[giro.value];
    const base = [].concat(g && g.productos ? g.productos : [], CONFIG.productosGenerales || []);
    const lista = [];
    base.concat(vendeSel).forEach((t) => { if (!lista.some((x) => clave(x) === clave(t))) lista.push(t); });
    return lista;
  }
  function pintarVende() {
    chipsVende.innerHTML = "";
    opcionesVende().forEach((t) => {
      const marcado = vendeSel.some((x) => clave(x) === clave(t));
      const b = nodo("button", "p24-prod" + (marcado ? " es-sel" : ""), (marcado ? "✓ " : "") + t);
      b.type = "button";
      b.setAttribute("aria-pressed", String(marcado));
      b.addEventListener("click", () => {
        const i = vendeSel.findIndex((x) => clave(x) === clave(t));
        if (i >= 0) vendeSel.splice(i, 1);
        else if (vendeSel.length >= (CONFIG.maxProductos || 20)) { resumenVende.textContent = "Máximo " + (CONFIG.maxProductos || 20) + " cosas. Quita alguna para agregar otra."; return; }
        else vendeSel.push(t);
        pintarVende();
      });
      chipsVende.appendChild(b);
    });
    resumenVende.textContent = vendeSel.length ? "Marcaste " + vendeSel.length + ": " + vendeSel.join(", ") + "." : "Todavía no marcas nada.";
  }
  function agregarProducto() {
    const t = norm(nuevoProd.value);
    if (!t) { nuevoProd.focus(); return; }
    if (!vendeSel.some((x) => clave(x) === clave(t))) {
      if (vendeSel.length >= (CONFIG.maxProductos || 20)) { resumenVende.textContent = "Máximo " + (CONFIG.maxProductos || 20) + " cosas. Quita alguna para agregar otra."; return; }
      vendeSel.push(t.charAt(0).toUpperCase() + t.slice(1));
    }
    nuevoProd.value = "";
    pintarVende();
    nuevoProd.focus();
  }
  btnAgregar.addEventListener("click", agregarProducto);
  nuevoProd.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); agregarProducto(); } });
  const verOtro = () => { cajaOtro.hidden = giro.value !== "otro"; };
  giro.addEventListener("change", () => { verOtro(); pintarVende(); });
  verOtro();
  pintarVende();
  const nombre = campo("Nombre del puesto (opcional)", texto("nombre", "Ej. Tamales Doña Lupita", 60), "Si lo dejas vacío, en el mapa solo sale el tipo de puesto.");
  nombre.value = v.nombre || "";

  /* 2. Ubicación */
  f.appendChild(nodo("h2", "p24-f-sec", "2. Dónde te pones"));
  const modos = nodo("div", "p24-modos");
  const mk = (val, tit, desc) => {
    const l = nodo("label", "p24-modo");
    const r = nodo("input"); r.type = "radio"; r.name = "modo"; r.value = val;
    l.appendChild(r);
    const t = nodo("span"); t.appendChild(nodo("b", "", tit)); t.appendChild(nodo("small", "", desc));
    l.appendChild(t); modos.appendChild(l); return r;
  };
  const rZona = mk("zona", "Zona aproximada (recomendado)", "En el mapa sale un círculo, no tu lugar exacto. Más seguro para ti.");
  const rPunto = mk("punto", "Punto exacto", "Sale un pin justo donde te pones. Úsalo si quieres que te encuentren al metro.");
  (v.modo === "punto" ? rPunto : rZona).checked = true;
  f.appendChild(modos);

  const radios = nodo("div", "p24-radios");
  radios.appendChild(nodo("span", "p24-etq", "Tamaño de la zona"));
  const radioSel = {};
  RADIOS.forEach((m) => {
    const l = nodo("label", "p24-chip-op");
    const r = nodo("input"); r.type = "radio"; r.name = "radio"; r.value = String(m);
    l.appendChild(r); l.appendChild(document.createTextNode(m >= 1000 ? " 1 km" : " " + m + " m"));
    radios.appendChild(l); radioSel[m] = r;
  });
  (radioSel[v.radio] || radioSel[500]).checked = true;
  f.appendChild(radios);

  const mapaCaja = nodo("div", "p24-f-mapa");
  const lienzo = nodo("div", "p24-f-lienzo"); lienzo.setAttribute("aria-label", "Mapa para marcar tu lugar");
  const btnUbi = nodo("button", "btn p24-f-ubi"); btnUbi.type = "button";
  btnUbi.appendChild(nodo("i", "fa-solid fa-location-crosshairs")); btnUbi.appendChild(document.createTextNode(" Usar mi ubicación"));
  const pista = nodo("p", "p24-f-pista", "Toca el mapa o arrastra el marcador hasta donde te pones.");
  mapaCaja.appendChild(lienzo); mapaCaja.appendChild(btnUbi);
  f.appendChild(mapaCaja); f.appendChild(pista);

  const lugar = campo("Calle y referencia *", texto("lugar_texto", "Ej. Av. Primero de Mayo, frente a la primaria", 120), "Así la gente lo ubica aunque no use el mapa.");
  lugar.value = v.lugar_texto || "";

  /* 3. Horario y contacto */
  f.appendChild(nodo("h2", "p24-f-sec", "3. Horario y contacto"));
  const horario = campo("Días y horario *", texto("horario", "Ej. Lunes a sábado, 6:30 a 10:00 am", 120));
  horario.value = v.horario || "";
  const wa = campo("Tu WhatsApp (opcional)", texto("whatsapp", "10 dígitos", 14), "Si lo pones y marcas la casilla de abajo, cualquiera que vea el mapa podrá escribirte.");
  wa.type = "tel"; wa.inputMode = "numeric"; wa.value = v.whatsapp || "";
  const lMostrar = nodo("label", "p24-check");
  const mostrar = nodo("input"); mostrar.type = "checkbox"; mostrar.name = "mostrarWhatsapp"; mostrar.checked = v.mostrarWhatsapp === true;
  lMostrar.appendChild(mostrar); lMostrar.appendChild(nodo("span", "", "Sí, muestren mi WhatsApp en el mapa (lo verá cualquier persona)."));
  f.appendChild(lMostrar);
  const contacto = campo("Un número para que RAYAMI te avise (privado) *", texto("contacto", "10 dígitos; puede ser el mismo", 14), "No se publica. Solo para avisarte cuando te aprobemos o si hay un reporte.");
  contacto.type = "tel"; contacto.inputMode = "numeric"; contacto.value = v.contacto || "";
  wa.addEventListener("input", () => { if (!contacto.value) contacto.placeholder = wa.value ? "Si lo dejas vacío usamos tu WhatsApp" : "10 dígitos; puede ser el mismo"; });

  /* 4. Consentimiento (no se pide cuando captura el admin) */
  let acepto = null;
  if (!op.admin) {
    f.appendChild(nodo("h2", "p24-f-sec", "4. Antes de enviar"));
    const caja = nodo("div", "p24-consent");
    const ul = nodo("ul");
    ["Punto 24 es un mapa público: cualquiera con el link verá tu puesto, tu horario y, si lo marcaste, tu WhatsApp.",
     "Tú decides qué se muestra (zona o punto exacto, con o sin nombre y WhatsApp). Puedes cambiarlo o retirarte cuando quieras con tu link privado o por WhatsApp.",
     "Tu puesto se publica solo después de que RAYAMI Store lo revise.",
     "Punto 24 no es un permiso ni un registro oficial. RAYAMI Store no vende ni garantiza tus productos.",
     "Solo para mayores de 18 años."].forEach((t) => ul.appendChild(nodo("li", "", t)));
    caja.appendChild(ul);
    const l = nodo("label", "p24-check es-consent");
    acepto = nodo("input"); acepto.type = "checkbox"; acepto.name = "acepto";
    const s = nodo("span", "", "Leí lo de arriba, soy mayor de edad y autorizo que mi puesto aparezca en Punto 24 con los datos que escribí. Vi el ");
    const a = nodo("a", "", "aviso de privacidad"); a.href = op.aviso; a.target = "_blank"; a.rel = "noopener"; s.appendChild(a); s.appendChild(document.createTextNode("."));
    l.appendChild(acepto); l.appendChild(s);
    caja.appendChild(l);
    f.appendChild(caja);
  }

  const errores = nodo("div", "p24-errores"); errores.hidden = true; errores.setAttribute("role", "alert");
  f.appendChild(errores);
  cont.appendChild(f);

  /* ---- Mapa para elegir el lugar ---- */
  const estado = { lat: typeof v.lat === "number" ? v.lat : null, lng: typeof v.lng === "number" ? v.lng : null, movido: false };
  let mapa = null, marca = null, circulo = null;
  function pintar() {
    if (!mapa) return;
    const zona = rZona.checked, radio = Number(f.radio.value);
    if (estado.lat == null) { if (marca) { marca.remove(); marca = null; } if (circulo) { circulo.remove(); circulo = null; } return; }
    const ll = [estado.lat, estado.lng];
    if (!marca) {
      marca = L.marker(ll, { draggable: true, icon: L.divIcon({ className: "p24-marca", html: '<span class="p24-pin" style="--c:#c2410c"><span>📍</span></span>', iconSize: [40, 48], iconAnchor: [20, 46] }) }).addTo(mapa);
      marca.on("dragend", () => { const p = marca.getLatLng(); estado.lat = p.lat; estado.lng = p.lng; estado.movido = true; pintar(); });
    } else marca.setLatLng(ll);
    if (zona) {
      if (!circulo) circulo = L.circle(ll, { radius: radio, color: "#c2410c", weight: 2, dashArray: "6 6", fillOpacity: .12 }).addTo(mapa);
      else { circulo.setLatLng(ll); circulo.setRadius(radio); }
    } else if (circulo) { circulo.remove(); circulo = null; }
    pista.textContent = zona
      ? "Al guardar, el círculo se mueve un poco al azar para no revelar tu lugar exacto."
      : "Este pin se verá tal cual en el mapa.";
  }
  if (L) {
    mapa = L.map(lienzo, { minZoom: CONFIG.zoomMin, maxZoom: CONFIG.teselas.zoomMax, zoomControl: true, scrollWheelZoom: false });
    mapa.attributionControl.setPrefix(false);
    L.tileLayer(CONFIG.teselas.url, { attribution: CONFIG.teselas.credito, maxZoom: CONFIG.teselas.zoomMax }).addTo(mapa);
    if (estado.lat != null) mapa.setView([estado.lat, estado.lng], 16); else mapa.setView(CONFIG.centro, CONFIG.zoomInicial);
    mapa.on("click", (e) => { estado.lat = e.latlng.lat; estado.lng = e.latlng.lng; estado.movido = true; pintar(); });
    mapa.on("click", () => mapa.scrollWheelZoom.enable());
    lienzo.addEventListener("mouseleave", () => mapa.scrollWheelZoom.disable());
    setTimeout(() => mapa.invalidateSize(), 200);
    pintar();
  } else {
    lienzo.textContent = "No se pudo cargar el mapa. Escribe la calle y referencia; nosotros lo ubicamos.";
    lienzo.classList.add("p24-sin-mapa");
  }
  [rZona, rPunto].forEach((r) => r.addEventListener("change", () => { radios.hidden = !rZona.checked; pintar(); }));
  Object.values(radioSel).forEach((r) => r.addEventListener("change", pintar));
  radios.hidden = !rZona.checked;

  btnUbi.addEventListener("click", () => {
    if (!navigator.geolocation) { pista.textContent = "Tu navegador no da la ubicación. Toca el mapa donde te pones."; return; }
    btnUbi.disabled = true; pista.textContent = "Buscando tu ubicación…";
    navigator.geolocation.getCurrentPosition((pos) => {
      btnUbi.disabled = false;
      estado.lat = pos.coords.latitude; estado.lng = pos.coords.longitude; estado.movido = true;
      if (mapa) mapa.setView([estado.lat, estado.lng], 17);
      pintar();
    }, () => { btnUbi.disabled = false; pista.textContent = "No diste permiso de ubicación. Toca el mapa donde te pones."; }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
  });

  /* ---- Leer y validar ---- */
  function leer() {
    const zona = rZona.checked;
    const problemas = [];
    const d = {
      giro: giro.value, giroOtro: giro.value === "otro" ? norm(giroOtro.value) : "",
      vende: vendeSel.join(", "), nombre: nombre.value.trim(),
      modo: zona ? "zona" : "punto", radio: zona ? Number(f.radio.value) : 0,
      lugar_texto: lugar.value.trim(), horario: horario.value.trim(),
      whatsapp: limpiaTel(wa.value), mostrarWhatsapp: mostrar.checked,
      contacto: limpiaTel(contacto.value) || limpiaTel(wa.value),
      lat: estado.lat, lng: estado.lng
    };
    if (!d.giro) problemas.push("Elige qué tipo de puesto es.");
    if (d.giro === "otro" && !d.giroOtro) problemas.push("Escribe qué tipo de puesto es (en \"¿Cuál?\").");
    if (!d.vende) problemas.push("Marca al menos una cosa que vendes (o escríbela y dale Agregar).");
    else if (d.vende.length > (CONFIG.maxVendeLetras || 300)) problemas.push("La lista de lo que vendes es muy larga; quita algunas cosas.");
    if (norm(nuevoProd.value)) problemas.push("Escribiste \"" + norm(nuevoProd.value) + "\" pero no le diste Agregar.");
    if (d.lat == null) problemas.push("Marca en el mapa dónde te pones (toca el mapa o usa tu ubicación).");
    else if (d.lat < CAJA.latMin || d.lat > CAJA.latMax || d.lng < CAJA.lngMin || d.lng > CAJA.lngMax) problemas.push("Ese lugar queda fuera de la zona de Punto 24 (Valle de México).");
    if (!d.lugar_texto) problemas.push("Escribe la calle y una referencia.");
    if (!d.horario) problemas.push("Escribe tus días y horario.");
    if (wa.value && d.whatsapp.length !== 10) problemas.push("El WhatsApp debe tener 10 dígitos.");
    if (d.mostrarWhatsapp && !d.whatsapp) problemas.push("Marcaste mostrar tu WhatsApp pero no lo escribiste.");
    if (!d.contacto || d.contacto.length !== 10) problemas.push("Necesitamos un número de 10 dígitos para avisarte (no se publica).");
    if (acepto && !acepto.checked) problemas.push("Falta marcar la casilla de autorización.");
    if (d.lat != null) {
      if (zona) {
        // Solo se vuelve a desplazar si el vendedor movió el marcador; si no, se conserva el centro guardado.
        if (estado.movido || v.modo !== "zona" || v.radio !== d.radio) { const c = desplazar(d.lat, d.lng, d.radio); d.lat = c.lat; d.lng = c.lng; }
        else { d.lat = v.lat; d.lng = v.lng; }
      } else { d.lat = +d.lat.toFixed(5); d.lng = +d.lng.toFixed(5); }
    }
    return { datos: d, problemas };
  }
  function mostrarErrores(lista) {
    errores.innerHTML = "";
    errores.hidden = !lista.length;
    if (!lista.length) return;
    errores.appendChild(nodo("b", "", "Falta algo:"));
    const ul = nodo("ul"); lista.forEach((p) => ul.appendChild(nodo("li", "", p))); errores.appendChild(ul);
    errores.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  return { form: f, leer, mostrarErrores, hoyISO, refrescarMapa: () => mapa && mapa.invalidateSize() };
}

/* Lo que va al mapa público: solo lo autorizado, sin el contacto privado. */
export function aPublico(s) {
  const p = {
    giro: s.giro, vende: s.vende || "", nombre: s.nombre || "",
    giroOtro: s.giro === "otro" ? s.giroOtro || "" : "",
    lat: s.lat, lng: s.lng, modo: s.modo,
    lugar_texto: s.lugar_texto || "", horario: s.horario || "",
    whatsapp: s.mostrarWhatsapp && s.whatsapp ? s.whatsapp : "",
    actualizado: hoyISO()
  };
  if (s.modo === "zona") p.radio = Number(s.radio) || 500;
  return p;
}

/* id legible y único: giro + marca de tiempo en base 36 (ej. tamales-m3k9x2). */
export const nuevoId = (giro) => (CONFIG.giros[giro] ? giro : "puesto") + "-" + Date.now().toString(36) + Math.floor(Math.random() * 36).toString(36);
