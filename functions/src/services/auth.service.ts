import { getSupabase } from "../config/supabaseClient";
import { withRLSContext } from "../config/prismaClient";

const UNIQUE_VIOLATION = "23505";
const PRISMA_ERROR = "P2002";

/**
 * Traduce los códigos de error de Supabase Auth a mensajes legibles en español.
 *
 * @param error - Objeto de error retornado por Supabase Auth.
 * @returns Mensaje descriptivo para mostrar al usuario.
 */
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

/**
 * Servicio de autenticación y gestión de sesiones.
 *
 * @remarks
 * Todos los métodos son estáticos. Interactúa con Supabase Auth para las
 * operaciones de sesión y con Prisma para la gestión del perfil de usuario.
 * Los errores de Supabase Auth se traducen a mensajes en español con `traducirErrorAuth`.
 */
export class AuthService {
  /**
   * Autentica a un usuario contra Supabase Auth y retorna sesión + perfil.
   *
   * @remarks
   * Además de validar las credenciales, consulta el perfil del usuario en la
   * tabla `usuarios` de Supabase. Si el usuario existe en Auth pero no tiene
   * perfil de aplicación, lanza un error (estado inconsistente).
   *
   * @param email - Correo electrónico del usuario.
   * @param password - Contraseña del usuario.
   * @returns `{ user, session, profile }` donde `profile` incluye escuela anidada.
   * @throws Error con mensaje traducido si las credenciales son inválidas o el perfil no existe.
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

  /**
   * Registra un usuario completo: cuenta en Supabase Auth + perfil + datos según rol.
   *
   * @remarks
   * Flujo de creación:
   * 1. Crea la cuenta en Supabase Auth (`signUp`).
   * 2. Crea el perfil en la tabla `usuarios`.
   * 3. Según el rol:
   *    - `"encargado_zona"`: crea registro en `encargados`.
   *    - `"docente"`: crea `personas` + `profesores`.
   *    - `"equipo_padi"`: sin datos adicionales.
   *
   * En caso de error en cualquier paso, realiza rollback eliminando el usuario
   * de Auth y el perfil de `usuarios` si ya fue creado.
   *
   * @param userData - Datos del nuevo usuario.
   * @returns El objeto `authData` de Supabase con `user` y `session`.
   * @throws Error con mensaje descriptivo si algún paso falla.
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

    if (!supabase) throw new Error("Clientes de DB no disponibles.");

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
        await withRLSContext(async (tx) => {
          await tx.encargados.create({
            data: {
              usuario_id: userId,
              zona_id: userData.zona || "A definir",
            },
          });
        });
      }

      // --- CASO B: DOCENTE (Opcionalmente Directivos) ---
      else if (userData.rol === "docente") {
        await withRLSContext(async (tx) => {
          // 1. Crear la Persona (Entidad Humana) vinculada al Usuario
          const nuevaPersona = await tx.personas.create({
            data: {
              usuario_id: userId,
              nombre: userData.nombre,
              primer_apellido: userData.apellido,
            },
          });

          // 2. Crear el registro Profesional (Profesor) vinculado a la Persona
          await tx.profesores.create({
            data: {
              id: userId,
              persona_id: nuevaPersona.id,
            },
          });
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
   * Renueva la sesión usando un `refresh_token`.
   *
   * @param refreshToken - Token de refresco emitido por Supabase en el login anterior.
   * @returns `{ access_token, refresh_token }` con los nuevos tokens.
   * @throws Error si el token es inválido o la sesión no pudo renovarse.
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
   * Actualiza el nombre y apellido del perfil del usuario autenticado.
   *
   * @remarks
   * Actualiza `usuarioPerfil` y, si existe, el registro correspondiente en `personas`.
   * El error de `personas.update` se ignora silenciosamente para no bloquear
   * usuarios cuyo rol no genera registro en esa tabla (p. ej. `equipo_padi`).
   *
   * @param userId - UUID del usuario a actualizar.
   * @param nombre - Nuevo nombre.
   * @param apellido - Nuevo apellido.
   * @returns El registro de `usuarioPerfil` actualizado.
   * @throws Error si el cliente Prisma no está disponible o si la actualización falla.
   */
  static async updateProfile(userId: string, nombre: string, apellido: string) {
    try {
      return await withRLSContext(async (tx) => {
        const updatedUser = await tx.usuarioPerfil.update({
          where: { id: userId },
          data: { nombre, apellido },
        });

        try {
          await tx.personas.update({
            where: { usuario_id: userId },
            data: {
              nombre: nombre,
              primer_apellido: apellido,
            },
          });
        } catch (e) { }

        return updatedUser;
      });
    } catch (error) {
      console.error("Error al actualizar perfil:", error);
      throw new Error("No se pudo actualizar el perfil.");
    }
  }

  /**
   * Envía un correo con el link seguro para cambiar la contraseña.
   *
   * @remarks
   * Verifica primero que el email exista en la tabla `usuarios` antes de llamar
   * a Supabase. Si no existe, lanza `"EMAIL_NOT_REGISTERED"` para que el
   * controlador pueda responder con un mensaje apropiado sin revelar si el email
   * está o no registrado.
   * El link redirige a `FRONTEND_URL/actualizar-password`.
   *
   * @param email - Dirección de correo del usuario.
   * @returns Objeto con mensaje de confirmación.
   * @throws `"EMAIL_NOT_REGISTERED"` si el email no existe en el sistema.
   * @throws Error si el envío por Supabase falla.
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
   * Actualiza la contraseña del usuario usando los tokens del link de recuperación.
   *
   * @remarks
   * Establece la sesión con los tokens del link (`setSession`), actualiza la
   * contraseña y luego cierra la sesión temporal del backend para no dejar
   * estado residual en el servidor.
   *
   * @param accessToken - Token de acceso del link de recuperación.
   * @param refreshToken - Token de refresco del link de recuperación.
   * @param newPassword - Nueva contraseña del usuario.
   * @returns Objeto con mensaje de confirmación.
   * @throws Error si el link expiró, es inválido o si la actualización falla.
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
