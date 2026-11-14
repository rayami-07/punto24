/* ============================================================
   PUNTO 24 — conexión a Firebase (registro, edición y panel)
   El mapa público NO usa este archivo: lee los puestos aprobados
   por una URL pública (ver CONFIG.fuente en config.js).
   Mismo proyecto que el resto del sitio (rayami-store).
============================================================ */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, get, set, update, remove, onValue, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const FB_CONFIG = {
  apiKey: "AIzaSyDDVxmRmKb9yIZSV0ZxkPKvQPOK-oAGMWU",
  authDomain: "rayami-store.firebaseapp.com",
  databaseURL: "https://rayami-store-default-rtdb.firebaseio.com",
  projectId: "rayami-store",
  storageBucket: "rayami-store.firebasestorage.app",
  messagingSenderId: "57542479161",
  appId: "1:57542479161:web:425e75300b964e1f526ce8"
};

export const app = initializeApp(FB_CONFIG);
export const db = getDatabase(app);
export const auth = getAuth(app);

/* Quién aprueba: el mismo correo admin que en las reglas del resto del sitio. */
export const ADMIN_EMAIL = "raulbenitez563@gmail.com";
export const esAdmin = (user) => !!user && String(user.email || "").toLowerCase() === ADMIN_EMAIL;

/* Dónde vive cada cosa en la base (debe coincidir con las reglas). */
export const RUTAS = {
  solicitudes: "punto24/solicitudes", // lo que escribe el vendedor; solo lo ve él y el admin
  publico: "punto24/publico",         // solo aprobados; lectura pública; solo escribe el admin
  porUid: "punto24/porUid"            // un registro por dispositivo
};

export { ref, get, set, update, remove, onValue, serverTimestamp, signInAnonymously, onAuthStateChanged, signInWithEmailAndPassword, signOut };

/* Espera a saber si hay sesión (una sola vez). */
export const sesionActual = () => new Promise((res) => { const off = onAuthStateChanged(auth, (u) => { off(); res(u); }); });

/* Texto de error entendible para el vendedor. */
export function textoError(e) {
  const c = (e && e.code) || "";
  if (c.indexOf("permission") >= 0 || c === "PERMISSION_DENIED") return "No se pudo guardar: este registro no es tuyo o ya enviaste uno desde este celular. Escríbenos por WhatsApp y lo arreglamos.";
  if (c.indexOf("network") >= 0) return "Sin conexión. Revisa tu internet e intenta de nuevo; lo que escribiste sigue aquí.";
  if (c === "auth/operation-not-allowed") return "El registro todavía no está activado. Escríbenos por WhatsApp y te subimos nosotros.";
  if (c === "auth/invalid-credential" || c === "auth/wrong-password" || c === "auth/user-not-found") return "Correo o contraseña incorrectos.";
  return "Algo falló: " + ((e && e.message) || e) + ". Intenta de nuevo o escríbenos por WhatsApp.";
}
