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
/**
 * Qué pasó al reenviar una invitación: se mandó, la cuenta ya estaba activa, o el perfil quedó
 * sin cuenta en Auth (resto de una baja incompleta) y no corresponde invitar.
 */
export type ResultadoReenvio = "enviada" | "ya_activa" | "sin_cuenta";

/** Supabase Auth no encuentra la cuenta: ya fue dada de baja o nunca llegó a crearse. */
function esErrorNotFound(error: any): boolean {
  return (
    error?.status === 404 ||
    error?.code === "user_not_found" ||
    String(error?.message ?? "").toLowerCase().includes("not found")
  );
}

/**
 * Elimina el perfil de aplicación de un usuario dejando la base consistente, en una sola
 * transacción: cierra sus asignaciones activas como docente (escuelas y aulas), desvincula su
 * persona, quita su registro de encargado y borra la fila de `usuarios`. `personas`, `profesores`
 * y las evaluaciones se conservan como histórico. Idempotente: si no hay nada que borrar, no falla.
 */
async function eliminarPerfil(userId: string): Promise<void> {
  const ahora = new Date();
  await withRLSContextAsAdmin(async (tx) => {
    await tx.profesoresEscuelas.updateMany({
      where: { profesor_id: userId, fecha_fin: null },
      data: { fecha_fin: ahora },
    });
    await tx.profesoresAulas.updateMany({
      where: { profesor_id: userId, fecha_fin: null },
      data: { fecha_fin: ahora },
    });
    await tx.personas.updateMany({ where: { usuario_id: userId }, data: { usuario_id: null } });
    await tx.encargados.deleteMany({ where: { usuario_id: userId } });
    await tx.usuarioPerfil.deleteMany({ where: { id: userId } });
  });
}

/**
 * Si existe un perfil en `usuarios` con ese mail cuya cuenta de Auth ya no existe (resto de una
 * baja incompleta), lo elimina y devuelve `true`. Si la cuenta existe o no se puede verificar,
 * no toca nada y devuelve `false`.
 */
async function limpiarPerfilHuerfano(
  supabase: NonNullable<ReturnType<typeof getSupabase>>,
  email: string
): Promise<boolean> {
  const { data: perfil } = await (supabase as any)
    .from("usuarios")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (!perfil?.id) return false;

  const { data: authUser, error } = await supabase.auth.admin.getUserById(perfil.id);
  if (authUser?.user) return false;
  if (error && !esErrorNotFound(error)) return false;

  await eliminarPerfil(perfil.id);
  return true;
}

/**
 * Reenvía el mail de invitación de Supabase a un usuario que todavía no activó su
 * cuenta. Lo usan el panel de PADI (`AdminService.resendInvite`, por id) y el
 * autoservicio público (`AuthService.reenviarInvitacionPorEmail`, por correo).
 * El link que llega vence según "Email OTP expiration" del proyecto (tope 24 h).
 */
export async function reenviarInvitacion(
  supabase: NonNullable<ReturnType<typeof getSupabase>>,
  perfil: { id: string; email: string; nombre: string; apellido: string; rol: string }
): Promise<ResultadoReenvio> {
  const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(perfil.id);
  if (authError && !esErrorNotFound(authError)) {
    throw new Error(`No se pudo verificar la cuenta de acceso: ${authError.message}`);
  }
  // Perfil sin cuenta en Auth (resto de una baja incompleta): invitar acá crearía una cuenta con
  // otro id, que nunca podría loguearse ("Perfil de usuario no encontrado").
  if (!authUser?.user) return "sin_cuenta";
  if (authUser.user.last_sign_in_at) return "ya_activa";

  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const { error } = await supabase.auth.admin.inviteUserByEmail(perfil.email, {
    redirectTo: `${frontendUrl}/cambiar-contrasena-temporal`,
    data: { nombre: perfil.nombre, apellido: perfil.apellido, rol: perfil.rol },
  });

  if (error) {
    if (error.message.toLowerCase().includes("rate limit")) {
      throw new Error("Se realizaron demasiados intentos de envío. Esperá unos minutos antes de volver a intentarlo.");
    }
    throw new Error(`Error al reenviar invitación: ${error.message}`);
  }
  return "enviada";
}

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
    const insertarPerfil = () =>
      (supabase as any).from("usuarios").insert({
        id: userId,
        email: data.email,
        nombre: data.nombre.trim(),
        apellido: data.apellido.trim(),
        rol: data.rol,
      });

    let { error: profileError } = await insertarPerfil();
    if (profileError?.code === "23505") {
      // Auth aceptó el mail, así que el perfil que choca no tiene cuenta: es el resto de una
      // baja incompleta. Se limpia y se reintenta el alta.
      if (await limpiarPerfilHuerfano(supabase, data.email)) {
        ({ error: profileError } = await insertarPerfil());
      }
    }

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

    const resultado = await reenviarInvitacion(supabase, { id: userId, ...profile });
    if (resultado === "ya_activa") {
      throw new Error("El usuario ya activó su cuenta. No es necesario reenviar la invitación.");
    }
    if (resultado === "sin_cuenta") {
      throw new Error(
        "Este usuario quedó sin cuenta de acceso (baja incompleta). Eliminalo y volvé a crearlo."
      );
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

    return withRLSContext(async (tx) => {
      const usuario = await tx.usuarioPerfil.findUnique({ where: { id: targetUserId } });
      if (!usuario) throw new Error("Usuario no encontrado.");

      // Si el rol no cambia, no hay nada que migrar.
      if (usuario.rol === newRol) {
        return { id: targetUserId, rol: newRol };
      }

      // 1) Limpiar el alcance del rol viejo (soft-delete; NUNCA hard-delete).
      //    Las asignaciones no se conservan: se reasignan manualmente luego.
      if (usuario.rol === "director") {
        await tx.usuarioPerfil.update({
          where: { id: targetUserId },
          data: { escuela_id: null },
        });
      } else if (usuario.rol === "docente") {
        const ahora = new Date();
        // Cierra (no borra) las asignaciones activas: preserva histórico y evaluaciones.
        await tx.profesoresEscuelas.updateMany({
          where: { profesor_id: targetUserId, fecha_fin: null },
          data: { fecha_fin: ahora },
        });
        await tx.profesoresAulas.updateMany({
          where: { profesor_id: targetUserId, fecha_fin: null },
          data: { fecha_fin: ahora },
        });
      } else if (usuario.rol === "encargado_zona") {
        await tx.encargados.updateMany({
          where: { usuario_id: targetUserId },
          data: { zona_id: null },
        });
      }

      // 2) Provisionar la entidad del rol nuevo (idempotente).
      if (newRol === "docente") {
        const profesorExistente = await tx.profesores.findUnique({ where: { id: targetUserId } });
        if (!profesorExistente) {
          let persona = await tx.personas.findFirst({ where: { usuario_id: targetUserId } });
          if (!persona) {
            persona = await tx.personas.create({
              data: {
                usuario_id: targetUserId,
                nombre: usuario.nombre,
                primer_apellido: usuario.apellido,
              },
            });
          }
          // profesores.id == usuario.id por convención del sistema.
          await tx.profesores.create({
            data: { id: targetUserId, persona_id: persona.id },
          });
        }
      } else if (newRol === "encargado_zona") {
        const encargadoExistente = await tx.encargados.findUnique({ where: { usuario_id: targetUserId } });
        if (!encargadoExistente) {
          await tx.encargados.create({ data: { usuario_id: targetUserId } });
        }
      }

      // 3) Cambiar el rol.
      await tx.usuarioPerfil.update({
        where: { id: targetUserId },
        data: { rol: newRol as RolValido },
      });

      return { id: targetUserId, rol: newRol };
    });
  }

  /**
   * Da de baja a un usuario preservando su historial.
   *
   * @remarks
   * 1. Revoca el acceso en Supabase Auth (si la cuenta ya no existe, continúa: la baja es repetible).
   * 2. En una sola transacción cierra sus asignaciones activas como docente, desvincula su
   *    persona, quita su registro de encargado y borra el perfil de `usuarios`.
   *    `personas`, `profesores` y las evaluaciones se conservan como histórico.
   *
   * Si el paso 2 falla, lanza error: el panel no debe reportar "eliminado" con el perfil todavía
   * presente (un perfil sin cuenta de Auth bloquea el re-alta con el mismo mail y, si alguien le
   * reenvía la invitación, termina con una cuenta de Auth que no puede loguearse).
   *
   * @param userId - UUID del usuario a dar de baja.
   * @throws Error si Supabase Auth no puede revocar el acceso o si el perfil no se pudo eliminar.
   */
  static async deleteUser(userId: string): Promise<void> {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Cliente de Supabase no disponible.");

    const { error: authError } = await supabase.auth.admin.deleteUser(userId);
    if (authError && !esErrorNotFound(authError)) {
      throw new Error(`Error al revocar acceso de autenticación: ${authError.message}`);
    }

    try {
      await eliminarPerfil(userId);
    } catch (error: any) {
      console.error("deleteUser: acceso revocado pero el perfil no se pudo eliminar:", error?.message);
      throw new Error(
        `El acceso fue revocado pero no se pudo eliminar el perfil (${error?.message}). Volvé a intentar la eliminación.`
      );
    }
  }
}
