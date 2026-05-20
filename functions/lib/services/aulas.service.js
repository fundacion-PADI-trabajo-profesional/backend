"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AulasService = void 0;
const prismaClient_1 = require("../config/prismaClient");
const aula_repository_1 = require("../repositories/aula.repository");
const profesor_aula_repository_1 = require("../repositories/profesor-aula.repository");
const docente_repository_1 = require("../repositories/docente.repository");
/**
 * Servicio de gestión de aulas y sus asignaciones de docentes y estudiantes.
 *
 * @remarks
 * Centraliza toda la lógica de autorización por rol usando el helper privado
 * `getUserWithPermissions`, que resuelve el scope de escuelas permitidas para
 * cada tipo de usuario:
 * - `"equipo_padi"` (`padi`): acceso total a todas las escuelas.
 * - `"encargado_zona"` (`encargado`): solo escuelas de su zona.
 * - `"director"` (`director`): solo su escuela asignada.
 */
class AulasService {
    constructor() {
        this.repo = aula_repository_1.AulasRepository;
        this.profAulaRepo = profesor_aula_repository_1.ProfesoresAulasRepository;
        this.docenteRepo = docente_repository_1.DocenteRepository;
    }
    /**
     * Resuelve los permisos del usuario y el scope de escuelas accesibles.
     *
     * @param user - Usuario autenticado.
     * @returns Objeto con `prismaAny`, `userType`, `allowedEscuelas` y datos específicos del rol.
     * @throws Error si el rol no tiene acceso a la gestión de aulas.
     */
    async getUserWithPermissions(user) {
        const prisma = (0, prismaClient_1.getPrisma)();
        if (!prisma)
            throw new Error("DB no disponible para gestionar aulas");
        const prismaAny = prisma;
        // EQUIPO PADI: Acceso total a todas las escuelas
        if (user.rol === "equipo_padi") {
            return {
                prismaAny,
                userType: "padi",
                allowedEscuelas: "all",
                userId: user.id
            };
        }
        // ENCARGADO DE ZONA: Acceso a escuelas de su zona
        if (user.rol === "encargado_zona") {
            const encargado = await prismaAny.encargados.findUnique({
                where: { usuario_id: user.id },
                select: {
                    id: true,
                    zona: {
                        select: {
                            id: true,
                            nombre: true,
                            escuelas: { select: { id: true } }
                        }
                    }
                },
            });
            if (!encargado || !encargado.zona) {
                throw new Error("Perfil de encargado de zona no encontrado o sin zona asignada.");
            }
            const escuelaIds = encargado.zona.escuelas.map((e) => e.id);
            return {
                prismaAny,
                userType: "encargado",
                allowedEscuelas: escuelaIds,
                userId: user.id,
                zonaId: encargado.zona.id
            };
        }
        // DIRECTOR: Acceso solo a su escuela asignada
        if (user.rol === "director") {
            const director = await prismaAny.usuarioPerfil.findUnique({
                where: { id: user.id },
                select: { id: true, rol: true, escuela_id: true },
            });
            if (!director || director.rol !== "director") {
                throw new Error("Perfil de director no encontrado.");
            }
            if (!director.escuela_id) {
                throw new Error("El director no tiene una escuela asignada.");
            }
            return {
                prismaAny,
                userType: "director",
                allowedEscuelas: [director.escuela_id],
                userId: user.id,
                escuelaId: director.escuela_id
            };
        }
        throw new Error("No tienes permisos para gestionar aulas.");
    }
    /**
     * Crea un aula nueva validando permisos y existencia de la sala.
     *
     * @remarks
     * - Directores: la `escuela_id` se toma de su perfil (no del body).
     * - Encargados: deben especificar `escuela_id` y esta debe pertenecer a su zona.
     * - PADI: pueden especificar cualquier `escuela_id`.
     *
     * @param data - DTO del aula a crear.
     * @param user - Usuario autenticado.
     * @returns El aula creada.
     * @throws Error si la sala no existe, falta `escuela_id` o el usuario no tiene permisos.
     */
    async create(data, user) {
        const userPerms = await this.getUserWithPermissions(user);
        // Ahora PADI también puede crear aulas
        if (userPerms.userType !== "director" && userPerms.userType !== "encargado" && userPerms.userType !== "padi") {
            throw new Error("No tienes permisos para crear aulas.");
        }
        const { prismaAny } = userPerms;
        const sala = await prismaAny.salas.findUnique({
            where: { id: data.sala_id },
            select: { id: true },
        });
        if (!sala) {
            throw new Error("La sala seleccionada no existe.");
        }
        let escuela_id;
        if (userPerms.userType === "director") {
            escuela_id = userPerms.escuelaId;
        }
        else {
            // Para PADI y encargados, necesitamos que especifiquen la escuela
            if (!data.escuela_id) {
                throw new Error("Debe especificar la escuela para crear el aula.");
            }
            // Verificar permisos sobre la escuela (solo para encargados, PADI puede crear en cualquier escuela)
            if (userPerms.userType === "encargado") {
                if (!userPerms.allowedEscuelas.includes(data.escuela_id)) {
                    throw new Error("No tienes permisos para crear aulas en esta escuela.");
                }
            }
            // PADI puede crear en cualquier escuela
            escuela_id = data.escuela_id;
        }
        const payload = {
            sala_id: data.sala_id,
            comision: data.comision,
            turno: data.turno,
            escuela_id: escuela_id,
        };
        return await this.repo.create(payload);
    }
    /**
     * Lista aulas según el scope del rol del usuario.
     *
     * @param user - Usuario autenticado.
     * @returns Array de aulas con sala, escuela y docentes, filtrado por scope.
     */
    async list(user) {
        const userPerms = await this.getUserWithPermissions(user);
        if (userPerms.userType === "director") {
            return await this.repo.listByEscuela(userPerms.escuelaId);
        }
        else if (userPerms.userType === "encargado") {
            // Listar aulas de todas las escuelas de su zona
            return await this.repo.listByEscuelas(userPerms.allowedEscuelas);
        }
        else { // PADI
            // Listar todas las aulas del sistema
            return await this.repo.listAll();
        }
    }
    /**
     * Actualiza los datos de un aula, verificando que el usuario tenga acceso a ella.
     *
     * @param id - UUID del aula.
     * @param data - Campos a actualizar.
     * @param user - Usuario autenticado (debe ser `"director"` o `"equipo_padi"`).
     * @returns El aula actualizada.
     * @throws Error si el aula no existe o el director intenta modificar un aula de otra escuela.
     */
    async update(id, data, user) {
        const userPerms = await this.getUserWithPermissions(user);
        if (userPerms.userType !== "director" && userPerms.userType !== "padi") {
            throw new Error("Solo directores y equipo PADI pueden gestionar aulas.");
        }
        const { prismaAny } = userPerms;
        const aula = await prismaAny.aulas.findUnique({
            where: { id },
            select: { id: true, escuela_id: true },
        });
        if (!aula) {
            throw new Error("Aula no encontrada.");
        }
        if (userPerms.userType === "director" && aula.escuela_id !== userPerms.escuelaId) {
            throw new Error("No tienes permisos para modificar esta aula.");
        }
        return await this.repo.update(id, data);
    }
    /**
     * Elimina un aula, verificando que no tenga estudiantes ni docentes asignados.
     *
     * @param id - UUID del aula.
     * @param user - Usuario autenticado.
     * @returns `void` si la eliminación fue exitosa.
     * @throws Error si el aula no existe, tiene asignaciones activas, o el usuario no tiene permisos.
     */
    async delete(id, user) {
        const userPerms = await this.getUserWithPermissions(user);
        if (userPerms.userType !== "director" && userPerms.userType !== "encargado" && userPerms.userType !== "padi") {
            throw new Error("No tienes permisos para eliminar aulas.");
        }
        const { prismaAny } = userPerms;
        const aula = await prismaAny.aulas.findUnique({
            where: { id },
            select: { id: true, escuela_id: true },
        });
        if (!aula) {
            throw new Error("Aula no encontrada.");
        }
        if (userPerms.userType === "director" && aula.escuela_id !== userPerms.escuelaId) {
            throw new Error("No tienes permisos para eliminar esta aula.");
        }
        if (userPerms.userType === "encargado" && !userPerms.allowedEscuelas.includes(aula.escuela_id)) {
            throw new Error("No tienes permisos para eliminar esta aula.");
        }
        // Verificar que no tenga asignaciones de estudiantes o profesores
        const [estCount, profCount] = await Promise.all([
            prismaAny.estudiantesAulas.count({ where: { aula_id: id } }),
            prismaAny.profesoresAulas.count({ where: { aula_id: id } }),
        ]);
        if (estCount > 0 || profCount > 0) {
            throw new Error("No se puede eliminar un aula con estudiantes o docentes asignados.");
        }
        await this.repo.delete(id);
    }
    /**
     * Lista los docentes asignados a un aula verificando permisos de acceso.
     *
     * @param aulaId - UUID del aula.
     * @param user - Usuario autenticado.
     * @returns Array de asignaciones docente-aula con datos del docente.
     * @throws Error si el aula no existe o el usuario no tiene acceso a esa escuela.
     */
    async listDocentes(aulaId, user) {
        const userPerms = await this.getUserWithPermissions(user);
        const { prismaAny } = userPerms;
        const aula = await prismaAny.aulas.findUnique({
            where: { id: aulaId },
            select: { id: true, escuela_id: true },
        });
        if (!aula) {
            throw new Error("Aula no encontrada.");
        }
        // Verificar permisos sobre la escuela del aula
        if (userPerms.userType === "director") {
            if (aula.escuela_id !== userPerms.escuelaId) {
                throw new Error("No tienes permisos para ver los docentes de esta aula.");
            }
        }
        else if (userPerms.userType === "encargado") {
            if (!userPerms.allowedEscuelas.includes(aula.escuela_id)) {
                throw new Error("No tienes permisos para ver los docentes de esta aula.");
            }
        }
        // PADI puede ver cualquier aula
        return this.profAulaRepo.listByAula(aulaId);
    }
    /**
     * Asigna un docente a un aula, verificando que esté previamente asignado a la escuela del aula.
     *
     * @remarks
     * Regla de negocio clave: un docente solo puede asignarse a un aula de una escuela
     * a la que ya pertenece (relación activa en `profesoresEscuelas`).
     *
     * @param aulaId - UUID del aula.
     * @param profesorId - UUID del docente.
     * @param user - Usuario autenticado.
     * @returns El registro de asignación creado.
     * @throws Error si el docente no existe, no está en la escuela del aula, o el usuario no tiene permisos.
     */
    async asignarDocente(aulaId, profesorId, user) {
        const userPerms = await this.getUserWithPermissions(user);
        if (userPerms.userType !== "director" && userPerms.userType !== "encargado" && userPerms.userType !== "padi") {
            throw new Error("No tienes permisos para gestionar docentes en aulas.");
        }
        const { prismaAny } = userPerms;
        const aula = await prismaAny.aulas.findUnique({
            where: { id: aulaId },
            select: { id: true, escuela_id: true },
        });
        if (!aula) {
            throw new Error("Aula no encontrada.");
        }
        if (userPerms.userType === "director" && aula.escuela_id !== userPerms.escuelaId) {
            throw new Error("No tienes permisos para gestionar docentes de esta aula.");
        }
        if (userPerms.userType === "encargado" && !userPerms.allowedEscuelas.includes(aula.escuela_id)) {
            throw new Error("No tienes permisos para gestionar docentes de esta aula.");
        }
        // Validar que el profesor exista
        const profesor = await prismaAny.profesores.findUnique({
            where: { id: profesorId },
            select: { id: true },
        });
        if (!profesor) {
            throw new Error("Docente no encontrado.");
        }
        const isAssignedToEscuela = await this.docenteRepo.hasActiveEscuelaAssignment(profesorId, aula.escuela_id);
        if (!isAssignedToEscuela) {
            throw new Error("El docente no está asignado al colegio de esta aula.");
        }
        return this.profAulaRepo.add(profesorId, aulaId);
    }
    /**
     * Desasigna un docente de un aula.
     *
     * @param aulaId - UUID del aula.
     * @param profesorId - UUID del docente.
     * @param user - Usuario autenticado.
     * @throws Error si el aula no existe o el usuario no tiene permisos sobre esa escuela.
     */
    async desasignarDocente(aulaId, profesorId, user) {
        const userPerms = await this.getUserWithPermissions(user);
        if (userPerms.userType !== "director" && userPerms.userType !== "encargado" && userPerms.userType !== "padi") {
            throw new Error("No tienes permisos para gestionar docentes en aulas.");
        }
        const { prismaAny } = userPerms;
        const aula = await prismaAny.aulas.findUnique({
            where: { id: aulaId },
            select: { id: true, escuela_id: true },
        });
        if (!aula) {
            throw new Error("Aula no encontrada.");
        }
        if (userPerms.userType === "director" && aula.escuela_id !== userPerms.escuelaId) {
            throw new Error("No tienes permisos para gestionar docentes de esta aula.");
        }
        if (userPerms.userType === "encargado" && !userPerms.allowedEscuelas.includes(aula.escuela_id)) {
            throw new Error("No tienes permisos para gestionar docentes de esta aula.");
        }
        await this.profAulaRepo.remove(profesorId, aulaId);
    }
    /**
     * Lista las aulas asignadas al docente autenticado con sus estudiantes activos.
     *
     * @param user - Usuario autenticado (debe tener rol `"docente"`).
     * @returns Array de aulas con estudiantes y resumen de evaluaciones.
     * @throws Error si el rol no es `"docente"`.
     */
    async listDocenteAulas(user) {
        if (user.rol !== "docente") {
            throw new Error("No tienes permisos para ver tus aulas.");
        }
        return await this.repo.listByProfesor(user.id);
    }
    /**
     * Lista los estudiantes activos de un aula con control de permisos.
     *
     * @param aulaId - UUID del aula.
     * @param user - Usuario autenticado.
     * @returns Array de estudiantes activos con datos personales y de sala.
     * @throws Error si el aula no existe o el usuario no tiene acceso a esa escuela.
     */
    async listEstudiantesAula(aulaId, user) {
        const userPerms = await this.getUserWithPermissions(user);
        const { prismaAny } = userPerms;
        const aula = await prismaAny.aulas.findUnique({
            where: { id: aulaId },
            select: { id: true, escuela_id: true },
        });
        if (!aula) {
            throw new Error("Aula no encontrada.");
        }
        if (userPerms.userType === "director" && aula.escuela_id !== userPerms.escuelaId) {
            throw new Error("No tienes permisos para ver estudiantes de esta aula.");
        }
        if (userPerms.userType === "encargado"
            && !userPerms.allowedEscuelas.includes(aula.escuela_id)) {
            throw new Error("No tienes permisos para ver estudiantes de esta aula.");
        }
        return await this.repo.listEstudiantesByAula(aulaId);
    }
    /**
     * Asigna un estudiante a un aula, verificando que pertenezcan a la misma escuela.
     *
     * @param aulaId - UUID del aula.
     * @param estudianteId - UUID del estudiante.
     * @param user - Usuario autenticado.
     * @returns El registro de asignación creado.
     * @throws Error si el estudiante o aula no existen, pertenecen a distintas escuelas,
     *         o el usuario no tiene permisos.
     */
    async asignarEstudiante(aulaId, estudianteId, user) {
        const userPerms = await this.getUserWithPermissions(user);
        if (userPerms.userType !== "director" && userPerms.userType !== "encargado" && userPerms.userType !== "padi") {
            throw new Error("No tienes permisos para gestionar estudiantes en aulas.");
        }
        const { prismaAny } = userPerms;
        const aula = await prismaAny.aulas.findUnique({
            where: { id: aulaId },
            select: { id: true, escuela_id: true },
        });
        if (!aula)
            throw new Error("Aula no encontrada.");
        if (userPerms.userType === "director" && aula.escuela_id !== userPerms.escuelaId) {
            throw new Error("No tienes permisos para gestionar estudiantes de esta aula.");
        }
        if (userPerms.userType === "encargado" && !userPerms.allowedEscuelas.includes(aula.escuela_id)) {
            throw new Error("No tienes permisos para gestionar estudiantes de esta aula.");
        }
        const estudiante = await prismaAny.estudiantes.findUnique({
            where: { id: estudianteId },
            select: { id: true, escuela_id: true },
        });
        if (!estudiante)
            throw new Error("Estudiante no encontrado.");
        if (estudiante.escuela_id !== aula.escuela_id) {
            throw new Error("El estudiante no pertenece al colegio de esta aula.");
        }
        return await this.repo.addEstudiante(estudianteId, aulaId);
    }
    /**
     * Desasigna un estudiante de un aula estableciendo `fecha_fin` en la asignación activa.
     *
     * @param aulaId - UUID del aula.
     * @param estudianteId - UUID del estudiante.
     * @param user - Usuario autenticado.
     * @throws Error si no existe asignación activa o el usuario no tiene permisos sobre esa escuela.
     */
    async desasignarEstudiante(aulaId, estudianteId, user) {
        const userPerms = await this.getUserWithPermissions(user);
        if (userPerms.userType !== "director" && userPerms.userType !== "encargado" && userPerms.userType !== "padi") {
            throw new Error("No tienes permisos para gestionar estudiantes en aulas.");
        }
        const { prismaAny } = userPerms;
        const aula = await prismaAny.aulas.findUnique({
            where: { id: aulaId },
            select: { id: true, escuela_id: true },
        });
        if (!aula)
            throw new Error("Aula no encontrada.");
        if (userPerms.userType === "director" && aula.escuela_id !== userPerms.escuelaId) {
            throw new Error("No tienes permisos para gestionar estudiantes de esta aula.");
        }
        if (userPerms.userType === "encargado" && !userPerms.allowedEscuelas.includes(aula.escuela_id)) {
            throw new Error("No tienes permisos para gestionar estudiantes de esta aula.");
        }
        await this.repo.removeEstudiante(estudianteId, aulaId);
    }
}
exports.AulasService = AulasService;
