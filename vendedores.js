/* ============================================================
   PUNTO 24 — lista de puestos
   Este es el ÚNICO archivo que se edita para agregar, mover,
   desactivar o borrar un pin.

   Cada puesto va entre llaves { } y termina con coma.
   Los textos van entre comillas; los números y true/false, sin comillas.

   CAMPOS
   id           obligatorio. Solo minúsculas, números y guiones. No se repite.
   giro         tamales | elotes | pan | camotes | comida | frutas | otro
   nombre       opcional. Si no hay, se borra la línea o se deja "".
   lat, lng     coordenadas. lat como 19.6 (positiva), lng como -99.2 (negativa).
   modo         "punto" (lugar exacto) o "zona" (círculo aproximado).
   radio        solo en modo "zona": metros del círculo (300, 500, 1000).
   lugar_texto  referencia para la gente: "frente al parque".
   horario      texto libre: "Lunes a sábado, 6:30 a 10:00 am".
   whatsapp     opcional. 10 dígitos, entre comillas. Si no hay, "".
   activo       true = se ve. false = se oculta sin borrarlo.
   actualizado  fecha en que confirmaste los datos: "AAAA-MM-DD".
                Con más de 14 días sale "puede estar desactualizado".
   ejemplo      true solo en los ficticios (muestra el aviso de ejemplo).
                En puestos reales esta línea NO va.

   Para revisar errores y sacar coordenadas: abre /punto24/?revisar=1

   ⚠ LOS 5 DE ABAJO SON FICTICIOS. No existen. Reemplázalos por los
     reales cuando cada vendedor te haya dado su autorización.
============================================================ */
export const VENDEDORES = [
  {
    id: "ejemplo-1",
    ejemplo: true,
    giro: "tamales",
    nombre: "EJEMPLO · Tamales (ficticio)",
    lat: 19.6452,
    lng: -99.2148,
    modo: "punto",
    lugar_texto: "Ejemplo: en una esquina, frente a un parque",
    horario: "Lunes a sábado, 6:30 a 10:00 am",
    whatsapp: "5581074978", // en el ejemplo es el WhatsApp de RAYAMI Store
    activo: true,
    actualizado: "2026-11-13"
  },
  {
    id: "ejemplo-2",
    ejemplo: true,
    giro: "elotes",
    nombre: "EJEMPLO · Elotes (ficticio)",
    lat: 19.652,
    lng: -99.2205,
    modo: "zona",
    radio: 300,
    lugar_texto: "Ejemplo: recorre las calles de una colonia",
    horario: "Todos los días, 5:00 a 9:00 pm",
    whatsapp: "",
    activo: true,
    actualizado: "2026-11-13"
  },
  {
    id: "ejemplo-3",
    ejemplo: true,
    giro: "pan",
    nombre: "EJEMPLO · Pan (ficticio)",
    lat: 19.6385,
    lng: -99.2085,
    modo: "punto",
    lugar_texto: "Ejemplo: afuera de una escuela",
    horario: "Lunes a viernes, 6:00 a 8:30 pm",
    whatsapp: "",
    activo: true,
    actualizado: "2026-11-13"
  },
  {
    id: "ejemplo-4",
    ejemplo: true,
    giro: "camotes",
    nombre: "EJEMPLO · Camotes (ficticio)",
    lat: 19.657,
    lng: -99.209,
    modo: "zona",
    radio: 500,
    lugar_texto: "Ejemplo: pasa por la tarde, se oye el silbato",
    horario: "Jueves a domingo, 6:00 a 9:30 pm",
    whatsapp: "",
    activo: true,
    actualizado: "2026-10-20" // fecha vieja a propósito: muestra "puede estar desactualizado"
  },
  {
    id: "ejemplo-5",
    ejemplo: true,
    giro: "frutas",
    nombre: "EJEMPLO · Frutas (ficticio)",
    lat: 19.633,
    lng: -99.223,
    modo: "punto",
    lugar_texto: "Ejemplo: junto a una parada de camión",
    horario: "Lunes a sábado, 9:00 am a 4:00 pm",
    whatsapp: "",
    activo: true,
    actualizado: "2026-11-13"
  }
];
