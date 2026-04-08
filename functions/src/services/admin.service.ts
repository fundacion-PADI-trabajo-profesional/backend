import { getSupabase } from "../config/supabaseClient";

const ROLES_VALIDOS = ["equipo_padi", "directivo", "encargado_zona", "docente"] as const;
type RolValido = typeof ROLES_VALIDOS[number];

export interface CreateUserData {
  nombre: string;
  apellido: string;
  email: string;
  rol: RolValido;
}

export interface BulkCreateResult {
  creados: { email: string; nombre: string; apellido: string }[];
  errores: { email: string; error: string }[];
}

export class AdminService {
  /**
   * Invita a un usuario desde el panel ADMIN (equipo_padi).
   * - Llama a inviteUserByEmail de Supabase (usa el SMTP configurado en el proyecto)
   * - Crea el perfil en la tabla 'usuarios' para que esté listo cuando el usuario acepte
   * - El usuario recibirá un email con un link para establecer su contraseña
   */
  static async createUser(data: CreateUserData): Promise<{ id: string; email: string }> {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase client no disponible.");

    // Validaciones
    if (!data.nombre?.trim()) throw new Error("El nombre es obligatorio.");
    if (!data.apellido?.trim()) throw new Error("El apellido es obligatorio.");
    if (!data.email?.trim()) throw new Error("El email es obligatorio.");
    if (!ROLES_VALIDOS.includes(data.rol)) {
      throw new Error(`Rol inválido. Los roles permitidos son: ${ROLES_VALIDOS.join(", ")}`);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      throw new Error("El formato del email no es válido.");
    }

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const redirectTo = `${frontendUrl}/cambiar-contrasena-temporal`;

    // Paso 1: Invitar al usuario via Supabase (envía el email usando el SMTP del proyecto)
    const { data: authData, error: authError } = await supabase.auth.admin.inviteUserByEmail(
      data.email,
      {
        redirectTo,
        data: {
          nombre: data.nombre.trim(),
          apellido: data.apellido.trim(),
          rol: data.rol,
        },
      }
    );

    if (authError) {
      if (
        (authError as any).code === "email_exists" ||
        authError.message?.toLowerCase().includes("already registered")
      ) {
        throw new Error("Ya existe un usuario con ese correo electrónico.");
      }
      throw new Error(`Error al invitar al usuario: ${authError.message}`);
    }

    if (!authData.user) throw new Error("Error crítico al crear la invitación.");

    const userId = authData.user.id;

    // Paso 2: Crear el perfil en 'usuarios' para que esté disponible al aceptar la invitación
    const { error: profileError } = await (supabase as any)
      .from("usuarios")
      .insert({
        id: userId,
        email: data.email,
        nombre: data.nombre.trim(),
        apellido: data.apellido.trim(),
        rol: data.rol,
      });

    if (profileError) {
      // Rollback: borrar el usuario de Auth si no se pudo crear el perfil
      await supabase.auth.admin.deleteUser(userId).catch(() => {});
      if (profileError.code === "23505") {
        throw new Error("Ya existe un perfil con ese correo electrónico.");
      }
      throw new Error(`Error al guardar el perfil: ${profileError.message}`);
    }

    return { id: userId, email: data.email };
  }

  /**
   * Invita múltiples usuarios en lote.
   * No detiene el proceso si un usuario falla — reporta éxitos y errores.
   */
  static async createUsersBulk(users: CreateUserData[]): Promise<BulkCreateResult> {
    const result: BulkCreateResult = { creados: [], errores: [] };

    if (!Array.isArray(users) || users.length === 0) {
      throw new Error("La lista de usuarios no puede estar vacía.");
    }

    if (users.length > 200) {
      throw new Error("No se pueden crear más de 200 usuarios a la vez.");
    }

    for (const user of users) {
      try {
        await AdminService.createUser(user);
        result.creados.push({
          email: user.email,
          nombre: user.nombre,
          apellido: user.apellido,
        });
      } catch (err: any) {
        result.errores.push({
          email: user.email || "(sin email)",
          error: err.message || "Error desconocido",
        });
      }
    }

    return result;
  }

  /**
   * Lista todos los usuarios del sistema (solo para equipo_padi).
   */
  static async listUsers(): Promise<any[]> {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase client no disponible.");

    const { data, error } = await (supabase as any)
      .from("usuarios")
      .select("id, email, nombre, apellido, rol, createdAt")
      .order("createdAt", { ascending: false });

    if (error) throw new Error(`Error al obtener usuarios: ${error.message}`);

    return data || [];
  }

  /**
   * Elimina un usuario del sistema (Auth + perfil).
   */
  static async deleteUser(userId: string): Promise<void> {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase client no disponible.");

    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) throw new Error(`Error al eliminar el usuario: ${error.message}`);

    // Borrar perfil por las dudas (cascada puede no estar configurada)
    await (supabase as any).from("usuarios").delete().eq("id", userId);
  }
}
