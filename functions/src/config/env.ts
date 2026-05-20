/**
 * Configuración de la aplicación leída desde variables de entorno.
 *
 * En producción las variables sensibles (`SUPABASE_URL`, `SUPABASE_KEY`)
 * son inyectadas por Google Cloud Secret Manager a través de la declaración
 * `secrets` en `index.ts`. En desarrollo local se leen desde el archivo `.env`.
 */
export interface AppConfig {
  /** URL del proyecto Supabase. Corresponde a la variable `SUPABASE_URL`. */
  supabaseUrl?: string;
  /** Clave anónima o de servicio de Supabase. Corresponde a la variable `SUPABASE_KEY`. */
  supabaseKey?: string;
  /** Nombre de la tabla de evaluaciones en Supabase. Corresponde a la variable `SUPABASE_EVALUACIONES_TABLE`. */
  supabaseEvaluacionesTable?: string;
}

/**
 * Lee y retorna la configuración de la aplicación desde las variables de entorno.
 *
 * @remarks
 * Las propiedades son opcionales porque las variables de entorno pueden no estar
 * definidas en ciertos entornos (por ejemplo, durante la ejecución de tests unitarios).
 * Los clientes que dependan de estos valores deben verificar su presencia antes de usarlos.
 *
 * @returns Un objeto {@link AppConfig} con los valores actuales de las variables de entorno.
 *
 */
export function getConfig(): AppConfig {
  return {
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_KEY,
    supabaseEvaluacionesTable: process.env.SUPABASE_EVALUACIONES_TABLE,
  };
}


