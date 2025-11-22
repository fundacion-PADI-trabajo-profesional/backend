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

  /*
   * Registra usuario completo: Auth + UsuarioPerfil + (Persona o Encargado según rol)
   */
  static async register(userData: {
    email: string;
    password: string;
    nombre: string;
    apellido: string;
    rol: string;
    zona?: string; // <--- 1. Agregamos el parámetro opcional ZONA
  }) {
    const supabase = getSupabase();
    const prisma = getPrisma();

    if (!supabase || !prisma) throw new Error("Clientes de DB no disponibles.");

    // ---------------------------------------------------------
    // PASO 1: Crear la CUENTA (Supabase Auth)
    // ---------------------------------------------------------
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: userData.email,
      password: userData.password,
    });

    if (authError) throw new Error(authError.message);
    if (!authData.user) throw new Error("Error crítico al crear usuario en Auth.");

    const userId = authData.user.id;

    try {
      // ---------------------------------------------------------
      // PASO 2: Crear el PERFIL BÁSICO (Tabla 'usuarios')
      // ---------------------------------------------------------
      const { error: profileError } = await supabase.from("usuarios").insert({
        id: userId,
        email: userData.email,
        nombre: userData.nombre,
        apellido: userData.apellido,
        rol: userData.rol,
      });

      if (profileError) throw new Error(`Error en perfil: ${profileError.message}`);

      // ---------------------------------------------------------
      // PASO 3: LÓGICA SEGÚN ROL
      // ---------------------------------------------------------

      // --- CASO A: ENCARGADO DE ZONA ---
      if (userData.rol === "encargado_zona") {
        await (prisma as any).encargados.create({
          data: {
            usuario_id: userId, // Vinculamos con la cuenta creada
            zona: userData.zona || "A definir" // Guardamos la zona que vino del front
          }
        });
      }

      // --- CASO B: DOCENTE (Opcionalmente Directivos) ---
      else if (userData.rol === "docente") {

        // 1. Crear la Persona (Entidad Humana) vinculada al Usuario
        const nuevaPersona = await (prisma as any).personas.create({
          data: {
            usuario_id: userId, // Vinculamos Persona con Usuario
            nombre: userData.nombre,
            primer_apellido: userData.apellido,

          }
        });

        // 2. Crear el registro Profesional (Profesor) vinculado a la Persona
        await (prisma as any).profesores.create({
          data: {
            id: userId, // Mantenemos ID consistente si es útil para tu lógica vieja
            persona_id: nuevaPersona.id // Vinculamos con la persona física
          }
        });
      }

      // --- CASO C: EQUIPO PADI ---
      // No hace nada extra, solo queda en la tabla 'usuarios'.

    } catch (error: any) {
      // ---------------------------------------------------------
      // ROLLBACK (Limpieza en caso de error)
      // ---------------------------------------------------------
      console.error("🛑 Error en registro, deshaciendo cambios:", error.message);

      // 1. Borrar usuario de Auth (lo más importante para que no queden zombies)
      await supabase.auth.admin.deleteUser(userId);

      // 2. Intentar borrar el perfil de usuario si se creó
      try { await (supabase as any).from("usuarios").delete().eq("id", userId); } catch { }

      throw new Error(`No se pudo completar el registro: ${error.message}`);
    }

    return authData;
  }
}