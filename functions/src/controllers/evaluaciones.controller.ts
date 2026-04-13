import { Request, Response } from "express";
import { EvaluacionService } from "../services/evaluaciones.service";
import { commonResponse } from "../interfaces/common-response.interface";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { getPrisma } from "../config/prismaClient";

const service = new EvaluacionService();

export async function createEvaluacion(req: AuthenticatedRequest, res: Response) {
  try {
    const user = { id: req.user!.id, rol: req.user!.rol };

    const data = await service.createEvaluacion(req.body, user);
    res.status(201).json(commonResponse(true, "Evaluación creada con éxito", data));
  } catch (error: any) {
    const message = error.message || "Error al crear evaluación";
    res.status(400).json(commonResponse(false, message, null, { code: "CREATE_ERROR" }));
  }
}

export async function getEvaluaciones(req: AuthenticatedRequest, res: Response) {
  try {
    const { estudianteId, profesorId, salaId, tipoId, estadoId, escuela_id } = req.query;
    const { rol, id: userId, escuela_id: userEscuelaId } = req.user!;

    const filters = {
      estudianteId: typeof estudianteId === "string" ? estudianteId : undefined,
      profesorId: typeof profesorId === "string" ? profesorId : undefined,
      salaId: typeof salaId === "string" ? Number(salaId) : undefined,
      tipoId: typeof tipoId === "string" ? tipoId : undefined,
      estadoId: typeof estadoId === "string" ? estadoId : undefined,
      escuelaId: typeof escuela_id === "string" ? escuela_id : undefined,
    };

    let data;
    // Director: forzar su escuela desde el token, nunca del query param
    if (rol === "director") {
      const escuelaDirector = req.user!.escuela_id;
      if (!escuelaDirector) {
        return res
          .status(400)
          .json(commonResponse(false, "Usted no tiene una escuela asignada.", null, { code: "VALIDATION_ERROR" }));
      }
      filters.escuelaId = escuelaDirector;
    }

    if (rol === "encargado_zona") {
      const prisma = getPrisma();                           
      if (!prisma) throw new Error("DB not available");    
      const prismaAny = prisma as any;                     

      const encargado = await prismaAny.encargados.findUnique({    
          where: { usuario_id: userId },                           
          include: { zona: { include: { escuelas: { select: { id: true } } } } }  
      });                                                          
      const escuelasDeZona: string[] = encargado?.zona?.escuelas.map((e: any) => e.id) ?? [];  

      // Si vino un escuela_id del query, validar que pertenezca a su zona
      if (filters.escuelaId) {                                                        
          if (!escuelasDeZona.includes(filters.escuelaId)) {                          
              return res.status(403).json(commonResponse(false,                       
                  "No tienes permisos para ver evaluaciones de esa escuela.", null)); 
          }                                                                           
          // filters.escuelaId ya está seteado, no hace falta cambiar nada            
      } else {                                                                        
          // Sin filtro de escuela: restringir a todas las escuelas de la zona        
          (filters as any).escuelaIds = escuelasDeZona;                               
      }                                                                               
  }

    // Docente puede listar por profesorId (mis evaluaciones) o por escuela.
    if (rol === "docente" && !filters.escuelaId && !filters.profesorId) {
      return res
        .status(400)
        .json(commonResponse(false, "Faltan filtros para listar evaluaciones del docente.", null, { code: "VALIDATION_ERROR" }));
    }
    data = await service.listWithFilters(filters);

    res.status(200).json(commonResponse(true, "ok", data));
  } catch (error: any) {
    res.status(500).json(commonResponse(false, error.message, null, { code: "INTERNAL_ERROR" }));
  }
}

export async function getEvaluacionById(req: AuthenticatedRequest, res: Response) {
  try {
    const { rol, id: userId, escuela_id: userEscuelaId } = req.user!;
    const data = await service.getDetalle(req.params.id);

    // Scope check: docente solo ve sus propias evaluaciones; director solo las de su escuela
    if (rol === "docente" && data.profesor_id !== userId) {
      return res.status(403).json(commonResponse(false, "No tienes permisos para ver esta evaluación.", null));
    }
    if (rol === "director" && userEscuelaId) {
      const escuelaEvaluacion = (data as any).estudiantes?.escuela_id ?? (data as any).escuela_id;
      if (escuelaEvaluacion && escuelaEvaluacion !== userEscuelaId) {
        return res.status(403).json(commonResponse(false, "No tienes permisos para ver esta evaluación.", null));
      }
    }
    // Encargado de Zona: solo puede ver evaluaciones de escuelas de su zona  
    if (rol === "encargado_zona") {                                            
      const escuelaEvaluacion = (data as any).estudiantes?.escuela_id;        
      if (escuelaEvaluacion) {                                                 
        const prisma = getPrisma();                                            
        if (!prisma) throw new Error("DB not available");                     
        const encargado = await (prisma as any).encargados.findUnique({       
          where: { usuario_id: userId },                                      
          include: { zona: { include: { escuelas: { select: { id: true } } } } }  
        });                                                                    
        const escuelasDeZona: string[] = encargado?.zona?.escuelas.map((e: any) => e.id) ?? [];  
        if (!escuelasDeZona.includes(escuelaEvaluacion)) {                    
          return res.status(403).json(commonResponse(false, "No tienes permisos para ver esta evaluación.", null));  
        }                                                                      
      }                                                                        
    }    

    res.status(200).json(commonResponse(true, "ok", data));
  } catch (error: any) {
    res.status(404).json(commonResponse(false, "Evaluación no encontrada", null));
  }
}

export async function deleteEvaluacion(req: AuthenticatedRequest, res: Response) {
  try {
    const user = { id: req.user!.id, rol: req.user!.rol };

    await service.remove(req.params.id, user);
    res.status(200).json(commonResponse(true, "Evaluación eliminada", null));
  } catch (error: any) {
    const msg = error?.message || "Error al eliminar la evaluación";
    const status = msg.includes("no existe") ? 404 : 500;
    res.status(status).json(commonResponse(false, msg, null));
  }
}

export async function getPreguntasDeArea(req: AuthenticatedRequest, res: Response) {
  try {
    const { id, areaId } = req.params;
    const data = await service.getPreguntasArea(id, areaId);
    res.status(200).json(commonResponse(true, "ok", data));
  } catch (error: any) {
    res.status(400).json(commonResponse(false, error.message, null));
  }
}


export async function guardarRespuestasArea(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params; //evaluacionId
    const { areaId, questions } = req.body;

    const data = await service.guardarRespuestas(id, areaId, questions);

    res.status(200).json(commonResponse(true, "ok", data));
  } catch (error: any) {
    res.status(400).json(commonResponse(false, error.message, null));
  }
}