import { getSupabase } from "../config/supabaseClient";
import { getPrisma } from "../config/prismaClient";

export class AuthService {
  /**
   * Autentica a un usuario contra Supabase Auth.
   */
  static async login(email: string, password: string) {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase client no está disponible.");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data?.user) throw new Error("Credenciales inválidas");

    // Obtener perfil desde public.usuarios
    let profile: any = null;
    try {
      const { data: profileData } = await (supabase as any)
        .from("usuarios")
        .select("*")
        .eq("id", data.user.id)
        .single();
      profile = profileData ?? null;
    } catch (_e) {
      profile = null;
    }

    return { user: data.user, session: data.session, profile };
  }

  /**
   * Registra un nuevo usuario en Auth y guarda su perfil en la tabla 'usuarios'.
   */
  static async register(userData: {
    email: string;
    password: string;
    nombre: string;
    apellido: string;
    rol: string;
  }) {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase client no está disponible.");

    // 1. Crear el usuario en Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: userData.email,
      password: userData.password,
    });

    if (authError) throw new Error(authError.message);
    if (!authData.user) throw new Error("No se pudo crear el usuario en el sistema de autenticación.");

    // 2. Guardar los datos extra en la tabla 'usuarios'
    const { error: profileError } = await supabase.from("usuarios").insert({
      id: authData.user.id, // Vincula el perfil al usuario de Auth
      email: userData.email,
      nombre: userData.nombre,
      apellido: userData.apellido,
      rol: userData.rol,
    });

    if (profileError) {
      // Importante: Si esto falla, deberíamos borrar el usuario de Auth para evitar datos inconsistentes.
      await supabase.auth.admin.deleteUser(authData.user.id);
      throw new Error(`No se pudo guardar el perfil de usuario: ${profileError.message}`);
    }

    // 3. Si es docente, crear persona + profesor vinculados (para que evaluaciones se asocien correctamente)
    if (userData.rol === "docente") {
      const prisma = getPrisma();
      if (prisma) {
        try {
          // Si ya existe el profesor con ese id, no duplicar
          const existing = await (prisma as any).profesores.findUnique({ where: { id: authData.user.id } });
          if (!existing) {
            const persona = await (prisma as any).personas.create({
              data: {
                nombre: userData.nombre ?? null,
                primer_apellido: userData.apellido ?? null,
              },
            });
            await (prisma as any).profesores.create({
              data: {
                id: authData.user.id,
                persona_id: persona.id,
              },
            });
          }
        } catch (e: any) {
          // En caso de error, limpiamos el usuario creado para no dejar datos inconsistentes
          await supabase.auth.admin.deleteUser(authData.user.id);
          // y tratamos de eliminar el perfil insertado
          try { await (supabase as any).from("usuarios").delete().eq("id", authData.user.id); } catch {}
          throw new Error(`No se pudo crear el registro de profesor: ${e?.message || String(e)}`);
        }
      }
    }

    return authData;
  }
}