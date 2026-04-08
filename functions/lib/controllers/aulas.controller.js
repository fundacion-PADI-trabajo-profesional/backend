"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAula = createAula;
exports.listAulas = listAulas;
exports.updateAula = updateAula;
exports.deleteAula = deleteAula;
exports.listAulaDocentes = listAulaDocentes;
exports.asignarDocenteAula = asignarDocenteAula;
exports.desasignarDocenteAula = desasignarDocenteAula;
exports.listDocenteAulas = listDocenteAulas;
exports.asignarEstudianteAula = asignarEstudianteAula;
exports.desasignarEstudianteAula = desasignarEstudianteAula;
exports.listAulaEstudiantes = listAulaEstudiantes;
const aulas_service_1 = require("../services/aulas.service");
const common_response_interface_1 = require("../interfaces/common-response.interface");
const service = new aulas_service_1.AulasService();
// POST /aulas
async function createAula(req, res) {
    try {
        const { sala_id, comision, turno, escuela_id } = req.body;
        if (!sala_id || !comision || !turno) {
            return res
                .status(400)
                .json((0, common_response_interface_1.commonResponse)(false, "Faltan datos obligatorios", null, {
                code: "VALIDATION_ERROR",
            }));
        }
        const user = { id: req.user.id, rol: req.user.rol };
        const data = await service.create({
            sala_id: Number(sala_id),
            comision,
            turno,
            escuela_id: escuela_id ? String(escuela_id) : undefined,
        }, user);
        return res
            .status(201)
            .json((0, common_response_interface_1.commonResponse)(true, "Aula creada con éxito", data));
    }
    catch (error) {
        const message = error.message || "Error interno al crear aula";
        console.error("[createAula] Error:", error);
        return res
            .status(400)
            .json((0, common_response_interface_1.commonResponse)(false, message, null, {
            code: "CREATE_ERROR",
            description: message,
        }));
    }
}
// GET /aulas
async function listAulas(req, res) {
    try {
        const user = { id: req.user.id, rol: req.user.rol };
        const data = await service.list(user);
        return res.status(200).json((0, common_response_interface_1.commonResponse)(true, "ok", data));
    }
    catch (error) {
        const message = error.message || "Error interno al listar aulas";
        console.error("[listAulas] Error:", error);
        return res
            .status(500)
            .json((0, common_response_interface_1.commonResponse)(false, message, null, {
            code: "INTERNAL_ERROR",
            description: message,
        }));
    }
}
// PUT /aulas/:id
async function updateAula(req, res) {
    try {
        const { id } = req.params;
        const { sala_id, comision, turno } = req.body;
        if (!id) {
            return res
                .status(400)
                .json((0, common_response_interface_1.commonResponse)(false, "Faltan datos obligatorios", null, {
                code: "VALIDATION_ERROR",
            }));
        }
        const user = { id: req.user.id, rol: req.user.rol };
        const data = await service.update(id, {
            sala_id: sala_id !== undefined ? Number(sala_id) : undefined,
            comision,
            turno,
        }, user);
        return res
            .status(200)
            .json((0, common_response_interface_1.commonResponse)(true, "Aula actualizada con éxito", data));
    }
    catch (error) {
        const message = error.message || "Error interno al actualizar aula";
        console.error("[updateAula] Error:", error);
        return res
            .status(400)
            .json((0, common_response_interface_1.commonResponse)(false, message, null, {
            code: "UPDATE_ERROR",
            description: message,
        }));
    }
}
// DELETE /aulas/:id
async function deleteAula(req, res) {
    try {
        const { id } = req.params;
        if (!id) {
            return res
                .status(400)
                .json((0, common_response_interface_1.commonResponse)(false, "Faltan datos obligatorios", null, {
                code: "VALIDATION_ERROR",
            }));
        }
        const user = { id: req.user.id, rol: req.user.rol };
        await service.delete(id, user);
        return res
            .status(200)
            .json((0, common_response_interface_1.commonResponse)(true, "Aula eliminada con éxito", null));
    }
    catch (error) {
        const message = error.message || "Error interno al eliminar aula";
        console.error("[deleteAula] Error:", error);
        return res
            .status(400)
            .json((0, common_response_interface_1.commonResponse)(false, message, null, {
            code: "DELETE_ERROR",
            description: message,
        }));
    }
}
// GET /aulas/:id/docentes
async function listAulaDocentes(req, res) {
    try {
        const { id } = req.params;
        if (!id) {
            return res
                .status(400)
                .json((0, common_response_interface_1.commonResponse)(false, "Faltan datos obligatorios", null, {
                code: "VALIDATION_ERROR",
            }));
        }
        const user = { id: req.user.id, rol: req.user.rol };
        const data = await service.listDocentes(id, user);
        return res.status(200).json((0, common_response_interface_1.commonResponse)(true, "ok", data));
    }
    catch (error) {
        const message = error.message || "Error interno al listar docentes del aula";
        console.error("[listAulaDocentes] Error:", error);
        return res
            .status(500)
            .json((0, common_response_interface_1.commonResponse)(false, message, null, {
            code: "INTERNAL_ERROR",
            description: message,
        }));
    }
}
// POST /aulas/:id/asignar-docente
async function asignarDocenteAula(req, res) {
    try {
        const { id } = req.params;
        const { profesor_id } = req.body;
        if (!id || !profesor_id) {
            return res
                .status(400)
                .json((0, common_response_interface_1.commonResponse)(false, "Faltan datos obligatorios", null, {
                code: "VALIDATION_ERROR",
            }));
        }
        const user = { id: req.user.id, rol: req.user.rol };
        const data = await service.asignarDocente(id, String(profesor_id), user);
        return res
            .status(200)
            .json((0, common_response_interface_1.commonResponse)(true, "Docente asignado al aula", data));
    }
    catch (error) {
        const message = error.message || "Error al asignar docente al aula";
        console.error("[asignarDocenteAula] Error:", error);
        return res
            .status(400)
            .json((0, common_response_interface_1.commonResponse)(false, message, null, {
            code: "ASSIGN_ERROR",
            description: message,
        }));
    }
}
// POST /aulas/:id/desasignar-docente
async function desasignarDocenteAula(req, res) {
    try {
        const { id } = req.params;
        const { profesor_id } = req.body;
        if (!id || !profesor_id) {
            return res
                .status(400)
                .json((0, common_response_interface_1.commonResponse)(false, "Faltan datos obligatorios", null, {
                code: "VALIDATION_ERROR",
            }));
        }
        const user = { id: req.user.id, rol: req.user.rol };
        await service.desasignarDocente(id, String(profesor_id), user);
        return res
            .status(200)
            .json((0, common_response_interface_1.commonResponse)(true, "Docente desasignado del aula", null));
    }
    catch (error) {
        const message = error.message || "Error al desasignar docente del aula";
        console.error("[desasignarDocenteAula] Error:", error);
        return res
            .status(400)
            .json((0, common_response_interface_1.commonResponse)(false, message, null, {
            code: "UNASSIGN_ERROR",
            description: message,
        }));
    }
}
// GET /docentes/aulas
async function listDocenteAulas(req, res) {
    try {
        const user = { id: req.user.id, rol: req.user.rol };
        const data = await service.listDocenteAulas(user);
        return res.status(200).json((0, common_response_interface_1.commonResponse)(true, "ok", data));
    }
    catch (error) {
        const message = error.message || "Error al obtener aulas del docente";
        console.error("[listDocenteAulas] Error:", error);
        return res
            .status(400)
            .json((0, common_response_interface_1.commonResponse)(false, message, null, {
            code: "LIST_ERROR",
            description: message,
        }));
    }
}
// POST /aulas/:id/asignar-estudiante
async function asignarEstudianteAula(req, res) {
    try {
        const { id } = req.params;
        const { estudiante_id } = req.body;
        if (!id || !estudiante_id) {
            return res
                .status(400)
                .json((0, common_response_interface_1.commonResponse)(false, "Faltan datos obligatorios", null, {
                code: "VALIDATION_ERROR",
            }));
        }
        const user = { id: req.user.id, rol: req.user.rol };
        const data = await service.asignarEstudiante(id, String(estudiante_id), user);
        return res
            .status(200)
            .json((0, common_response_interface_1.commonResponse)(true, "Estudiante asignado al aula", data));
    }
    catch (error) {
        const message = error.message || "Error al asignar estudiante al aula";
        console.error("[asignarEstudianteAula] Error:", error);
        return res
            .status(400)
            .json((0, common_response_interface_1.commonResponse)(false, message, null, { code: "ASSIGN_ERROR", description: message }));
    }
}
// POST /aulas/:id/desasignar-estudiante
async function desasignarEstudianteAula(req, res) {
    try {
        const { id } = req.params;
        const { estudiante_id } = req.body;
        if (!id || !estudiante_id) {
            return res
                .status(400)
                .json((0, common_response_interface_1.commonResponse)(false, "Faltan datos obligatorios", null, {
                code: "VALIDATION_ERROR",
            }));
        }
        const user = { id: req.user.id, rol: req.user.rol };
        await service.desasignarEstudiante(id, String(estudiante_id), user);
        return res
            .status(200)
            .json((0, common_response_interface_1.commonResponse)(true, "Estudiante desasignado del aula", null));
    }
    catch (error) {
        const message = error.message || "Error al desasignar estudiante del aula";
        console.error("[desasignarEstudianteAula] Error:", error);
        return res
            .status(400)
            .json((0, common_response_interface_1.commonResponse)(false, message, null, { code: "UNASSIGN_ERROR", description: message }));
    }
}
// GET /aulas/:id/estudiantes
async function listAulaEstudiantes(req, res) {
    try {
        const { id } = req.params;
        if (!id) {
            return res
                .status(400)
                .json((0, common_response_interface_1.commonResponse)(false, "Faltan datos obligatorios", null, {
                code: "VALIDATION_ERROR",
            }));
        }
        const user = { id: req.user.id, rol: req.user.rol };
        const data = await service.listEstudiantesAula(id, user);
        return res.status(200).json((0, common_response_interface_1.commonResponse)(true, "ok", data));
    }
    catch (error) {
        const message = error.message || "Error al obtener estudiantes del aula";
        console.error("[listAulaEstudiantes] Error:", error);
        return res
            .status(400)
            .json((0, common_response_interface_1.commonResponse)(false, message, null, {
            code: "LIST_ERROR",
            description: message,
        }));
    }
}
