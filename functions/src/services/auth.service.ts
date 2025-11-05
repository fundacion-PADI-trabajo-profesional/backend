import { getSupabase } from "../config/supabaseClient";

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

    return authData;
  }
}