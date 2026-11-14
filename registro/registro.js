/* ============================================================
   PUNTO 24 — registro y edición del vendedor
   Sin ?id= → registro nuevo. Con ?id=XXXX → edita el suyo (solo
   funciona en el mismo celular/navegador donde se registró; si lo
   perdió, escribe a RAYAMI y se edita desde el panel).
   Nada se publica hasta que el admin lo aprueba.
============================================================ */
import { CONFIG } from "../config.js";
import { crearFormulario, nuevoId } from "../formulario.js";
import { db, auth, RUTAS, ref, get, set, update, serverTimestamp, signInAnonymously, sesionActual, textoError } from "../fb.js";

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const ID = String(params.get("id") || "").replace(/[^a-z0-9-]/g, "").slice(0, 40);
const BASE = location.origin + location.pathname.replace(/\/registro\/?.*$/, "/");
const linkWa = (tel, msg) => "https://api.whatsapp.com/send?phone=" + tel + "&text=" + encodeURIComponent(msg);
function evento(n, d) { try { if (typeof window.gtag === "function") window.gtag("event", n, d || {}); } catch (e) {} }

const ESTADOS = {
  pendiente: ["Pendiente de revisión", "Ya lo tenemos. RAYAMI Store lo revisa y te avisa al número que dejaste. Mientras, no aparece en el mapa."],
  aprobado: ["Publicado", "Tu puesto ya está en el mapa. Si cambias algo aquí, vuelve a revisión antes de publicarse."],
  rechazado: ["No se publicó", "No pudimos publicarlo así. Escríbenos por WhatsApp y lo vemos."],
  retirado: ["Retirado", "Tu puesto ya no aparece en el mapa. Si quieres volver, edita tus datos y guarda."]
};

async function iniciar() {
  const caja = $("p24-reg"), estadoCaja = $("p24-reg-estado"), listo = $("p24-reg-listo");
  const btnWa = $("p24-reg-wa");
  btnWa.href = linkWa(CONFIG.whatsappRayami, "Hola, quiero aparecer en Punto 24 pero no pude registrarme en la página.");

  // Sesión anónima: no pide correo ni contraseña; sirve para que solo él edite lo suyo.
  let user = await sesionActual();
  if (!user) {
    try { user = (await signInAnonymously(auth)).user; }
    catch (e) {
      caja.appendChild(mensaje(textoError(e), true));
      caja.appendChild(mensaje("Mientras tanto, mándanos tus datos por WhatsApp y te subimos nosotros.", false));
      return;
    }
  }

  let previo = null;
  if (ID) {
    try {
      const s = await get(ref(db, RUTAS.solicitudes + "/" + ID));
      previo = s.exists() ? s.val() : null;
    } catch (e) { previo = null; }
    if (!previo) {
      caja.appendChild(mensaje("No encontramos ese registro en este celular. Si te registraste desde otro, escríbenos por WhatsApp con tu nombre y te lo editamos nosotros.", true));
      $("p24-reg-titulo").textContent = "No se encontró tu registro";
      return;
    }
    $("p24-reg-titulo").textContent = "Edita tu puesto";
    $("p24-reg-sub").textContent = "Cambia lo que necesites y guarda. Si ya estaba publicado, vuelve a revisión antes de verse el cambio.";
    const est = ESTADOS[previo.estado] || ESTADOS.pendiente;
    estadoCaja.hidden = false;
    estadoCaja.className = "p24-estado es-" + (previo.estado || "pendiente");
    estadoCaja.innerHTML = "";
    estadoCaja.appendChild(nodoB(est[0])); estadoCaja.appendChild(document.createTextNode(" " + est[1]));
  }

  const form = crearFormulario(caja, { valores: previo, admin: false, aviso: "https://rayamistore.com/privacidad/" });
  const acciones = document.createElement("div"); acciones.className = "p24-f-acciones";
  const guardar = document.createElement("button"); guardar.type = "submit"; guardar.className = "btn p24-f-guardar";
  guardar.textContent = ID ? "Guardar cambios" : "Enviar mi registro";
  acciones.appendChild(guardar);
  let retirar = null;
  if (ID && previo.estado !== "retirado") {
    retirar = document.createElement("button"); retirar.type = "button"; retirar.className = "btn p24-f-retirar"; retirar.textContent = "Retirar mi puesto del mapa";
    acciones.appendChild(retirar);
  }
  form.form.appendChild(acciones);
  evento(ID ? "registro_editar" : "registro_inicio", { pin_id: ID || "" });

  form.form.addEventListener("submit", async () => {
    const { datos, problemas } = form.leer();
    form.mostrarErrores(problemas);
    if (problemas.length) return;
    guardar.disabled = true; guardar.textContent = "Guardando…";
    const id = ID || nuevoId(datos.giro);
    const reg = Object.assign({}, datos, {
      uid: user.uid, estado: "pendiente", actualizado: serverTimestamp(),
      acepto: true, aceptoTs: previo && previo.aceptoTs ? previo.aceptoTs : serverTimestamp(),
      creado: previo && previo.creado ? previo.creado : serverTimestamp()
    });
    try {
      if (ID) {
        // Conserva lo que solo escribe el admin.
        if (previo.notasAdmin) reg.notasAdmin = previo.notasAdmin;
        if (previo.aprobadoEl) reg.aprobadoEl = previo.aprobadoEl;
        await set(ref(db, RUTAS.solicitudes + "/" + id), reg);
      } else {
        const cambios = {};
        cambios[RUTAS.solicitudes + "/" + id] = reg;
        cambios[RUTAS.porUid + "/" + user.uid] = id;
        await update(ref(db), cambios);
      }
    } catch (e) {
      guardar.disabled = false; guardar.textContent = ID ? "Guardar cambios" : "Enviar mi registro";
      form.mostrarErrores([textoError(e)]);
      return;
    }
    evento(ID ? "registro_guardado" : "registro_enviado", { pin_id: id, giro: datos.giro });
    mostrarListo(id, !!ID);
  });

  if (retirar) retirar.addEventListener("click", async () => {
    if (!confirm("¿Quitar tu puesto del mapa? Puedes volver cuando quieras.")) return;
    retirar.disabled = true;
    try {
      await update(ref(db, RUTAS.solicitudes + "/" + ID), { estado: "retirado", actualizado: serverTimestamp() });
      // Sale del mapa al instante (las reglas le permiten borrar solo su propio pin).
      try { await set(ref(db, RUTAS.publico + "/" + ID), null); } catch (e) { /* si no estaba publicado, no pasa nada */ }
      evento("registro_retirado", { pin_id: ID });
      location.reload();
    } catch (e) { retirar.disabled = false; form.mostrarErrores([textoError(e)]); }
  });

  function mostrarListo(id, edicion) {
    caja.hidden = true; estadoCaja.hidden = true;
    listo.hidden = false;
    const link = BASE + "registro/?id=" + id;
    $("p24-reg-link").textContent = link;
    $("p24-reg-link").href = link;
    $("p24-listo-titulo").textContent = edicion ? "Cambios guardados" : "¡Listo! Ya recibimos tu registro";
    $("p24-listo-texto").textContent = edicion
      ? "RAYAMI Store los revisa y, si todo está bien, se ven en el mapa en unos días."
      : "RAYAMI Store lo revisa y te avisa al número que dejaste. Mientras, no aparece en el mapa. Guarda tu link privado: con él cambias tus datos o te retiras cuando quieras.";
    // Sin número: WhatsApp pregunta a quién mandarlo (él mismo, un familiar…).
    $("p24-listo-wa").href = "https://api.whatsapp.com/send?text=" + encodeURIComponent("Mi link privado de Punto 24 (no lo compartas): " + link);
    const copiar = $("p24-listo-copiar");
    copiar.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(link); copiar.textContent = "Copiado"; } catch (e) { copiar.textContent = "Mantén presionado el link para copiarlo"; }
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function mensaje(t, error) { const p = document.createElement("p"); p.className = "p24-msg" + (error ? " es-error" : ""); p.textContent = t; return p; }
function nodoB(t) { const b = document.createElement("b"); b.textContent = t; return b; }

iniciar().catch((e) => { $("p24-reg").appendChild(mensaje(textoError(e), true)); });
