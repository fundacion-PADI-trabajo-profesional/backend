/**
 * Valida INV1: la sala del alumno debe coincidir con la sala del aula.
 * Sin excepciones (incluyendo aulas Multiedad).
 *
 * @throws Error 400-compatible si los sala_id no coinciden.
 */
export function validarSalaCompatible(
    estudianteSalaId: number,
    aulaSalaId: number,
    meta?: { aulaComision?: string },
): void {
    if (estudianteSalaId !== aulaSalaId) {
        const ref = meta?.aulaComision ? ` (comisión: ${meta.aulaComision})` : "";
        throw new Error(
            `Sala incompatible: el alumno pertenece a la sala ${estudianteSalaId} ` +
            `pero el aula${ref} corresponde a la sala ${aulaSalaId}.`,
        );
    }
}

/**
 * Inscribe a un alumno en un aula aplicando INV2 e INV3.
 *
 * INV3 (idempotencia): si ya está activo en esa aula, devuelve el registro sin tocar nada.
 * INV2 (un aula activa): cierra cualquier inscripción activa en otra aula antes de crear.
 *
 * No valida INV1 — el caller debe llamar a validarSalaCompatible antes.
 *
 * @returns { registro, creada } — creada=false si era idempotente.
 */
export async function inscribirConTraslado(
    tx: any,
    estudianteId: string,
    aulaId: string,
): Promise<{ registro: any; creada: boolean }> {
    // INV3: ya activo en esta misma aula → no-op
    const yaActiva = await tx.estudiantesAulas.findFirst({
        where: { estudiante_id: estudianteId, aula_id: aulaId, fecha_fin: null },
    })
    if (yaActiva) return { registro: yaActiva, creada: false }

    // INV2: cerrar cualquier inscripción activa en otra aula
    await tx.estudiantesAulas.updateMany({
        where: { estudiante_id: estudianteId, fecha_fin: null },
        data: { fecha_fin: new Date() },
    })

    const registro = await tx.estudiantesAulas.create({
        data: { estudiante_id: estudianteId, aula_id: aulaId, fecha_inicio: new Date() },
    })
    return { registro, creada: true }
}
