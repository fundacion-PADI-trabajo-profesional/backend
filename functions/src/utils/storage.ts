import { getSupabaseStorage } from "../config/supabaseStorage";

/** Nombre del bucket en Supabase Storage. */
const BUCKET = "imagenes-evaluaciones";

/** Tiempo de validez de la URL firmada en segundos (1 hora). */
const SIGNED_URL_TTL_SECONDS = 3600;

/**
 * Genera una URL firmada y temporalmente válida para una imagen almacenada
 * en el bucket privado de Supabase Storage.
 *
 * @param path - Path relativo dentro del bucket. Ejemplo: `"sala-3/motricidad/pregunta-12.png"`.
 * @returns URL firmada con validez de 1 hora, o `null` si el path está vacío
 *          o si el cliente de Storage no está disponible.
 *
 * @example
 * ```typescript
 * const url = await getSignedImageUrl("sala-4/lenguaje/p5.jpg");
 * // "https://xxxx.supabase.co/storage/v1/object/sign/imagenes-evaluaciones/sala-4/lenguaje/p5.jpg?token=..."
 * ```
 */
export async function getSignedImageUrl(path: string): Promise<string | null> {
    if (!path) return null;

    const supabase = getSupabaseStorage();
    if (!supabase) {
        console.error("[getSignedImageUrl] Cliente de Storage no disponible.");
        return null;
    }

    const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

    if (error || !data?.signedUrl) {
        console.error("[getSignedImageUrl] Error al generar URL firmada:", error?.message);
        return null;
    }

    return data.signedUrl;
}