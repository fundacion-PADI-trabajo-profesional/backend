import { EncargadoRepository } from "../repositories/encargado-zona.repository";
import { AuthService } from "./auth.service";
// import { EmailService } from "./email.service"; // <-- Esto crearíamos después para el mail real

export class EncargadosService {

    async list() {
        return await EncargadoRepository.list();
    }

    async create(data: {
        email: string;
        nombre: string;
        apellido: string;
        // password: ya no viene del front obligatoriamente
    }) {

        // 1. Generar contraseña aleatoria de 8 caracteres
        const generatedPassword = Math.random().toString(36).slice(-8) + "Aa1!";
        // (Le agrego "Aa1!" al final para cumplir requisitos de complejidad de Supabase si los tenés activados)

        console.log("----------------------------------------------------");
        console.log(`📧 SIMULANDO ENVÍO DE EMAIL A: ${data.email}`);
        console.log(`🔑 CONTRASEÑA GENERADA: ${generatedPassword}`);
        console.log("----------------------------------------------------");

        // 2. Crear usuario en Auth y BD usando la password generada
        const result = await AuthService.register({
            email: data.email,
            password: generatedPassword,
            nombre: data.nombre,
            apellido: data.apellido,
            rol: "encargado_zona",
        });

        // 3. Aquí llamaríamos al servicio de email real
        // await EmailService.sendWelcomeEmail(data.email, data.nombre, generatedPassword);

        return { ...result, tempPassword: generatedPassword }; // Devolvemos la pass por si querés mostrarla en pantalla al admin (opcional)
    }
}