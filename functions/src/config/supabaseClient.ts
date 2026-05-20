import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getConfig } from "./env";

/**
 * Instancia singleton del cliente de Supabase.
 * - `undefined`: aún no inicializada.
 * - `null`: inicialización fallida (credenciales ausentes).
 * - `SupabaseClient`: cliente listo para usar.
 */
let cachedClient: SupabaseClient | null | undefined;

/**
 * Retorna la instancia singleton del cliente de Supabase, inicializándola de forma diferida si aún no existe.
 *
 * @remarks
 * El cliente se crea con `persistSession: false` porque el backend es stateless:
 * cada invocación de Firebase Functions es independiente y no debe mantener estado
 * de sesión entre requests.
 *
 * El resultado se almacena en caché para evitar crear múltiples instancias.
 * Si las credenciales no están disponibles, el resultado `null` también se cachea
 * para no reintentar la lectura de configuración en cada llamada.
 *
 * @returns La instancia de {@link SupabaseClient} lista para usar, o `null` si
 * `SUPABASE_URL` o `SUPABASE_KEY` no están configuradas en el entorno.
 *
 * @example
 * ```typescript
 * const supabase = getSupabase();
 * if (!supabase) throw new Error("Supabase no está disponible");
 * const { data, error } = await supabase.auth.signInWithPassword({ email, password });
 * ```
 */
export function getSupabase(): SupabaseClient | null {
  if (cachedClient !== undefined) return cachedClient ?? null;

  const { supabaseUrl, supabaseKey } = getConfig();
  if (!supabaseUrl || !supabaseKey) {
    cachedClient = null;
    return null;
  }

  cachedClient = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });
  return cachedClient;
}


