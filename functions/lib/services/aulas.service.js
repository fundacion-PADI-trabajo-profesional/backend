"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AulasService = void 0;
const prismaClient_1 = require("../config/prismaClient");
const aula_repository_1 = require("../repositories/aula.repository");
const profesor_aula_repository_1 = require("../repositories/profesor-aula.repository");
const docente_repository_1 = require("../repositories/docente.repository");
const inscripcion_helper_1 = require("../helpers/inscripcion.helper");
/**
 * Servicio de gestión de aulas y sus asignaciones de docentes y estudiantes.
 */
class AulasService {
    constructor() {
        this.repo = aula_repository_1.AulasRepository;
        this.profAulaRepo = profesor_aula_repository_1.ProfesoresAulasRepository;
        this.docenteRepo = docente_repository_1.DocenteRepository;
    }
    /**
     * Resuelve los permisos del usuario dentro de un contexto de tx ya abierto.
     * Devuelve `userType` y `allowedEscuelas` sin acceder a `prismaAny` externamente.
     */
    async resolvePerms(tx, user) {
        if (user.rol === "equipo_padi") {
            return {
                userType: "padi",
                allowedEscuelas: "all",
                userId: user.id,
                escuelaId: undefined,
            };
        }
        if (user.rol === "encargado_zona") {
            const encargado = await tx.encargados.findUnique({
                where: { usuario_id: user.id },
                select: {
                    id: true,
                    zona: {
                        select: {
                            id: true,
                            nombre: true,
                            escuelas: { select: { id: true } },
                        },
                    },
                },
            });
            if (!encargado || !encargado.zona) {
                throw new Error("Perfil de encargado de zona no encontrado o sin zona asignada.");
            }
            const escuelaIds = encargado.zona.escuelas.map((e) => e.id);
            return {
                userType: "encargado",
                allowedEscuelas: escuelaIds,
                userId: user.id,
                zonaId: encargado.zona.id,
                escuelaId: undefined,
            };
        }
        if (user.rol === "director") {
            const director = await tx.usuarioPerfil.findUnique({
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
                userType: "director",
                allowedEscuelas: [director.escuela_id],
                userId: user.id,
                escuelaId: director.escuela_id,
            };
        }
        throw new Error("No tienes permisos para gestionar aulas.");
    }
    /**
     * Crea un aula nueva validando permisos y existencia de la sala.
     */
    async create(data, user) {
        return (0, prismaClient_1.withRLSContext)(async (tx) => {
            const perms = await this.resolvePerms(tx, user);
            if (perms.userType !== "director" && perms.userType !== "encargado" && perms.userType !== "padi") {
                throw new Error("No tienes permisos para crear aulas.");
            }
            const sala = await tx.salas.findUnique({
                where: { id: data.sala_id },
                select: { id: true },
            });
            if (!sala) {
                throw new Error("La sala seleccionada no existe.");
            }
            let escuela_id;
            if (perms.userType === "director") {
                escuela_id = perms.escuelaId;
            }
            else {
                if (!data.escuela_id) {
                    throw new Error("Debe especificar la escuela para crear el aula.");
                }
                if (perms.userType === "encargado") {
                    if (!perms.allowedEscuelas.includes(data.escuela_id)) {
                        throw new Error("No tienes permisos para crear aulas en esta escuela.");
                    }
                }
                escuela_id = data.escuela_id;
            }
            const payload = {
                sala_id: data.sala_id,
                comision: data.comision,
                turno: data.turno,
                escuela_id,
            };
            return tx.aulas.create({ data: payload });
        });
    }
    /**
     * Lista aulas según el scope del rol del usuario.
     */
    async list(user, escuela_id) {
        const perms = await (0, prismaClient_1.withRLSContext)(async (tx) => this.resolvePerms(tx, user));
        if (perms.userType === "director") {
            return this.repo.listByEscuela(perms.escuelaId);
        }
        else if (perms.userType === "encargado") {
            if (escuela_id) {
                if (!perms.allowedEscuelas.includes(escuela_id)) {
                    throw new Error("No tienes permisos para ver aulas de esta escuela.");
                }
                return this.repo.listByEscuela(escuela_id);
            }
            return this.repo.listByEscuelas(perms.allowedEscuelas);
        }
        else {
            if (escuela_id) {
                return this.repo.listByEscuela(escuela_id);
            }
            return this.repo.listAll();
        }
    }
    /**
     * Actualiza los datos de un aula, verificando que el usuario tenga acceso a ella.
     */
    async update(id, data, user) {
        return (0, prismaClient_1.withRLSContext)(async (tx) => {
            const perms = await this.resolvePerms(tx, user);
            if (perms.userType !== "director" && perms.userType !== "encargado" && perms.userType !== "padi") {
                throw new Error("Solo directores, encargados de zona y equipo PADI pueden gestionar aulas.");
            }
            const aula = await tx.aulas.findUnique({
                where: { id },
                select: { id: true, escuela_id: true },
            });
            if (!aula)
                throw new Error("Aula no encontrada.");
            if (perms.userType === "director" && aula.escuela_id !== perms.escuelaId) {
                throw new Error("No tienes permisos para modificar esta aula.");
            }
            if (perms.userType === "encargado" && !perms.allowedEscuelas.includes(aula.escuela_id)) {
                throw new Error("No tienes permisos para modificar esta aula.");
            }
            return tx.aulas.update({
                where: { id },
                data: {
                    ...(data.sala_id !== undefined ? { sala_id: data.sala_id } : {}),
                    ...(data.comision !== undefined ? { comision: data.comision } : {}),
                    ...(data.turno !== undefined ? { turno: data.turno } : {}),
                },
            });
        });
    }
    /**
     * Elimina un aula, verificando que no tenga estudiantes ni docentes asignados.
     */
    async delete(id, user) {
        const perms = await (0, prismaClient_1.withRLSContext)(async (tx) => this.resolvePerms(tx, user));
        if (perms.userType !== "director" && perms.userType !== "encargado" && perms.userType !== "padi") {
            throw new Error("No tienes permisos para eliminar aulas.");
        }
        return (0, prismaClient_1.withRLSContextAsAdmin)(async (tx) => {
            const aula = await tx.aulas.findUnique({
                where: { id },
                select: { id: true, escuela_id: true },
            });
            if (!aula)
                throw new Error("Aula no encontrada.");
            if (perms.userType === "director" && aula.escuela_id !== perms.escuelaId) {
                throw new Error("No tienes permisos para eliminar esta aula.");
            }
            if (perms.userType === "encargado" && !perms.allowedEscuelas.includes(aula.escuela_id)) {
                throw new Error("No tienes permisos para eliminar esta aula.");
            }
            const [estCount, profCount] = await Promise.all([
                tx.estudiantesAulas.count({ where: { aula_id: id } }),
                tx.profesoresAulas.count({ where: { aula_id: id } }),
            ]);
            if (estCount > 0 || profCount > 0) {
                throw new Error("No se puede eliminar un aula con estudiantes o docentes asignados.");
            }
            await tx.aulas.delete({ where: { id } });
        });
    }
    /**
     * Lista los docentes asignados a un aula verificando permisos de acceso.
     */
    async listDocentes(aulaId, user) {
        return (0, prismaClient_1.withRLSContext)(async (tx) => {
            const perms = await this.resolvePerms(tx, user);
            const aula = await tx.aulas.findUnique({
                where: { id: aulaId },
                select: { id: true, escuela_id: true },
            });
            if (!aula)
                throw new Error("Aula no encontrada.");
            if (perms.userType === "director" && aula.escuela_id !== perms.escuelaId) {
                throw new Error("No tienes permisos para ver los docentes de esta aula.");
            }
            else if (perms.userType === "encargado" && !perms.allowedEscuelas.includes(aula.escuela_id)) {
                throw new Error("No tienes permisos para ver los docentes de esta aula.");
            }
            return tx.profesoresAulas.findMany({
                where: { aula_id: aulaId },
                include: {
                    profesor: {
                        include: {
                            personas: { select: { nombre: true, primer_apellido: true } },
                        },
                    },
                },
            });
        });
    }
    /**
     * Asigna un docente a un aula, verificando que esté previamente asignado a la escuela del aula.
     */
    async asignarDocente(aulaId, profesorId, user) {
        return (0, prismaClient_1.withRLSContext)(async (tx) => {
            const perms = await this.resolvePerms(tx, user);
            if (perms.userType !== "director" && perms.userType !== "encargado" && perms.userType !== "padi") {
                throw new Error("No tienes permisos para gestionar docentes en aulas.");
            }
            const aula = await tx.aulas.findUnique({
                where: { id: aulaId },
                select: { id: true, escuela_id: true },
            });
            if (!aula)
                throw new Error("Aula no encontrada.");
            if (perms.userType === "director" && aula.escuela_id !== perms.escuelaId) {
                throw new Error("No tienes permisos para gestionar docentes de esta aula.");
            }
            if (perms.userType === "encargado" && !perms.allowedEscuelas.includes(aula.escuela_id)) {
                throw new Error("No tienes permisos para gestionar docentes de esta aula.");
            }
            const profesor = await tx.profesores.findUnique({
                where: { id: profesorId },
                select: { id: true },
            });
            if (!profesor)
                throw new Error("Docente no encontrado.");
            // Check active escuela assignment inline (same tx)
            const escuelaAssignment = await tx.profesoresEscuelas.findFirst({
                where: {
                    profesor_id: profesorId,
                    escuela_id: aula.escuela_id,
                    fecha_fin: null,
                },
                select: { id: true },
            });
            if (!escuelaAssignment) {
                throw new Error("El docente no está asignado al colegio de esta aula.");
            }
            return tx.profesoresAulas.create({
                data: { profesor_id: profesorId, aula_id: aulaId },
            });
        });
    }
    /**
     * Desasigna un docente de un aula.
     */
    async desasignarDocente(aulaId, profesorId, user) {
        return (0, prismaClient_1.withRLSContext)(async (tx) => {
            const perms = await this.resolvePerms(tx, user);
            if (perms.userType !== "director" && perms.userType !== "encargado" && perms.userType !== "padi") {
                throw new Error("No tienes permisos para gestionar docentes en aulas.");
            }
            const aula = await tx.aulas.findUnique({
                where: { id: aulaId },
                select: { id: true, escuela_id: true },
            });
            if (!aula)
                throw new Error("Aula no encontrada.");
            if (perms.userType === "director" && aula.escuela_id !== perms.escuelaId) {
                throw new Error("No tienes permisos para gestionar docentes de esta aula.");
            }
            if (perms.userType === "encargado" && !perms.allowedEscuelas.includes(aula.escuela_id)) {
                throw new Error("No tienes permisos para gestionar docentes de esta aula.");
            }
            await tx.profesoresAulas.deleteMany({
                where: { profesor_id: profesorId, aula_id: aulaId },
            });
        });
    }
    /**
     * Lista las aulas asignadas al docente autenticado con sus estudiantes activos.
     */
    async listDocenteAulas(user) {
        if (user.rol !== "docente") {
            throw new Error("No tienes permisos para ver tus aulas.");
        }
        return this.repo.listByProfesor(user.id);
    }
    /**
     * Lista los estudiantes activos de un aula con control de permisos.
     */
    async listEstudiantesAula(aulaId, user) {
        // Verificamos permisos con el contexto RLS del usuario
        const perms = await (0, prismaClient_1.withRLSContext)(async (tx) => {
            const p = await this.resolvePerms(tx, user);
            const aula = await tx.aulas.findUnique({
                where: { id: aulaId },
                select: { id: true, escuela_id: true },
            });
            if (!aula)
                throw new Error("Aula no encontrada.");
            if (p.userType === "director" && aula.escuela_id !== p.escuelaId) {
                throw new Error("No tienes permisos para ver estudiantes de esta aula.");
            }
            if (p.userType === "encargado" && !p.allowedEscuelas.includes(aula.escuela_id)) {
                throw new Error("No tienes permisos para ver estudiantes de esta aula.");
            }
            return p;
        });
        // Leemos _EstudiantesToAulas como admin para evitar bloqueos RLS en esa tabla
        return (0, prismaClient_1.withRLSContextAsAdmin)(async (tx) => {
            void perms; // permisos ya verificados arriba
            return tx.estudiantesAulas.findMany({
                where: { aula_id: aulaId, fecha_fin: null },
                include: {
                    estudiante: {
                        include: {
                            personas: {
                                select: {
                                    id: true,
                                    nombre: true,
                                    primer_apellido: true,
                                    segundo_apellido: true,
                                    dni: true,
                                    fecha_nacimiento: true,
                                },
                            },
                            generos: { select: { id: true, descripcion: true } },
                            salas: { select: { id: true, nombre: true, grado: true } },
                            escuela: { select: { id: true, nombre: true } },
                        },
                    },
                },
                orderBy: [
                    { estudiante: { personas: { primer_apellido: "asc" } } },
                    { estudiante: { personas: { nombre: "asc" } } },
                ],
            }).then((rows) => rows.map((ea) => ea.estudiante));
        });
    }
    /**
     * Asigna un estudiante a un aula, verificando que pertenezcan a la misma escuela.
     */
    async asignarEstudiante(aulaId, estudianteId, user) {
        return (0, prismaClient_1.withRLSContext)(async (tx) => {
            const perms = await this.resolvePerms(tx, user);
            if (perms.userType !== "director" && perms.userType !== "encargado" && perms.userType !== "padi") {
                throw new Error("No tienes permisos para gestionar estudiantes en aulas.");
            }
            const aula = await tx.aulas.findUnique({
                where: { id: aulaId },
                select: { id: true, escuela_id: true, sala_id: true, comision: true },
            });
            if (!aula)
                throw new Error("Aula no encontrada.");
            if (perms.userType === "director" && aula.escuela_id !== perms.escuelaId) {
                throw new Error("No tienes permisos para gestionar estudiantes de esta aula.");
            }
            if (perms.userType === "encargado" && !perms.allowedEscuelas.includes(aula.escuela_id)) {
                throw new Error("No tienes permisos para gestionar estudiantes de esta aula.");
            }
            const estudiante = await tx.estudiantes.findFirst({
                where: { id: estudianteId, fecha_baja: null },
                select: { id: true, escuela_id: true, sala_id: true },
            });
            if (!estudiante)
                throw new Error("Estudiante no encontrado.");
            if (estudiante.escuela_id !== aula.escuela_id) {
                throw new Error("El estudiante no pertenece al colegio de esta aula.");
            }
            (0, inscripcion_helper_1.validarSalaCompatible)(estudiante.sala_id, aula.sala_id, { aulaComision: aula.comision });
            return (await (0, inscripcion_helper_1.inscribirConTraslado)(tx, estudianteId, aulaId)).registro;
        });
    }
    /**
     * Desasigna un estudiante de un aula estableciendo `fecha_fin` en la asignación activa.
     */
    async desasignarEstudiante(aulaId, estudianteId, user) {
        return (0, prismaClient_1.withRLSContext)(async (tx) => {
            const perms = await this.resolvePerms(tx, user);
            if (perms.userType !== "director" && perms.userType !== "encargado" && perms.userType !== "padi") {
                throw new Error("No tienes permisos para gestionar estudiantes en aulas.");
            }
            const aula = await tx.aulas.findUnique({
                where: { id: aulaId },
                select: { id: true, escuela_id: true },
            });
            if (!aula)
                throw new Error("Aula no encontrada.");
            if (perms.userType === "director" && aula.escuela_id !== perms.escuelaId) {
                throw new Error("No tienes permisos para gestionar estudiantes de esta aula.");
            }
            if (perms.userType === "encargado" && !perms.allowedEscuelas.includes(aula.escuela_id)) {
                throw new Error("No tienes permisos para gestionar estudiantes de esta aula.");
            }
            const assignment = await tx.estudiantesAulas.findFirst({
                where: { estudiante_id: estudianteId, aula_id: aulaId, fecha_fin: null },
            });
            if (!assignment)
                throw new Error("El estudiante no está asignado a esta aula.");
            await tx.estudiantesAulas.update({
                where: { id: assignment.id },
                data: { fecha_fin: new Date() },
            });
        });
    }
}
exports.AulasService = AulasService;
