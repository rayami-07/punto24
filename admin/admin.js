/* ============================================================
   PUNTO 24 — panel del admin (solo Raúl)
   Aprueba, corrige, rechaza o retira registros, y da de alta a
   quien no tiene WhatsApp. Aprobar = copiar a punto24/publico, que
   es lo único que lee el mapa.
============================================================ */
import { CONFIG } from "../config.js";
import { crearFormulario, aPublico, nuevoId } from "../formulario.js";
import { db, auth, RUTAS, ref, get, set, update, remove, onValue, serverTimestamp, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, signOut, sesionActual, esAdmin, esCorreoAdmin, ADMIN_EMAIL, textoError } from "../fb.js";

const $ = (id) => document.getElementById(id);
const nodo = (tag, clase, texto) => { const n = document.createElement(tag); if (clase) n.className = clase; if (texto != null) n.textContent = texto; return n; };
const BASE = location.origin + location.pathname.replace(/\/admin\/?.*$/, "/");
const fecha = (ms) => (ms ? new Date(ms).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");
const linkWa = (tel, msg) => "https://api.whatsapp.com/send?phone=52" + tel + "&text=" + encodeURIComponent(msg);

let solicitudes = {}, publico = {}, offS = null, offP = null;

async function iniciar() {
  const user = await sesionActual();
  if (esCorreoAdmin(user)) {
    try { await user.reload(); } catch (e) {}
    if (esAdmin(auth.currentUser)) return panel(auth.currentUser);
    login(); return pedirVerificacion(auth.currentUser);
  }
  if (user) await signOut(auth); // sesión anónima u otra cuenta: fuera
  login();
}

function login() {
  $("p24-login").hidden = false; $("p24-panel").hidden = true;
  const f = $("p24-login-form"), err = $("p24-login-err"), info = $("p24-login-info");
  const mostrar = (t, error) => { err.hidden = true; info.hidden = true; const el = error ? err : info; el.textContent = t; el.hidden = !t; };
  const correo = () => f.correo.value.trim().toLowerCase();
  f.onsubmit = async (e) => {
    e.preventDefault(); mostrar("");
    try {
      const cred = await signInWithEmailAndPassword(auth, correo(), f.clave.value);
      if (!esCorreoAdmin(cred.user)) { await signOut(auth); throw { code: "auth/invalid-credential" }; }
      if (!cred.user.emailVerified) return pedirVerificacion(cred.user);
      panel(cred.user);
    } catch (e2) { mostrar(textoError(e2), true); }
  };
  $("p24-crear").onclick = async () => {
    mostrar("");
    if (correo() !== ADMIN_EMAIL) return mostrar("Solo el correo de administrador de RAYAMI Store puede crear cuenta aquí.", true);
    if (f.clave.value.length < 6) return mostrar("Escribe la contraseña que quieres usar (mínimo 6 caracteres) y vuelve a tocar \"Crear mi cuenta\".", true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, correo(), f.clave.value);
      await sendEmailVerification(cred.user);
      pedirVerificacion(cred.user, true);
    } catch (e2) { mostrar(textoError(e2), true); }
  };
  $("p24-olvide").onclick = async () => {
    mostrar("");
    if (!correo()) return mostrar("Escribe tu correo arriba y vuelve a tocar \"Olvidé mi contraseña\".", true);
    try { await sendPasswordResetEmail(auth, correo()); mostrar("Te mandamos un correo para cambiar tu contraseña. Revisa también spam.", false); }
    catch (e2) { mostrar(textoError(e2), true); }
  };
}

/* El panel solo abre con el correo verificado (las reglas lo exigen). */
function pedirVerificacion(user, recienCreada) {
  const info = $("p24-login-info"), err = $("p24-login-err");
  err.hidden = true;
  info.hidden = false;
  info.innerHTML = "";
  info.appendChild(nodo("b", "", recienCreada ? "Cuenta creada. Falta verificar tu correo." : "Falta verificar tu correo."));
  info.appendChild(nodo("span", "", " Te mandamos un correo a " + user.email + " (revisa también spam). Abre el enlace y luego toca \"Ya lo verifiqué\". "));
  const listo = nodo("button", "btn es-ok", "Ya lo verifiqué"); listo.type = "button";
  const reenviar = nodo("button", "btn", "Reenviar correo"); reenviar.type = "button";
  info.appendChild(listo); info.appendChild(reenviar);
  listo.onclick = async () => {
    try { await user.reload(); await user.getIdToken(true); } catch (e) {}
    if (esAdmin(auth.currentUser)) panel(auth.currentUser);
    else { err.textContent = "Todavía no aparece verificado. Abre el enlace del correo y vuelve a intentar."; err.hidden = false; }
  };
  reenviar.onclick = async () => {
    try { await sendEmailVerification(user); reenviar.textContent = "Enviado"; } catch (e) { err.textContent = textoError(e); err.hidden = false; }
  };
}

function panel(user) {
  $("p24-login").hidden = true; $("p24-panel").hidden = false;
  $("p24-quien").textContent = user.email;
  $("p24-salir").addEventListener("click", async () => { await signOut(auth); location.reload(); });
  $("p24-nuevo").addEventListener("click", () => editar(null));
  if (offS) offS(); if (offP) offP();
  offS = onValue(ref(db, RUTAS.solicitudes), (s) => { solicitudes = s.val() || {}; pintar(); sincronizar(); }, (e) => aviso(textoError(e), true));
  offP = onValue(ref(db, RUTAS.publico), (s) => { publico = s.val() || {}; pintar(); });
}

/* Si un registro quedó retirado o rechazado pero sigue en el mapa, se quita solo. */
async function sincronizar() {
  const cambios = {};
  Object.keys(solicitudes).forEach((id) => {
    const e = solicitudes[id].estado;
    if ((e === "retirado" || e === "rechazado") && publico[id]) cambios[RUTAS.publico + "/" + id] = null;
  });
  if (Object.keys(cambios).length) { try { await update(ref(db), cambios); } catch (e) { aviso(textoError(e), true); } }
}

function pintar() {
  const ids = Object.keys(solicitudes).sort((a, b) => (solicitudes[b].actualizado || 0) - (solicitudes[a].actualizado || 0));
  const grupos = { pendiente: [], aprobado: [], otros: [] };
  ids.forEach((id) => { const e = solicitudes[id].estado; (grupos[e] || grupos.otros).push(id); });
  // Aprobados con cambios sin publicar: el vendedor editó después de aprobado → vuelven a pendiente solos.
  $("p24-n-pend").textContent = grupos.pendiente.length;
  $("p24-n-apr").textContent = grupos.aprobado.length;
  $("p24-n-otros").textContent = grupos.otros.length;
  llenar("p24-l-pend", grupos.pendiente, "No hay registros por revisar.");
  llenar("p24-l-apr", grupos.aprobado, "Todavía no hay puestos publicados.");
  llenar("p24-l-otros", grupos.otros, "Nada por aquí.");
}

function llenar(idLista, ids, vacio) {
  const ul = $(idLista); ul.innerHTML = "";
  if (!ids.length) { ul.appendChild(nodo("li", "p24-vacio", vacio)); return; }
  ids.forEach((id) => ul.appendChild(tarjeta(id, solicitudes[id])));
}

function tarjeta(id, s) {
  const li = nodo("li", "p24-sol es-" + s.estado);
  const g = CONFIG.giros[s.giro] || CONFIG.giros[CONFIG.giroPorDefecto];
  const cab = nodo("div", "p24-sol-cab");
  cab.appendChild(nodo("span", "p24-sol-ico", g.icono));
  const t = nodo("div");
  const tipo = s.giro === "otro" && s.giroOtro ? "Otros: " + s.giroOtro : g.nombre;
  t.appendChild(nodo("b", "", (s.nombre ? s.nombre + " · " : "") + tipo));
  t.appendChild(nodo("small", "", id + " · " + (s.modo === "zona" ? "zona " + s.radio + " m" : "punto exacto") + " · " + s.estado + (s.uid === auth.currentUser.uid ? " · lo capturaste tú" : "")));
  cab.appendChild(t); li.appendChild(cab);

  const dl = nodo("dl", "p24-sol-datos");
  const dato = (k, v) => { if (!v) return; dl.appendChild(nodo("dt", "", k)); dl.appendChild(nodo("dd", "", v)); };
  dato("Vende", s.vende);
  dato("Lugar", s.lugar_texto); dato("Horario", s.horario);
  dato("WhatsApp", s.whatsapp ? s.whatsapp + (s.mostrarWhatsapp ? " (se muestra)" : " (no se muestra)") : "no dio");
  dato("Contacto privado", s.contacto); dato("Coordenadas", s.lat + ", " + s.lng);
  dato("Creado", fecha(s.creado)); dato("Último cambio", fecha(s.actualizado)); dato("Aprobado", fecha(s.aprobadoEl));
  dato("Notas", s.notasAdmin);
  if (publico[id]) { const p = publico[id]; const dif = ["giro", "giroOtro", "vende", "nombre", "lat", "lng", "modo", "lugar_texto", "horario"].some((k) => String(p[k] ?? "") !== String(s[k] ?? "")) || (p.whatsapp || "") !== (s.mostrarWhatsapp ? s.whatsapp || "" : ""); dato("En el mapa", dif ? "sí, con datos distintos a estos" : "sí, igual que aquí"); }
  else if (s.estado === "aprobado") dato("En el mapa", "NO (aprueba de nuevo para publicarlo)");
  li.appendChild(dl);

  const acc = nodo("div", "p24-sol-acc");
  const btn = (txt, clase, fn) => { const b = nodo("button", "btn " + clase, txt); b.type = "button"; b.addEventListener("click", () => fn(b)); acc.appendChild(b); return b; };
  if (s.estado !== "aprobado" || !publico[id]) btn("Aprobar y publicar", "es-ok", (b) => accion(b, () => aprobar(id, s)));
  else btn("Volver a publicar", "es-ok", (b) => accion(b, () => aprobar(id, s)));
  btn("Editar", "", () => editar(id));
  if (s.estado !== "rechazado") btn("Rechazar", "es-no", (b) => accion(b, () => cambiarEstado(id, "rechazado")));
  if (s.estado === "aprobado") btn("Retirar del mapa", "es-no", (b) => accion(b, () => cambiarEstado(id, "retirado")));
  btn("Borrar", "es-borrar", (b) => { if (confirm("¿Borrar este registro por completo? Se quita del mapa y del historial.")) accion(b, () => borrar(id, s)); });
  const ver = nodo("a", "btn", "Ver en OSM"); ver.href = "https://www.openstreetmap.org/?mlat=" + s.lat + "&mlon=" + s.lng + "#map=17/" + s.lat + "/" + s.lng; ver.target = "_blank"; ver.rel = "noopener"; acc.appendChild(ver);
  if (s.contacto) { const wa = nodo("a", "btn btn-wa", "WhatsApp"); wa.href = linkWa(s.contacto, mensajeAviso(id, s)); wa.target = "_blank"; wa.rel = "noopener"; acc.appendChild(wa); }
  if (publico[id]) { const qr = nodo("a", "btn", "Link QR"); qr.href = BASE + "?de=qr&c=" + id; qr.target = "_blank"; acc.appendChild(qr); }
  li.appendChild(acc);
  const notas = nodo("textarea", "p24-sol-notas"); notas.placeholder = "Notas solo para ti (ej. permiso recibido 14/nov)"; notas.value = s.notasAdmin || ""; notas.maxLength = 500;
  notas.addEventListener("change", async () => { try { await update(ref(db, RUTAS.solicitudes + "/" + id), { notasAdmin: notas.value.trim() }); } catch (e) { aviso(textoError(e), true); } });
  li.appendChild(notas);
  return li;
}

function mensajeAviso(id, s) {
  if (s.estado === "aprobado") return "Hola, soy de RAYAMI Store. Tu puesto ya está publicado en Punto 24: " + BASE + "?c=" + id + " . Cuando cambies de horario o lugar, avísanos o edítalo con tu link.";
  if (s.estado === "pendiente") return "Hola, soy de RAYAMI Store. Recibimos tu registro en Punto 24. Antes de publicarlo quiero confirmar contigo: ";
  return "Hola, soy de RAYAMI Store, sobre tu registro en Punto 24: ";
}

async function accion(b, fn) {
  const t = b.textContent; b.disabled = true; b.textContent = "…";
  try { await fn(); aviso("Hecho.", false); } catch (e) { aviso(textoError(e), true); }
  b.disabled = false; b.textContent = t;
}
async function aprobar(id, s) {
  const cambios = {};
  cambios[RUTAS.publico + "/" + id] = aPublico(s);
  cambios[RUTAS.solicitudes + "/" + id + "/estado"] = "aprobado";
  cambios[RUTAS.solicitudes + "/" + id + "/aprobadoEl"] = serverTimestamp();
  await update(ref(db), cambios);
}
async function cambiarEstado(id, estado) {
  const cambios = {};
  cambios[RUTAS.solicitudes + "/" + id + "/estado"] = estado;
  cambios[RUTAS.publico + "/" + id] = null;
  await update(ref(db), cambios);
}
async function borrar(id, s) {
  const cambios = {};
  cambios[RUTAS.solicitudes + "/" + id] = null;
  cambios[RUTAS.publico + "/" + id] = null;
  if (s.uid && s.uid !== auth.currentUser.uid) cambios[RUTAS.porUid + "/" + s.uid] = null; // libera el celular para que pueda registrarse otra vez
  await update(ref(db), cambios);
}

/* Formulario para corregir un registro o dar de alta a mano. */
function editar(id) {
  const dlg = $("p24-dlg"), caja = $("p24-dlg-caja");
  caja.innerHTML = "";
  const previo = id ? solicitudes[id] : null;
  $("p24-dlg-titulo").textContent = id ? "Editar " + id : "Dar de alta un puesto (sin WhatsApp)";
  const form = crearFormulario(caja, { valores: previo, admin: true });
  const acc = nodo("div", "p24-f-acciones");
  const guardar = nodo("button", "btn p24-f-guardar", id ? "Guardar" : "Guardar como pendiente"); guardar.type = "submit";
  const guardarPub = nodo("button", "btn es-ok", id ? "Guardar y publicar" : "Guardar y publicar"); guardarPub.type = "button";
  const cancelar = nodo("button", "btn", "Cancelar"); cancelar.type = "button";
  acc.appendChild(guardar); acc.appendChild(guardarPub); acc.appendChild(cancelar); form.form.appendChild(acc);
  const nota = nodo("p", "p24-ayuda", id ? "" : "Para alguien que te dio sus datos en persona. Anota en Notas cómo autorizó y cuándo.");
  form.form.appendChild(nota);
  dlg.showModal();
  setTimeout(form.refrescarMapa, 250);
  cancelar.addEventListener("click", () => dlg.close());

  async function guardarReg(publicar) {
    const { datos, problemas } = form.leer();
    form.mostrarErrores(problemas);
    if (problemas.length) return;
    const nid = id || nuevoId(datos.giro);
    const reg = Object.assign({}, previo || {}, datos, {
      uid: previo ? previo.uid : auth.currentUser.uid,
      estado: publicar ? "aprobado" : "pendiente",
      actualizado: serverTimestamp(),
      creado: previo && previo.creado ? previo.creado : serverTimestamp(),
      acepto: previo ? previo.acepto === true : true,
      aceptoTs: previo && previo.aceptoTs ? previo.aceptoTs : serverTimestamp()
    });
    if (publicar) reg.aprobadoEl = serverTimestamp();
    const cambios = {};
    cambios[RUTAS.solicitudes + "/" + nid] = reg;
    if (publicar) cambios[RUTAS.publico + "/" + nid] = aPublico(datos); else if (publico[nid]) cambios[RUTAS.publico + "/" + nid] = null;
    try { await update(ref(db), cambios); dlg.close(); aviso("Guardado.", false); }
    catch (e) { form.mostrarErrores([textoError(e)]); }
  }
  form.form.addEventListener("submit", () => guardarReg(false));
  guardarPub.addEventListener("click", () => guardarReg(true));
}

let relojAviso = 0;
function aviso(t, error) {
  const a = $("p24-aviso-adm"); a.textContent = t; a.className = "p24-aviso-adm" + (error ? " es-error" : ""); a.hidden = false;
  clearTimeout(relojAviso); relojAviso = setTimeout(() => { a.hidden = true; }, error ? 8000 : 2500);
}

iniciar().catch((e) => aviso(textoError(e), true));
