/* ============================================================
   PUNTO 24 — conexión a Firebase (registro, edición y panel)
   El mapa público NO usa este archivo: lee los puestos aprobados
   por una URL pública (ver CONFIG.fuente en config.js).
   Proyecto propio de Punto 24 (punto24-rayami), separado del resto del sitio.
============================================================ */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, get, set, update, remove, onValue, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const FB_CONFIG = {
  apiKey: "AIzaSyDqwmFqy8sQLZbqOVNA51o4e55S8Xavdbc",
  authDomain: "punto24-rayami.firebaseapp.com",
  databaseURL: "https://punto24-rayami-default-rtdb.firebaseio.com",
  projectId: "punto24-rayami",
  storageBucket: "punto24-rayami.firebasestorage.app",
  messagingSenderId: "12136388266",
  appId: "1:12136388266:web:ad961d0c092b4a876a22d3"
};

export const app = initializeApp(FB_CONFIG);
export const db = getDatabase(app);
export const auth = getAuth(app);

/* Quién aprueba: este correo, y solo con el correo ya verificado
   (las reglas de la base piden lo mismo). */
export const ADMIN_EMAIL = "raulbenitez563@gmail.com";
export const esCorreoAdmin = (user) => !!user && String(user.email || "").toLowerCase() === ADMIN_EMAIL;
export const esAdmin = (user) => esCorreoAdmin(user) && user.emailVerified === true;

/* Dónde vive cada cosa en la base (debe coincidir con las reglas). */
export const RUTAS = {
  solicitudes: "punto24/solicitudes", // lo que escribe el vendedor; solo lo ve él y el admin
  publico: "punto24/publico",         // solo aprobados; lectura pública; solo escribe el admin
  porUid: "punto24/porUid"            // un registro por dispositivo
};

export { ref, get, set, update, remove, onValue, serverTimestamp, signInAnonymously, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, signOut };

/* Espera a saber si hay sesión (una sola vez). */
export const sesionActual = () => new Promise((res) => { const off = onAuthStateChanged(auth, (u) => { off(); res(u); }); });

/* Texto de error entendible para el vendedor. */
export function textoError(e) {
  const c = (e && e.code) || "";
  if (c.indexOf("permission") >= 0 || c === "PERMISSION_DENIED") return "No se pudo guardar: este registro no es tuyo o ya enviaste uno desde este celular. Escríbenos por WhatsApp y lo arreglamos.";
  if (c.indexOf("network") >= 0) return "Sin conexión. Revisa tu internet e intenta de nuevo; lo que escribiste sigue aquí.";
  if (c === "auth/operation-not-allowed") return "El registro todavía no está activado. Escríbenos por WhatsApp y te subimos nosotros.";
  if (c === "auth/invalid-credential" || c === "auth/wrong-password" || c === "auth/user-not-found") return "Correo o contraseña incorrectos. Si es la primera vez, usa \"Crear mi cuenta\".";
  if (c === "auth/email-already-in-use") return "Esa cuenta ya existe. Entra con tu contraseña o usa \"Olvidé mi contraseña\".";
  if (c === "auth/weak-password") return "La contraseña debe tener al menos 6 caracteres.";
  if (c === "auth/too-many-requests") return "Demasiados intentos. Espera unos minutos.";
  return "Algo falló: " + ((e && e.message) || e) + ". Intenta de nuevo o escríbenos por WhatsApp.";
}
