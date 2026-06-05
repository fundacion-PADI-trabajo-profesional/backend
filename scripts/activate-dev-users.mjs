/**
 * Script de desarrollo: activa usuarios @educacion.gob.ar en Supabase Auth
 * y les asigna una contraseña fija para poder iniciar sesión en dev.
 *
 * Uso:
 *   node scripts/activate-dev-users.mjs
 *
 * Requiere las variables SUPABASE_URL y SUPABASE_SERVICE_KEY en backend/.env
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Cargar .env manualmente (sin dependencia de dotenv)
const envPath = resolve(__dirname, "../.env");
const envVars = Object.fromEntries(
  readFileSync(envPath, "utf-8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const idx = l.indexOf("=");
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    })
);

const SUPABASE_URL = envVars.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = envVars.SUPABASE_SERVICE_KEY;
const DEV_PASSWORD = "Padi1234!";

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY en backend/.env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

const USERS = [
  { id: "00257ad1-eb22-43dd-87c5-421eec24a3c5", email: "emilio.juarez2@educacion.gob.ar", rol: "docente" },
  { id: "0c0fd195-c17a-408a-9745-d6d87e570ddf", email: "franco.gutierrez@educacion.gob.ar", rol: "director" },
  { id: "0ef8c2d6-f7fd-4646-b7bb-3eec4bf50b52", email: "milagros.gomez_enc@educacion.gob.ar", rol: "encargado_zona" },
  { id: "0f02bad0-e706-4ef4-a6aa-9385dd59ba71", email: "aldana.diaz_enc@educacion.gob.ar", rol: "encargado_zona" },
  { id: "0f9aea4b-8acd-4e10-bc59-4585944528c0", email: "admin.padi@educacion.gob.ar", rol: "equipo_padi" },
  { id: "1064005c-3985-43cf-bf76-be1d1efa2197", email: "diana.fuentes1@educacion.gob.ar", rol: "docente" },
  { id: "114125c6-3a9b-4dd4-8f12-59e0a18ff6b6", email: "lucas.esposito1@educacion.gob.ar", rol: "docente" },
  { id: "134c6c92-ec5b-427c-9fde-4fbf3ff350bf", email: "sebastian.suarez1@educacion.gob.ar", rol: "docente" },
  { id: "1931e9ee-a56c-4941-bbf2-4050a748dbcf", email: "martina.romano2@educacion.gob.ar", rol: "docente" },
  { id: "1b3dbd5c-e9a1-4a6f-81f7-6d1c2dbc2134", email: "clara.gimenez@educacion.gob.ar", rol: "director" },
  { id: "1bf90e27-dc96-425e-8cf3-a17156dc8907", email: "andres.ferreyra1@educacion.gob.ar", rol: "docente" },
  { id: "2a45c2ab-8cbf-4db0-b264-accc79ac1b1e", email: "franco.pizarro2@educacion.gob.ar", rol: "docente" },
  { id: "30beb45f-6835-44f2-8eb8-1f9d7914c120", email: "mariana.rios2@educacion.gob.ar", rol: "docente" },
  { id: "36386821-f6e0-4cc0-ac52-c49f9b49bd26", email: "diana.amaya1@educacion.gob.ar", rol: "docente" },
  { id: "38602ab6-96a4-42f2-bae8-cc938dcdcd03", email: "valentina.paredes2@educacion.gob.ar", rol: "docente" },
  { id: "5715bd6f-a416-4293-84c2-e2e3444ea7c8", email: "emilio.gimenez@educacion.gob.ar", rol: "director" },
  { id: "5cabcc97-663f-4c97-9562-69f0e5d7b875", email: "hilda.cabrera@educacion.gob.ar", rol: "director" },
  { id: "5f987c71-a65e-488e-abf3-ad39fec21bbe", email: "carlos.acosta2@educacion.gob.ar", rol: "docente" },
  { id: "5fb8d16c-2720-497d-b2eb-d6899be578c7", email: "karina.gutierrez1@educacion.gob.ar", rol: "docente" },
  { id: "680ac07a-2a93-4d62-bc83-5dc0d9441fa5", email: "santiago.gimenez_enc@educacion.gob.ar", rol: "encargado_zona" },
  { id: "693dffbc-6c6f-4611-9ab3-3edf6e595ed3", email: "tomas.pizarro1@educacion.gob.ar", rol: "docente" },
  { id: "6c006f61-23e2-4cb4-b2d8-567d894a05e4", email: "martin.gomez2@educacion.gob.ar", rol: "docente" },
  { id: "6c12ace8-ae34-4454-8ac5-b68c28f49481", email: "ignacio.vazquez@educacion.gob.ar", rol: "director" },
  { id: "877409a9-77d2-4e02-bf01-cf99988c24c9", email: "daniel.ramos@educacion.gob.ar", rol: "director" },
  { id: "8a63f881-ffd0-49d5-a6f2-f7b80cf35b58", email: "fabiana.perez2@educacion.gob.ar", rol: "docente" },
  { id: "8fb5d27b-beb7-4919-bf22-faf823bed01d", email: "milagros.jimenez@educacion.gob.ar", rol: "director" },
  { id: "a491f0b2-ea1f-4a65-a27a-984d654821d0", email: "nahuel.blanco@educacion.gob.ar", rol: "director" },
  { id: "ab4220a7-474a-493b-bced-df2d839fbc50", email: "pablo.rodriguez2@educacion.gob.ar", rol: "docente" },
  { id: "b88139b9-ae27-4da7-82f0-6b90f143262f", email: "fabiana.amaya@educacion.gob.ar", rol: "director" },
  { id: "e0f3eab0-5cec-4eb5-add9-68311ca35cfb", email: "betina.martinez1@educacion.gob.ar", rol: "docente" },
  { id: "e1e3db63-ef7d-4c76-b92d-a22b21df306f", email: "valeria.luna1@educacion.gob.ar", rol: "docente" },
  { id: "ed3049cf-43e4-48fc-a3f2-ae24fc3d3348", email: "daniel.garcia_enc@educacion.gob.ar", rol: "encargado_zona" },
  { id: "f26b4776-913e-4de2-a0c5-3cb83da9c2a9", email: "mariana.gonzalez2@educacion.gob.ar", rol: "docente" },
  { id: "f42d47cc-00d4-4f59-b427-3ca3287d06ca", email: "diego.cabrera@educacion.gob.ar", rol: "director" },
  { id: "fa5d3100-11b7-4948-90e6-e6607c69dee1", email: "santiago.ferreyra1@educacion.gob.ar", rol: "docente" },
  { id: "fed4057d-bb02-4576-b512-c4c3b253d218", email: "brenda.cabrera_enc@educacion.gob.ar", rol: "encargado_zona" },
];

async function run() {
  console.log(`🚀 Activando ${USERS.length} usuarios de dev con contraseña: ${DEV_PASSWORD}\n`);

  let ok = 0;
  let fail = 0;

  for (const user of USERS) {
    const { error } = await supabase.auth.admin.updateUser(user.id, {
      password: DEV_PASSWORD,
      email_confirm: true,
    });

    if (error) {
      console.error(`  ❌ [${user.rol}] ${user.email} → ${error.message}`);
      fail++;
    } else {
      console.log(`  ✅ [${user.rol}] ${user.email}`);
      ok++;
    }
  }

  console.log(`\n📊 Resultado: ${ok} activados, ${fail} fallidos`);
  console.log(`\n🔑 Contraseña para todos: ${DEV_PASSWORD}`);
}

run().catch((e) => {
  console.error("Error inesperado:", e);
  process.exit(1);
});
