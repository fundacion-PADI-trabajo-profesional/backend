import { EncargadoRepository } from "../repositories/encargado-zona.repository";
import { AuthService } from "./auth.service";
// import { EmailService } from "./email.service"; // <-- Esto crearíamos después para el mail real

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

        // 1. Generar contraseña aleatoria de 8 caracteres
        const generatedPassword = Math.random().toString(36).slice(-8) + "Aa1!";
        // (Le agrego "Aa1!" al final para cumplir requisitos de complejidad de Supabase si los tenés activados)

        console.log("----------------------------------------------------");
        console.log(`📧 SIMULANDO ENVÍO DE EMAIL A: ${data.email}`);
        console.log(`📍 ZONA ASIGNADA: ${data.zona}`);
        console.log(`🔑 CONTRASEÑA GENERADA: ${generatedPassword}`);
        console.log("----------------------------------------------------");

        // 2. Crear usuario en Auth y BD usando la password generada
        const result = await AuthService.register({
            email: data.email,
            password: generatedPassword,
            nombre: data.nombre,
            apellido: data.apellido,
            rol: "encargado_zona",
            zona: data.zona,
        });

        // 3. Aquí llamaríamos al servicio de email real
        // await EmailService.sendWelcomeEmail(data.email, data.nombre, generatedPassword);

        return { ...result, tempPassword: generatedPassword }; // Devolvemos la pass por si querés mostrarla en pantalla al admin (opcional)
    }

    async update(id: string, data: { nombre: string; apellido: string; email: string; zona_id: string }) {
        return await EncargadoRepository.update(id, {
            nombre: data.nombre,
            apellido: data.apellido,
            zona_id: data.zona_id
        });
    }

    async getCurrentEncargado(userId: string) {
        return await EncargadoRepository.getByUserId(userId);
    }

    async delete(id: string) {
        return await EncargadoRepository.delete(id);
    }
}