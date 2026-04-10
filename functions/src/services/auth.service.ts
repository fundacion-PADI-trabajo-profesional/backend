import { getSupabase } from "../config/supabaseClient";
import { getPrisma } from "../config/prismaClient";

const UNIQUE_VIOLATION = "23505";
const PRISMA_ERROR = "P2002";
const traducirErrorAuth = (error: any): string => {
  // Verificamos si el error trae un código de Supabase Auth
  if (error?.code) {
    switch (error.code) {
      case 'user_already_exists':
        return 'Este correo electrónico ya se encuentra registrado.';
      case 'weak_password':
        return 'La contraseña es muy débil. Debe tener al menos 6 caracteres.';
      case 'invalid_credentials':
        return 'El correo electrónico o la contraseña son incorrectos.';
      case 'email_not_confirmed':
        return 'Debes confirmar tu correo electrónico antes de ingresar.';
      case 'over_email_send_rate_limit':
        return 'Demasiados intentos. Por favor, esperá un momento y volvé a intentar.';
      case 'validation_failed':
        return 'Los datos ingresados no son válidos. Revisá el formato del correo.';
      default:
        return `Ocurrió un error de autenticación (Código: ${error.code}).`;
    }
  }

  // Fallback genérico por si el error no viene de Auth o no tiene código
  return "Ocurrió un error inesperado al procesar la solicitud.";
};

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

    if (error) throw new Error(traducirErrorAuth(error));
    if (error || !data?.user) throw new Error("Credenciales inválidas");

    // Obtener perfil desde public.usuarios (debe existir para considerar el login válido)
    const { data: profileData, error: profileError } = await (supabase as any)
      .from("usuarios")
      .select("*, escuela:escuelas(id, nombre)")
      .eq("id", data.user.id)
      .single();

    if (profileError || !profileData) {
      // Usuario existe en Auth pero no tiene perfil de aplicación => estado inconsistente
      // Lo tratamos como error de autenticación lógica.
      throw new Error("Perfil de usuario no encontrado. Por favor, contactá al administrador.");
    }

    const profile = profileData;

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
    zona?: string;
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

    if (authError) throw new Error(traducirErrorAuth(authError));
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

      if (profileError) {
        if (profileError.code === UNIQUE_VIOLATION) throw new Error("Ya existe un perfil con este correo.");
        throw new Error(`No se pudo guardar el perfil (Código DB: ${profileError.code}).`);
      }

      // ---------------------------------------------------------
      // PASO 3: LÓGICA SEGÚN ROL
      // ---------------------------------------------------------

      // --- CASO A: ENCARGADO DE ZONA ---
      if (userData.rol === "encargado_zona") {
        await (prisma as any).encargados.create({
          data: {
            usuario_id: userId, // Vinculamos con la cuenta creada
            zona_id: userData.zona || "A definir" // Guardamos la zona que vino del front
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

      let message = error.message;

      // Si el error es de Prisma (empieza con P) o es un error de código crudo
      if (error.code?.startsWith('P') || error.message.includes('invocation in')) {
        if (error.code === PRISMA_ERROR) {
          message = "Ya existe un registro con estos datos.";
        } else {
          // Ocultamos el error real al cliente, pero ya quedó en el console.error del backend
          message = "Ocurrió un error interno al guardar los datos. Por favor, intentá de nuevo.";
        }
      }

      throw new Error(message);
    }

    return authData;
  }

  /**
   * Renueva la sesión usando un refresh_token.
   * Retorna los nuevos access_token y refresh_token.
   */
  static async refreshSession(refreshToken: string) {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase client no está disponible.");

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data.session) {
      throw new Error("No se pudo renovar la sesión. Por favor, iniciá sesión nuevamente.");
    }

    return {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    };
  }

  /**
   * Actualiza el nombre y apellido del perfil.
   */
  static async updateProfile(userId: string, nombre: string, apellido: string) {
    const prisma = getPrisma();
    if (!prisma) throw new Error("Cliente de DB no disponible.");

    try {
      const updatedUser = await (prisma as any).usuarioPerfil.update({
        where: { id: userId },
        data: { nombre, apellido }
      });

      try {
        await (prisma as any).personas.update({
          where: { usuario_id: userId },
          data: {
            nombre: nombre,
            primer_apellido: apellido
          }
        });
      } catch (e) { }

      return updatedUser;
    } catch (error) {
      console.error("Error al actualizar perfil:", error);
      throw new Error("No se pudo actualizar el perfil.");
    }
  }

  /**
   * Envía un correo con el link seguro para cambiar la contraseña.
   * Verifica primero que el email esté registrado en el sistema.
   */
  static async sendPasswordResetEmail(email: string) {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase client no está disponible.");

    // Verificar si el email existe en la tabla de usuarios de la aplicación
    const { data: existingUser } = await (supabase as any)
      .from("usuarios")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (!existingUser) {
      throw new Error("EMAIL_NOT_REGISTERED");
    }

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${frontendUrl}/actualizar-password`,
    });

    if (error) throw new Error(traducirErrorAuth(error));

    return { message: "Correo de recuperación enviado exitosamente." };
  }

  /**
   * Actualiza la contraseña usando los tokens provistos por el link del correo.
   */
  static async updatePassword(accessToken: string, refreshToken: string, newPassword: string) {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase client no está disponible.");

    // 1. Establecemos la sesión con los tokens que vinieron en el link
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (sessionError) throw new Error("El link de recuperación es inválido o ya expiró.");

    // 2. Actualizamos la contraseña del usuario
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    // 3. Cerramos esta sesión temporal del backend para limpiar el estado
    await supabase.auth.signOut();

    if (updateError) throw new Error(traducirErrorAuth(updateError));

    return { message: "Contraseña actualizada exitosamente." };
  }

}
