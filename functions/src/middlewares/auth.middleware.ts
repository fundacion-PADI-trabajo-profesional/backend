import { Request, Response, NextFunction } from "express";
import { getSupabase } from "../config/supabaseClient";
import { getPrisma } from "../config/prismaClient";

export interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        email: string;
        rol: string;
        nombre: string;
        apellido: string;
        escuela_id?: string;
    };
}

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

        const profile = await (prisma as any).usuarioPerfil.findUnique({
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

        req.user = profile;
        next();
    } catch (err) {
        console.error("Error en middleware de autenticación:", err);
        return res.status(500).json({ message: "Error interno de autenticación." });
    }
}

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