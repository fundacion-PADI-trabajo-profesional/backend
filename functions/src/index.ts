import { onRequest } from "firebase-functions/v2/https"; // Importa v2
import { createApp } from "./server";

const app = createApp();

// Aquí le decimos explícitamente que use el secreto 'DATABASE_URL'
export const api = onRequest({ 
    secrets: ["DATABASE_URL", "SUPABASE_URL", "SUPABASE_KEY"],
    memory: "256MiB" // Opcional: ajusta según necesites
}, app);