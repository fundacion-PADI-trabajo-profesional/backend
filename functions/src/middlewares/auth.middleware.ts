import { Request, Response, NextFunction } from "express";
import { getSupabase } from "../config/supabaseClient";
import { getPrisma } from "../config/prismaClient";
import { rlsContext } from "../config/rlsContext";

/**
 * Extensión de Express `Request` que incluye el perfil del usuario autenticado.
 *
 * @remarks
 * Populado por `requireAuth` tras validar el token JWT con Supabase y
 * consultar el perfil en la tabla `usuarioPerfil` de la base de datos.
 * Los endpoints protegidos deben tipificar su parámetro `req` con esta
 * interfaz para acceder a `req.user` sin errores de TypeScript.
 */
export interface AuthenticatedRequest extends Request {
    /**
     * Perfil del usuario autenticado. Definido si el middleware `requireAuth`
     * se ejecutó correctamente; `undefined` si la ruta no está protegida.
     */
    user?: {
        /** UUID del usuario en Supabase Auth y en la tabla `usuarioPerfil`. */
        id: string;
        /** Dirección de correo electrónico del usuario. */
        email: string;
        /** Rol del usuario: `"admin"`, `"director"`, `"docente"` o `"encargado_zona"`. */
        rol: string;
        /** Nombre de pila del usuario. */
        nombre: string;
        /** Apellido del usuario. */
        apellido: string;
        /**
         * UUID de la escuela a la que pertenece el usuario.
         * Solo presente para roles `"director"` y `"docente"`.
         */
        escuela_id?: string;
    };
}

/**
 * Middleware de autenticación. Valida el token Bearer y adjunta el perfil
 * del usuario a `req.user`.
 *
 * @remarks
 * Flujo de validación:
 * 1. Extrae el token del header `Authorization: Bearer <token>`.
 * 2. Valida el token con `supabase.auth.getUser(token)`.
 * 3. Consulta el perfil del usuario en `usuarioPerfil` vía Prisma.
 * 4. Adjunta el perfil a `req.user` y llama a `next()`.
 *
 * Responde con `401` si el token falta o es inválido, `403` si el perfil
 * no existe, y `500` ante errores internos.
 *
 * @param req - Request entrante.
 * @param res - Response de Express.
 * @param next - Función para pasar al siguiente middleware o controlador.
 */
export async function requireAuth(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ message: "Token de autenticación requerido." });
        }

        const token = authHeader.split(" ")[1];
        const supabase = getSupabase();

        if (!supabase) {
            return res.status(500).json({ message: "Error interno del servidor." });
        }

        const {
            data: { user },
            error,
        } = await supabase.auth.getUser(token);

        if (error || !user) {
            return res.status(401).json({ message: "Token inválido o expirado." });
        }

        const prisma = getPrisma();
        if (!prisma) {
            return res.status(500).json({ message: "Error interno del servidor." });
        }

        const profile = await prisma.usuarioPerfil.findUnique({
            where: { id: user.id },
            select: {
                id: true,
                email: true,
                rol: true,
                nombre: true,
                apellido: true,
                escuela_id: true,
            },
        });

        if (!profile) {
            return res.status(403).json({ message: "Perfil de usuario no encontrado." });
        }

        req.user = { ...profile, escuela_id: profile.escuela_id ?? undefined };
        rlsContext.run(
          { sub: user.id, email: profile.email, role: 'authenticated' },
          () => next()
        );
    } catch (err) {
        console.error("Error en middleware de autenticación:", err);
        return res.status(500).json({ message: "Error interno de autenticación." });
    }
}

/**
 * Factory de middleware de autorización por rol.
 *
 * @remarks
 * Debe usarse **después** de `requireAuth` en la cadena de middlewares,
 * ya que depende de que `req.user` esté definido.
 *
 * @example
 * ```typescript
 * router.post("/zonas", requireAuth, requireRole("admin"), createZona);
 * router.get("/aulas", requireAuth, requireRole("admin", "director"), getAulas);
 * ```
 *
 * @param allowedRoles - Uno o más roles que tienen permiso para acceder al endpoint.
 * @returns Middleware de Express que responde `401` si el usuario no está autenticado
 *          o `403` si su rol no está en la lista de roles permitidos.
 */
export function requireRole(...allowedRoles: string[]) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ message: "No autenticado." });
        }

        if (!allowedRoles.includes(req.user.rol)) {
            return res.status(403).json({
                message: "No tenés permisos para realizar esta acción.",
            });
        }

        next();
    };
}