/**
 * Punto de entrada principal para Firebase Cloud Functions (v2).
 * * @remarks
 * Este archivo exporta la instancia de la API configurada para el entorno serverless.
 * Se utiliza `onRequest` de la v2 para manejar las peticiones HTTPS.
 * * La configuración incluye:
 * - **Secrets:** Inyección de variables sensibles desde Google Cloud Secret Manager. 
 * Esto evita que credenciales como `DATABASE_URL` residan en variables de entorno planas.
 * - **Memory:** Configuración de recursos para optimizar el arranque en frío (Cold Start).
 * * @module Index
 */

import { onRequest } from "firebase-functions/v2/https"; // Importa v2
import { createApp } from "./server";

const app = createApp();

/**
 * Exposición de la API Express como una función de Firebase.
 * @see {@link createApp} para la configuración interna del servidor.
 */
export const api = onRequest({
    secrets: ["DATABASE_URL", "SUPABASE_URL", "SUPABASE_KEY"],
    memory: "256MiB" // Opcional
}, app);