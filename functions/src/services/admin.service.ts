import { withRLSContext, withRLSContextAsAdmin } from "../config/prismaClient";
import { getSupabase } from "../config/supabaseClient";

const ROLES_VALIDOS = ["equipo_padi", "director", "encargado_zona", "docente"] as const;
/** Unión de los roles válidos del sistema. */
type RolValido = typeof ROLES_VALIDOS[number];

/** Datos requeridos para crear un usuario desde el panel de administración. */
export interface CreateUserData {
  /** Nombre de pila del usuario. */
  nombre: string;
  /** Apellido del usuario. */
  apellido: string;
  /** Dirección de correo electrónico (debe ser única). */
  email: string;
  /** Rol a asignar al usuario en el sistema. */
  rol: RolValido;
  /**
   * ID de escuela del solicitante. Si se provee y el rol a crear es `"docente"`,
   * el docente queda asignado automáticamente a esa escuela.
   */
  escuela_id?: string;
}

/** Resultado de una operación de creación masiva de usuarios. */
export interface BulkCreateResult {
  /** Usuarios creados exitosamente con sus datos básicos. */
  creados: { email: string; nombre: string; apellido: string }[];
  /** Usuarios que fallaron con su email y motivo del error. */
  errores: { email: string; error: string }[];
}

/**
 * Servicio de administración de usuarios (exclusivo del rol `"equipo_padi"`).
 *
 * @remarks
 * Todos los métodos son estáticos. Utiliza la API de administración de Supabase Auth
 * (`supabase.auth.admin`) para invitar, eliminar y consultar usuarios. El flujo de
 * invitación crea primero la cuenta en Auth y luego el perfil en la tabla `usuarios`;
 * si el segundo paso falla, realiza rollback eliminando el usuario de Auth.
 */
export class AdminService {
  /**
   * Invita a un usuario nuevo al sistema desde el panel de administración.
   *
   * @remarks
   * Flujo:
   * 1. Valida los datos de entrada (nombre, apellido, email, rol).
   * 2. Llama a `inviteUserByEmail` de Supabase, que envía el email con el link de activación.
   * 3. Crea el perfil en las tablas `usuarios`, `personas` y la tabla que le corresponda para que esté disponible al aceptar la invitación.
   * 4. Si el perfil falla, elimina el usuario de Auth (rollback).
   *
   * @param data - Datos del usuario a invitar.
   * @returns `{ id, email }` del usuario creado.
   * @throws Error si el email ya existe, si los datos son inválidos o si algún paso falla.
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

    // Paso 3: Lógica específica de Prisma según el Rol
    // Usa withRLSContextAsAdmin para bypasear restricciones RLS de rol regular
    try {
      if (data.rol === "encargado_zona") {
        await withRLSContextAsAdmin(async (tx) => {
          await tx.encargados.create({
            data: { usuario_id: userId },
          });
        });
      } else if (data.rol === "docente") {
        await withRLSContextAsAdmin(async (tx) => {
          // 1. Crear Persona
          const nuevaPersona = await tx.personas.create({
            data: {
              usuario_id: userId,
              nombre: data.nombre.trim(),
              primer_apellido: data.apellido.trim(),
            },
          });

          // 2. Crear Profesor vinculado a la Persona
          await tx.profesores.create({
            data: {
              id: userId,
              persona_id: nuevaPersona.id,
            },
          });

          // 3. Si se provee escuela_id (ej: director creando desde su escuela),
          //    asignar el docente automáticamente a esa escuela.
          if (data.escuela_id) {
            await tx.profesoresEscuelas.create({
              data: {
                profesor_id: userId,
                escuela_id: data.escuela_id,
              },
            });
          }
        });
      }
    } catch (error: any) {
      // Rollback completo si falla Prisma
      console.error("Error en Prisma al crear entidades:", error.message);
      await AdminService.deleteUser(userId).catch(() => {});
      throw new Error("Ocurrió un error interno al guardar los datos específicos del rol.");
    }

    return { id: userId, email: data.email };
  }

  /**
   * Invita múltiples usuarios en lote (máximo 200 por llamada).
   *
   * @remarks
   * El proceso no se detiene si un usuario individual falla: los errores se
   * acumulan en `result.errores` y se continúa con el siguiente. Esto permite
   * importaciones parcialmente exitosas.
   *
   * @param users - Array de datos de usuarios a invitar.
   * @returns `{ creados, errores }` con los resultados de cada invitación.
   * @throws Error si el array está vacío o supera los 200 registros.
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
   * Lista todos los usuarios del sistema con su estado de activación.
   *
   * @remarks
   * Cruza dos fuentes de datos:
   * - **Supabase Auth** (`listUsers`): provee `last_sign_in_at` para determinar si activó la cuenta.
   * - **Tabla `usuarios`**: provee el perfil de aplicación (nombre, apellido, rol).
   *
   * El campo `estado` resultante es `"activo"` si el usuario ya inició sesión,
   * o `"pendiente"` si solo recibió la invitación.
   *
   * @returns Array de perfiles enriquecidos con el campo `estado`.
   * @throws Error si Supabase Auth o la tabla de perfiles no responden.
   */
  static async listUsers(page = 1, perPage = 50): Promise<any[]> {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase client no disponible.");

    // 1. Obtener usuarios de Auth paginados
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });

    if (authError) throw new Error(`Error al listar usuarios de Auth: ${authError.message}`);

    const authMap = new Map(authData.users.map((u) => [u.id, u]));

    // 2. Obtener los perfiles de la tabla 'usuarios'
    const { data: profiles, error: profileError } = await (supabase as any)
      .from("usuarios")
      .select("id, email, nombre, apellido, rol, createdAt")
      .order("createdAt", { ascending: false });

    if (profileError) throw new Error(`Error al obtener perfiles: ${profileError.message}`);

    // 3. Enriquecer cada perfil con el estado de activación
    return (profiles || []).map((p: any) => {
      const authUser = authMap.get(p.id);
      return {
        ...p,
        estado: authUser?.last_sign_in_at ? "activo" : "pendiente",
      };
    });
  }

  /**
   * Reenvía el email de invitación a un usuario que aún no activó su cuenta.
   *
   * @remarks
   * Verifica que el usuario exista y que su `last_sign_in_at` sea nulo antes de
   * reenviar. Si el usuario ya activó su cuenta, lanza un error descriptivo.
   *
   * @param userId - UUID del usuario al que reenviar la invitación.
   * @throws Error si el usuario no existe, ya activó su cuenta o si el reenvío falla.
   */
  static async resendInvite(userId: string): Promise<void> {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase client no disponible.");

    // Obtener el perfil del usuario
    const { data: profile, error: profileError } = await (supabase as any)
      .from("usuarios")
      .select("email, nombre, apellido, rol")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      throw new Error("Usuario no encontrado.");
    }

    // Verificar que el usuario esté realmente en estado pendiente
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId);
    if (authError || !authUser.user) {
      throw new Error("Este usuario no tiene cuenta activa en el sistema de autenticación. Eliminá el registro y creá el usuario nuevamente.");
    }
    if (authUser.user.last_sign_in_at) {
      throw new Error("El usuario ya activó su cuenta. No es necesario reenviar la invitación.");
    }

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const redirectTo = `${frontendUrl}/cambiar-contrasena-temporal`;

    // Re-invitar: Supabase reenvía el email si el usuario aún no confirmó
    const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(profile.email, {
      redirectTo,
      data: {
        nombre: profile.nombre,
        apellido: profile.apellido,
        rol: profile.rol,
      },
    });

    if (inviteError) {
      throw new Error(`Error al reenviar invitación: ${inviteError.message}`);
    }
  }

  /**
   * Cambia el rol de un usuario existente.
   *
   * @param targetUserId - UUID del usuario a modificar.
   * @param newRol - Nuevo rol a asignar.
   * @throws Error si el rol es inválido o el usuario no existe.
   */
  static async updateUserRol(targetUserId: string, newRol: string): Promise<{ id: string; rol: string }> {
    if (!ROLES_VALIDOS.includes(newRol as RolValido)) {
      throw new Error(`Rol inválido. Los valores permitidos son: ${ROLES_VALIDOS.join(", ")}.`);
    }

    await withRLSContext(async (tx) => {
      const usuario = await tx.usuarioPerfil.findUnique({ where: { id: targetUserId } });
      if (!usuario) throw new Error("Usuario no encontrado.");

      await tx.usuarioPerfil.update({
        where: { id: targetUserId },
        data: { rol: newRol as RolValido },
      });
    });

    return { id: targetUserId, rol: newRol };
  }

  /**
   * Revoca el acceso de un usuario al sistema preservando su historial.
   *
   * @remarks
   * En lugar de hacer un "Hard Delete" que podría romper o eliminar en cascada
   * las evaluaciones históricas del docente, hacemos una baja lógica/revocación.
   * Destruimos su cuenta en Supabase Auth (imposibilitando el login) y lo quitamos
   * de la tabla de visualización del panel, pero preservamos sus tablas core.
   *
   * @param userId - UUID del usuario a dar de baja.
   * @throws Error si Supabase Auth no puede eliminarlo.
   */
  static async deleteUser(userId: string): Promise<void> {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Cliente de Supabase no disponible.");

    // Eliminar de Supabase Auth (Destruye el acceso real al sistema inmediatamente)
    const { error: authError } = await supabase.auth.admin.deleteUser(userId);
    if (authError) {
      // Si el usuario no existe en Auth (registro fantasma por rollback parcial),
      // igual continuamos para limpiar el registro en la tabla usuarios.
      const isNotFound =
        authError.message?.toLowerCase().includes("not found") ||
        (authError as any).status === 404 ||
        (authError as any).code === "user_not_found";
      if (!isNotFound) {
        throw new Error(`Error al revocar acceso de autenticación: ${authError.message}`);
      }
    }

    // Eliminar el perfil en la tabla de aplicación 'usuarios'.
    const { error: profileError } = await (supabase as any)
      .from("usuarios")
      .delete()
      .eq("id", userId);

    if (profileError) {
      console.error(
        "El acceso fue revocado, pero el perfil visual se mantuvo por dependencias en la BD:", 
        profileError.message
      );
    }
  }
}
