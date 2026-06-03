import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente de Supabase exclusivo para operaciones de Storage.
 *
 * @remarks
 * Utiliza la service role key, que bypasea RLS y puede generar URLs firmadas
 * para buckets privados sin requerir una sesión de usuario activa.
 * Este cliente nunca debe usarse para operaciones de autenticación o acceso
 * a datos de la aplicación — para eso existe {@link getSupabase}.
 */
let storageClient: SupabaseClient | null | undefined;

/**
 * Retorna el cliente de Supabase configurado para Storage con la service role key.
 *
 * @returns Instancia de {@link SupabaseClient} o `null` si las credenciales no están disponibles.
 */
export function getSupabaseStorage(): SupabaseClient | null {
    if (storageClient !== undefined) return storageClient ?? null;

    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!url || !serviceKey) {
        storageClient = null;
        return null;
    }

    storageClient = createClient(url, serviceKey, {
        auth: { persistSession: false },
    });
    return storageClient;
}