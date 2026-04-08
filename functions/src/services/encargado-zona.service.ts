import { EncargadoRepository } from "../repositories/encargado-zona.repository";
import { AuthService } from "./auth.service";
// import { EmailService } from "./email.service"; // <-- Para el mail real

export class EncargadosService {

    async list(user: { id: string; rol: string }) {
        if (user.rol === "equipo_padi") {
            return await EncargadoRepository.list();
        }
        throw new Error("No tienes permisos para ver Encargados de Zona.");
    }

    async create(data: {
        email: string;
        nombre: string;
        apellido: string;
        zona: string;
    }, user: { id: string; rol: string }) {

        // Solo equipo_padi puede crear encargados de zona
        if (user.rol !== "equipo_padi") {
            throw new Error("Solo el equipo PADI puede crear encargados de zona.");
        }

        // Generar contraseña aleatoria
        const generatedPassword = Math.random().toString(36).slice(-8) + "Aa1!";

        console.log("----------------------------------------------------");
        console.log(`📧 SIMULANDO ENVÍO DE EMAIL A: ${data.email}`);
        console.log(`📍 ZONA ASIGNADA: ${data.zona}`);
        console.log(`🔑 CONTRASEÑA GENERADA: ${generatedPassword}`);
        console.log("----------------------------------------------------");

        const result = await AuthService.register({
            email: data.email,
            password: generatedPassword,
            nombre: data.nombre,
            apellido: data.apellido,
            rol: "encargado_zona",
            zona: data.zona,
        });

        // await EmailService.sendWelcomeEmail(data.email, data.nombre, generatedPassword);

        return { ...result, tempPassword: generatedPassword };
    }

    async update(id: string, data: { nombre: string; apellido: string; email: string; zona_id: string }, user: { id: string; rol: string }) {
        if (user.rol !== "equipo_padi") {
            throw new Error("Solo el equipo PADI puede modificar encargados de zona.");
        }
        return await EncargadoRepository.update(id, {
            nombre: data.nombre,
            apellido: data.apellido,
            zona_id: data.zona_id
        });
    }

    async getCurrentEncargado(userId: string) {
        return await EncargadoRepository.getByUserId(userId);
    }

    async delete(id: string, user: { id: string; rol: string }) {
        if (user.rol !== "equipo_padi") {
            throw new Error("Solo el equipo PADI puede eliminar encargados de zona.");
        }
        return await EncargadoRepository.delete(id);
    }
}
