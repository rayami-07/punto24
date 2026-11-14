/* ============================================================
   PUNTO 24 — lógica del mapa
   Lee config.js (ajustes) y vendedores.js (puestos), pinta el mapa
   con Leaflet y registra los eventos de medición.
   No guarda nada: ni la ubicación del visitante ni sus clics salen
   de aquí, salvo los eventos anónimos de Google Analytics.
============================================================ */
import { CONFIG } from "./config.js";

const L = window.L; // Leaflet se carga antes, en index.html
const $ = (id) => document.getElementById(id);

/* ---------- 1. De dónde viene la visita (?de=qr&c=tamales-1) ---------- */
const params = new URLSearchParams(location.search);
const limpiar = (v, max) => String(v || "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, max);
const ORIGEN = { de: limpiar(params.get("de"), 20), c: limpiar(params.get("c"), 40) };
const REVISAR = params.get("revisar") === "1";

/* Manda un evento a Google Analytics con el origen de la visita pegado. */
function evento(nombre, datos) {
  const p = Object.assign({}, datos || {});
  if (ORIGEN.de) p.de = ORIGEN.de;
  if (ORIGEN.c) p.c = ORIGEN.c;
  if (typeof window.gtag === "function") window.gtag("event", nombre, p);
}

/* ---------- 2. Utilidades ---------- */
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function leerFecha(txt) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(txt || ""));
  if (!m) return null;
  const a = Number(m[1]), me = Number(m[2]) - 1, d = Number(m[3]);
  const f = new Date(a, me, d);
  return f.getFullYear() === a && f.getMonth() === me && f.getDate() === d ? f : null;
}
function diasDesde(f) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.round((hoy - f) / 86400000);
}
const fechaBonita = (f) => f.getDate() + " " + MESES[f.getMonth()] + " " + f.getFullYear();

function nodo(tag, clase, texto) {
  const n = document.createElement(tag);
  if (clase) n.className = clase;
  if (texto != null) n.textContent = texto;
  return n;
}
const linkWa = (tel, msg) => "https://api.whatsapp.com/send?phone=" + tel + "&text=" + encodeURIComponent(msg);

function textoDistancia(m) {
  if (m < 950) return "unos " + Math.max(50, Math.round(m / 50) * 50) + " m";
  return "unos " + (m / 1000).toFixed(1).replace(".0", "") + " km";
}

/* ---------- 3. Revisar y preparar la lista de puestos ----------
   vendedores.js se edita a mano, así que aquí se valida cada puesto.
   Lo que está mal no se pinta y queda anotado en "problemas"
   (se ven en /?revisar=1). */
function prepararVendedores(crudos) {
  const lista = [], problemas = [], ocultos = [], vistos = {};
  if (!Array.isArray(crudos)) {
    problemas.push("VENDEDORES debe ser una lista entre corchetes: export const VENDEDORES = [ {…}, {…} ];");
    return { lista, problemas, ocultos };
  }
  const centro = L.latLng(CONFIG.centro);

  crudos.forEach((v, i) => {
    const quien = v && v.id ? '"' + v.id + '"' : "el puesto #" + (i + 1);
    const falla = (t) => { problemas.push("No se muestra " + quien + ": " + t); };
    const ojo = (t) => { problemas.push("Revisa " + quien + ": " + t); };

    if (!v || typeof v !== "object") return falla("no está escrito entre llaves { }.");
    if (!v.id || !/^[a-z0-9-]+$/.test(String(v.id))) return falla('le falta "id" o tiene caracteres raros (solo minúsculas, números y guiones, ej. "tamales-1").');
    if (vistos[v.id]) return falla("su id está repetido.");
    vistos[v.id] = true;
    if (v.activo === false) { ocultos.push(quien + " (activo: false)"); return; }

    if (typeof v.lat !== "number" || typeof v.lng !== "number" || !isFinite(v.lat) || !isFinite(v.lng)) return falla("lat y lng deben ser números sin comillas (ej. lat: 19.6452, lng: -99.2148).");
    if (v.lat < 0 && v.lng > 0) return falla("lat y lng están al revés (lat es positiva, como 19.6; lng es negativa, como -99.2).");
    if (v.lng > 0) return falla("a lng le falta el signo menos (debe ser como -99.2148).");
    if (Math.abs(v.lat) > 90 || Math.abs(v.lng) > 180) return falla("esas coordenadas no existen.");
    if (v.modo !== "punto" && v.modo !== "zona") return falla('modo debe ser "punto" o "zona".');
    let radio = 0;
    if (v.modo === "zona") {
      radio = Number(v.radio);
      if (!(radio >= 50 && radio <= 3000)) return falla("en modo zona necesita radio en metros, entre 50 y 3000 (ej. radio: 300).");
    }
    if (centro.distanceTo([v.lat, v.lng]) > 30000) ojo("está a más de 30 km del centro del mapa; confirma las coordenadas.");

    let giroId = String(v.giro || "");
    if (!CONFIG.giros[giroId]) {
      ojo('el giro "' + giroId + '" no existe en config.js; se muestra como "' + CONFIG.giros[CONFIG.giroPorDefecto].nombre + '".');
      giroId = CONFIG.giroPorDefecto;
    }

    const fecha = leerFecha(v.actualizado);
    let vencido = false;
    if (!fecha) { ojo('"actualizado" debe ser una fecha AAAA-MM-DD; se toma como desactualizado.'); vencido = true; }
    else if (diasDesde(fecha) < 0) ojo('"actualizado" tiene una fecha futura.');
    else if (diasDesde(fecha) > CONFIG.diasVigencia) vencido = true;
    if (vencido && CONFIG.vencidos === "ocultar") { ocultos.push(quien + " (actualizado hace más de " + CONFIG.diasVigencia + " días)"); return; }

    let tel = String(v.whatsapp || "").replace(/\D/g, "");
    if (tel.length === 12 && tel.indexOf("52") === 0) tel = tel.slice(2);
    if (v.whatsapp && tel.length !== 10) { ojo("whatsapp debe tener 10 dígitos; no se muestra el botón."); tel = ""; }

    lista.push({
      id: String(v.id), giroId, giro: CONFIG.giros[giroId],
      nombre: String(v.nombre || "").trim(),
      lat: v.lat, lng: v.lng, modo: v.modo, radio,
      lugar: String(v.lugar_texto || "").trim(),
      horario: String(v.horario || "").trim(),
      vende: String(v.vende || "").trim(),
      // Si es "Otros", se muestra lo que escribió el vendedor (ej. "Tlacoyos").
      giroTexto: giroId === "otro" && String(v.giroOtro || "").trim() ? String(v.giroOtro).trim() : CONFIG.giros[giroId].nombre,
      tel, fecha, vencido, ejemplo: v.ejemplo === true
    });
  });
  return { lista, problemas, ocultos };
}

/* ---------- 4. Arranque ---------- */
async function iniciar() {
  const lienzo = $("p24-mapa");
  if (!L) { lienzo.textContent = "No se pudo cargar el mapa. Revisa tu conexión y recarga la página."; lienzo.classList.add("p24-sin-mapa"); return; }

  /* 4.1 Mapa de fondo */
  const mapa = L.map(lienzo, { minZoom: CONFIG.zoomMin, maxZoom: CONFIG.teselas.zoomMax, scrollWheelZoom: false, zoomControl: false });
  // Botones + y − a la derecha, debajo de "Cerca de mí": la izquierda queda libre para la tarjeta.
  L.control.zoom({ position: "topright", zoomInTitle: "Acercar", zoomOutTitle: "Alejar" }).addTo(mapa);
  mapa.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');
  L.tileLayer(CONFIG.teselas.url, { attribution: CONFIG.teselas.credito, maxZoom: CONFIG.teselas.zoomMax }).addTo(mapa);
  mapa.setView(CONFIG.centro, CONFIG.zoomInicial);
  // En computadora la rueda del ratón solo hace zoom después de dar clic en el mapa,
  // para que no "secuestre" el desplazamiento de la página.
  mapa.on("click", () => mapa.scrollWheelZoom.enable());
  lienzo.addEventListener("mouseleave", () => mapa.scrollWheelZoom.disable());

  /* 4.2 Puestos */
  // Primero la base (puestos aprobados en el panel); si no hay nada, vendedores.js.
  let crudos = [], errorCarga = "", desdeBase = false;
  if (CONFIG.fuente && CONFIG.fuente.url) {
    try {
      const r = await fetch(CONFIG.fuente.url, { cache: "no-store" });
      const d = r.ok ? await r.json() : null;
      if (d && typeof d === "object") {
        const arr = Object.keys(d).map((k) => Object.assign({ id: k, activo: true }, d[k]));
        if (arr.length) { crudos = arr; desdeBase = true; }
      }
    } catch (e) { /* sin red o sin reglas publicadas: se sigue con vendedores.js */ }
  }
  if (!desdeBase) {
    try { crudos = (await import("./vendedores.js")).VENDEDORES; }
    catch (e) { errorCarga = (e && e.message) || String(e); }
  }
  const prep = errorCarga ? { lista: [], problemas: [], ocultos: [] } : prepararVendedores(crudos);
  const lista = prep.lista;

  const tarjeta = $("p24-tarjeta"), aviso = $("p24-aviso"), chips = $("p24-chips"), conteo = $("p24-conteo");
  const marco = lienzo.parentElement;
  L.DomEvent.disableClickPropagation(tarjeta);
  L.DomEvent.disableScrollPropagation(tarjeta);

  const capas = {}; // id → { grupo, marcador }
  let abierto = null, filtro = "todos", relojAviso = 0;

  function icono(v) {
    const zona = v.modo === "zona";
    return L.divIcon({
      className: "p24-marca",
      html: '<span class="' + (zona ? "p24-zona" : "p24-pin") + (v.vencido ? " es-viejo" : "") + '" style="--c:' + v.giro.color + '"><span>' + v.giro.icono + "</span></span>",
      iconSize: zona ? [38, 38] : [38, 46],
      iconAnchor: zona ? [19, 19] : [19, 46]
    });
  }

  lista.forEach((v) => {
    const titulo = v.giroTexto + (v.nombre ? ": " + v.nombre : "") + (v.modo === "zona" ? " (zona aproximada)" : "");
    const grupo = L.featureGroup();
    if (v.modo === "zona") {
      L.circle([v.lat, v.lng], {
        radius: v.radio, color: v.giro.color, weight: 2, dashArray: "6 7",
        fillColor: v.giro.color, fillOpacity: v.vencido ? 0.05 : 0.13, bubblingMouseEvents: false
      }).addTo(grupo);
    }
    const marcador = L.marker([v.lat, v.lng], { icon: icono(v), title: titulo, alt: titulo, riseOnHover: true }).addTo(grupo);
    grupo.on("click", () => abrir(v));
    capas[v.id] = { grupo, marcador };
  });

  const visibles = () => lista.filter((v) => filtro === "todos" || v.giroId === filtro);

  function encuadrar() {
    const vis = visibles();
    if (!vis.length) { mapa.setView(CONFIG.centro, CONFIG.zoomInicial); return; }
    let caja = null;
    vis.forEach((v) => {
      const p = L.latLng(v.lat, v.lng);
      const b = v.modo === "zona" ? p.toBounds(v.radio * 2) : L.latLngBounds(p, p);
      caja = caja ? caja.extend(b) : L.latLngBounds(b.getSouthWest(), b.getNorthEast());
    });
    mapa.fitBounds(caja, { padding: [40, 40], maxZoom: 16 });
  }

  /* 4.3 Tarjeta del puesto */
  function cerrar() {
    if (abierto) {
      const c = capas[abierto.id], el = c.marcador.getElement();
      if (el) el.classList.remove("es-activo");
      c.marcador.setZIndexOffset(0);
    }
    abierto = null;
    tarjeta.hidden = true;
    tarjeta.textContent = "";
    marco.classList.remove("con-tarjeta");
  }

  function abrir(v) {
    cerrar();
    abierto = v;
    const c = capas[v.id], el = c.marcador.getElement();
    if (el) el.classList.add("es-activo");
    c.marcador.setZIndexOffset(1000);

    const cab = nodo("div", "p24-t-cab");
    const ico = nodo("span", "p24-t-ico", v.giro.icono);
    ico.style.setProperty("--c", v.giro.color);
    const tit = nodo("div", "p24-t-tit");
    if (v.nombre) tit.appendChild(nodo("small", "", v.giroTexto));
    tit.appendChild(nodo("h3", "", v.nombre || v.giroTexto));
    const x = nodo("button", "p24-t-x", "×");
    x.type = "button";
    x.setAttribute("aria-label", "Cerrar");
    x.addEventListener("click", cerrar);
    cab.appendChild(ico); cab.appendChild(tit); cab.appendChild(x);
    tarjeta.appendChild(cab);

    if (v.ejemplo) tarjeta.appendChild(nodo("p", "p24-t-sello es-ejemplo", "Puesto de ejemplo: no existe"));
    if (v.vencido) tarjeta.appendChild(nodo("p", "p24-t-sello es-viejo", "Puede estar desactualizado"));

    const datos = nodo("ul", "p24-t-datos");
    const fila = (fa, texto, extra) => {
      const li = nodo("li");
      li.appendChild(nodo("i", fa));
      const s = nodo("span", "", texto);
      if (extra) s.appendChild(nodo("em", "", extra));
      li.appendChild(s);
      datos.appendChild(li);
    };
    const notaZona = v.modo === "zona" ? "Zona aproximada: anda por esta área (radio de " + v.radio + " m)." : "";
    if (v.lugar || notaZona) fila("fa-solid fa-location-dot", v.lugar || "Zona aproximada", v.lugar ? notaZona : "Anda por esta área (radio de " + v.radio + " m).");
    if (v.vende) fila("fa-solid fa-basket-shopping", "Vende: " + v.vende);
    if (v.horario) fila("fa-regular fa-clock", v.horario);
    fila("fa-regular fa-calendar-check", "Actualizado: " + (v.fecha ? fechaBonita(v.fecha) : "sin fecha"));
    tarjeta.appendChild(datos);

    if (v.tel) {
      const btns = nodo("div", "p24-t-btns");
      const wa = nodo("a", "btn btn-wa");
      wa.appendChild(nodo("i", "fa-brands fa-whatsapp"));
      wa.appendChild(document.createTextNode(" WhatsApp"));
      wa.href = linkWa("52" + v.tel, CONFIG.mensajes.aVendedor);
      wa.target = "_blank"; wa.rel = "noopener";
      wa.addEventListener("click", () => evento("clic_whatsapp_vendedor", { pin_id: v.id, giro: v.giroId, medio: "whatsapp" }));
      const tel = nodo("a", "btn btn-line");
      tel.appendChild(nodo("i", "fa-solid fa-phone"));
      tel.appendChild(document.createTextNode(" Llamar"));
      tel.href = "tel:+52" + v.tel;
      tel.addEventListener("click", () => evento("clic_whatsapp_vendedor", { pin_id: v.id, giro: v.giroId, medio: "llamada" }));
      btns.appendChild(wa); btns.appendChild(tel);
      tarjeta.appendChild(btns);
    }

    const pie = nodo("div", "p24-t-pie");
    const cta = nodo("a", "p24-t-cta", "¿Quieres menú QR y pedidos por WhatsApp? Pregunta por RAYAMI Store");
    cta.href = linkWa(CONFIG.whatsappRayami, CONFIG.mensajes.cta);
    cta.target = "_blank"; cta.rel = "noopener";
    cta.addEventListener("click", () => evento("clic_rayami_cta", { lugar: "tarjeta", pin_id: v.id }));
    const rep = nodo("a", "p24-t-rep", "Reportar este puesto");
    rep.href = linkWa(CONFIG.whatsappRayami, CONFIG.mensajes.reportar.replace("{id}", v.id));
    rep.target = "_blank"; rep.rel = "noopener";
    rep.addEventListener("click", () => evento("reportar", { pin_id: v.id }));
    pie.appendChild(cta); pie.appendChild(rep);
    tarjeta.appendChild(pie);

    tarjeta.hidden = false;
    tarjeta.scrollTop = 0;
    marco.classList.add("con-tarjeta"); // en celular esconde los botones + y − mientras la tarjeta está abierta
    // Mueve el mapa lo justo para que la tarjeta no tape el pin.
    // Celular: la tarjeta ocupa el ancho de abajo → el pin debe quedar arriba de ella.
    // Pantalla ancha: la tarjeta va en la esquina izquierda → el pin debe quedar a su derecha.
    const zona = v.modo === "zona";
    const arriba = zona ? 30 : 60; // lo que mide el pin hacia arriba de su punto
    const derecha = 150;           // ancho que ocupan "Cerca de mí" y los botones + y −
    if (window.matchMedia("(min-width: 861px)").matches) {
      mapa.panInside([v.lat, v.lng], { paddingTopLeft: [tarjeta.offsetWidth + 14 + 34, arriba], paddingBottomRight: [derecha, 40] });
    } else {
      mapa.panInside([v.lat, v.lng], { paddingTopLeft: [44, arriba], paddingBottomRight: [derecha, tarjeta.offsetHeight + 34 + (zona ? 24 : 0)] });
    }
    evento("abrir_pin", { pin_id: v.id, giro: v.giroId });
  }

  mapa.on("click", cerrar);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") cerrar(); });

  /* 4.4 Filtro por giro (chips) */
  function avisar(texto) {
    aviso.textContent = texto;
    aviso.hidden = false;
    clearTimeout(relojAviso);
    relojAviso = setTimeout(() => { aviso.hidden = true; }, 7000);
  }

  function pintarConteo() {
    const n = visibles().length;
    if (errorCarga) { conteo.textContent = "No se pudieron cargar los puestos. Intenta de nuevo en unos minutos."; return; }
    if (!lista.length) { conteo.textContent = "Todavía no hay puestos en el mapa."; return; }
    conteo.textContent = (n === 1 ? "1 puesto" : n + " puestos") + (filtro === "todos" ? "" : " de " + CONFIG.giros[filtro].nombre.toLowerCase()) + " en el mapa. Toca un pin para ver lugar y horario.";
  }

  function aplicarFiltro(giroId, deUsuario) {
    filtro = giroId;
    lista.forEach((v) => {
      const g = capas[v.id].grupo;
      if (filtro === "todos" || v.giroId === filtro) g.addTo(mapa);
      else mapa.removeLayer(g);
    });
    Array.prototype.forEach.call(chips.children, (b) => b.setAttribute("aria-pressed", String(b.dataset.giro === filtro)));
    if (abierto && filtro !== "todos" && abierto.giroId !== filtro) cerrar();
    if (!abierto) encuadrar();
    pintarConteo();
    if (deUsuario) evento("filtro_giro", { giro: giroId });
  }

  function chip(giroId, icono, texto) {
    const b = nodo("button", "p24-chip");
    b.type = "button";
    b.dataset.giro = giroId;
    if (icono) b.appendChild(nodo("span", "p24-chip-ico", icono));
    b.appendChild(document.createTextNode(texto));
    b.addEventListener("click", () => { cerrar(); aplicarFiltro(giroId, true); });
    chips.appendChild(b);
  }
  const girosPresentes = Object.keys(CONFIG.giros).filter((g) => lista.some((v) => v.giroId === g));
  if (girosPresentes.length > 1) {
    chip("todos", "", "Todos");
    girosPresentes.forEach((g) => chip(g, CONFIG.giros[g].icono, CONFIG.giros[g].nombre));
  } else {
    chips.hidden = true;
  }

  aplicarFiltro("todos", false);
  if (lista.some((v) => v.ejemplo)) $("p24-demo").hidden = false;

  /* 4.5 "Cerca de mí": usa la ubicación del navegador solo si la persona acepta.
     La posición se queda en su celular: no se guarda ni se manda a ningún lado. */
  const btnCerca = $("p24-cerca");
  let yo = null;
  btnCerca.addEventListener("click", () => {
    if (!("geolocation" in navigator)) { avisar("Tu navegador no permite ubicar tu posición. Mueve el mapa a mano."); return; }
    btnCerca.disabled = true;
    btnCerca.classList.add("es-buscando");
    const listo = () => { btnCerca.disabled = false; btnCerca.classList.remove("es-buscando"); };
    navigator.geolocation.getCurrentPosition((pos) => {
      listo();
      const aqui = L.latLng(pos.coords.latitude, pos.coords.longitude);
      let cerca = null, dist = Infinity;
      visibles().forEach((v) => {
        const d = Math.max(0, aqui.distanceTo([v.lat, v.lng]) - v.radio);
        if (d < dist) { dist = d; cerca = v; }
      });
      if (cerca && dist > CONFIG.lejosMetros) { avisar("Estás lejos de los puestos del mapa. Por ahora Punto 24 cubre Cuautitlán Izcalli."); return; }
      if (yo) mapa.removeLayer(yo);
      yo = L.featureGroup().addTo(mapa);
      if (pos.coords.accuracy && pos.coords.accuracy < 1500) L.circle(aqui, { radius: pos.coords.accuracy, color: "#2563eb", weight: 1, fillOpacity: 0.1, interactive: false }).addTo(yo);
      L.marker(aqui, { icon: L.divIcon({ className: "p24-marca", html: '<span class="p24-yo"></span>', iconSize: [22, 22], iconAnchor: [11, 11] }), interactive: false, keyboard: false, zIndexOffset: 900 }).addTo(yo);
      cerrar();
      if (!cerca) { mapa.setView(aqui, 15); avisar("Aquí estás. Todavía no hay puestos en el mapa."); return; }
      mapa.fitBounds(L.latLngBounds([aqui, [cerca.lat, cerca.lng]]), { padding: [64, 64], maxZoom: 16 });
      avisar(dist < 30 ? "Tienes un puesto prácticamente aquí." : "El puesto más cercano está a " + textoDistancia(dist) + ".");
    }, (err) => {
      listo();
      avisar(err && err.code === 1 ? "No diste permiso de ubicación. Puedes mover el mapa a mano." : "No pudimos ubicarte. Intenta de nuevo o mueve el mapa a mano.");
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
  });

  /* 4.6 Ganchos a RAYAMI Store */
  const alta = $("p24-alta-btn"), altaWa = $("p24-alta-wa");
  if (alta) alta.addEventListener("click", () => evento("clic_rayami_cta", { lugar: "alta", medio: "registro" }));
  if (altaWa) altaWa.addEventListener("click", () => evento("clic_rayami_cta", { lugar: "alta", medio: "whatsapp" }));
  document.querySelectorAll(".p24-ir-alta").forEach((a) => a.addEventListener("click", () => evento("clic_rayami_cta", { lugar: "arriba", medio: "registro" })));

  /* 4.7 Modo revisión (/?revisar=1): ayuda para quien edita vendedores.js */
  if (REVISAR) {
    const caja = $("p24-revisar");
    caja.hidden = false;
    caja.appendChild(nodo("h2", "", "Modo revisión"));
    caja.appendChild(nodo("p", "", "Solo tú ves esto (por el ?revisar=1 de la dirección). Toca cualquier punto del mapa para ver sus coordenadas."));
    caja.appendChild(nodo("p", "", desdeBase ? "Los puestos vienen de la base (aprobados en /admin/)." : "Los puestos vienen de vendedores.js (la base está vacía o no respondió)."));
    const ul = nodo("ul");
    if (errorCarga) ul.appendChild(nodo("li", "es-error", "vendedores.js tiene un error de escritura y no se pudo leer: " + errorCarga + ". Casi siempre es una coma, una comilla o una llave que falta."));
    prep.problemas.forEach((t) => ul.appendChild(nodo("li", "es-error", t)));
    prep.ocultos.forEach((t) => ul.appendChild(nodo("li", "", "Oculto: " + t)));
    if (!errorCarga && !prep.problemas.length) ul.appendChild(nodo("li", "es-ok", "Sin errores. Puestos visibles: " + lista.length + "."));
    caja.appendChild(ul);
    mapa.on("click", (e) => {
      const txt = "lat: " + e.latlng.lat.toFixed(5) + ",\nlng: " + e.latlng.lng.toFixed(5) + ",";
      const pre = nodo("pre", "p24-coord", txt);
      L.popup().setLatLng(e.latlng).setContent(pre).openOn(mapa);
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(() => avisar("Coordenadas copiadas. Pégalas en vendedores.js"), () => {});
    });
  } else if (errorCarga) {
    console.error("Punto 24: no se pudo leer vendedores.js →", errorCarga);
  }
  if (prep.problemas.length) console.warn("Punto 24: revisa vendedores.js\n- " + prep.problemas.join("\n- "));

  evento("ver_mapa", { pines: lista.length });
}

iniciar().catch((e) => {
  console.error("Punto 24:", e);
  const c = $("p24-conteo");
  if (c) c.textContent = "Algo falló al cargar el mapa. Recarga la página.";
});
