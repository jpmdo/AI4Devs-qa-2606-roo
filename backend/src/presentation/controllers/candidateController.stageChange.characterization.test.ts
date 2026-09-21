/**
 * CHARACTERIZATION TESTS — candidateController.updateCandidateStageController
 * =============================================================================
 * Parte del flujo de "cambio de fase" de un candidato:
 *   routes/candidateRoutes.ts (PUT /:id)
 *     -> presentation/controllers/candidateController.ts (updateCandidateStageController)  <-- este archivo
 *       -> application/services/candidateService.ts (updateCandidateStage)
 *         -> domain/models/Application.ts
 *
 * Objetivo: documentar el comportamiento REAL del controller frente a
 * distintos payloads y distintos resultados del service (mockeado aquí),
 * incluyendo el manejo de errores tal como está hoy. No se corrige nada.
 *
 * Convención de comentarios:
 *   [CURRENT]    -> comportamiento actual, documentado.
 *   [LEGACY/BUG] -> comportamiento actual que parece incorrecto o riesgoso.
 *
 * No se modificó candidateController.ts ni candidateService.ts para
 * escribir estos tests.
 */

import { updateCandidateStageController } from './candidateController';
import { Request, Response } from 'express';
import { updateCandidateStage } from '../../application/services/candidateService';

jest.mock('../../application/services/candidateService');

function makeRes(): Response {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  } as unknown as Response;
}

describe('candidateController.updateCandidateStageController — characterization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // [CURRENT] Camino feliz: 200 con el shape { message, data }.
  it('[CURRENT] con datos válidos y el service resolviendo, responde 200 con { message, data }', async () => {
    const req = {
      params: { id: '5' },
      body: { applicationId: 1, currentInterviewStep: 200 },
    } as unknown as Request;
    const res = makeRes();

    (updateCandidateStage as jest.Mock).mockResolvedValue({
      id: 1,
      candidateId: 5,
      currentInterviewStep: 200,
    });

    await updateCandidateStageController(req, res);

    expect(updateCandidateStage).toHaveBeenCalledWith(5, 1, 200);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Candidate stage updated successfully',
      data: { id: 1, candidateId: 5, currentInterviewStep: 200 },
    });
  });

  // [LEGACY/BUG] El `id` del candidato (path param) NUNCA se valida con
  // isNaN, a diferencia de applicationId y currentInterviewStep. Si
  // llega no numérico, parseInt produce NaN y el controller lo reenvía
  // igual al service sin cortar la petición con un 400.
  it('[LEGACY/BUG] un :id de candidato no numérico no se rechaza; se reenvía como NaN al service', async () => {
    const req = {
      params: { id: 'abc' },
      body: { applicationId: 1, currentInterviewStep: 200 },
    } as unknown as Request;
    const res = makeRes();

    (updateCandidateStage as jest.Mock).mockResolvedValue({ ok: true });

    await updateCandidateStageController(req, res);

    expect(updateCandidateStage).toHaveBeenCalledWith(NaN, 1, 200);
    // No hay ningún guard: si el service "acepta" NaN, el controller
    // responde 200 igualmente.
    expect(res.status).toHaveBeenCalledWith(200);
  });

  // [CURRENT] applicationId no numérico en el body -> 400. El mensaje de
  // error dice "Invalid position ID format", aunque el campo que se está
  // validando es applicationId, no un id de posición.
  it('[CURRENT] applicationId no numérico responde 400 con un mensaje que menciona "position ID" (etiqueta engañosa)', async () => {
    const req = {
      params: { id: '5' },
      body: { applicationId: 'not-a-number', currentInterviewStep: 200 },
    } as unknown as Request;
    const res = makeRes();

    await updateCandidateStageController(req, res);

    expect(updateCandidateStage).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid position ID format' });
  });

  // [CURRENT] currentInterviewStep no numérico en el body -> 400.
  it('[CURRENT] currentInterviewStep no numérico responde 400', async () => {
    const req = {
      params: { id: '5' },
      body: { applicationId: 1, currentInterviewStep: 'not-a-number' },
    } as unknown as Request;
    const res = makeRes();

    await updateCandidateStageController(req, res);

    expect(updateCandidateStage).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid currentInterviewStep format' });
  });

  // [LEGACY/BUG] El mapeo a 404 depende de una comparación de string
  // EXACTA contra 'Error: Application not found' (con el prefijo
  // "Error:" duplicado, ver candidateService.stageChange.characterization.test.ts).
  // Este test fija ese acoplamiento exacto tal como existe hoy.
  it('[LEGACY/BUG] el service rechazando con el mensaje exacto "Error: Application not found" produce 404', async () => {
    const req = {
      params: { id: '5' },
      body: { applicationId: 999, currentInterviewStep: 200 },
    } as unknown as Request;
    const res = makeRes();

    (updateCandidateStage as jest.Mock).mockRejectedValue(new Error('Error: Application not found'));

    await updateCandidateStageController(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Application not found',
      error: 'Error: Application not found',
    });
  });

  // [LEGACY/BUG] Demuestra la fragilidad del punto anterior: si el
  // mensaje de error NO trae el prefijo "Error:" duplicado (por ejemplo,
  // si en el futuro alguien "arregla" el double-wrap del service sin
  // tocar el controller), el mismo caso semántico de "no encontrado" cae
  // en la rama genérica de 400 en vez de 404.
  it('[LEGACY/BUG] el mismo caso semántico ("Application not found" sin el prefijo duplicado) responde 400, no 404', async () => {
    const req = {
      params: { id: '5' },
      body: { applicationId: 999, currentInterviewStep: 200 },
    } as unknown as Request;
    const res = makeRes();

    (updateCandidateStage as jest.Mock).mockRejectedValue(new Error('Application not found'));

    await updateCandidateStageController(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Error updating candidate stage',
      error: 'Application not found',
    });
  });

  // [CURRENT] Cualquier otro Error del service (por ejemplo, un fallo de
  // base de datos genuino) se traduce siempre a 400, nunca a 500,
  // aunque semánticamente sea un error del servidor.
  it('[CURRENT] cualquier otro Error del service responde 400 (incluso si es un fallo interno real)', async () => {
    const req = {
      params: { id: '5' },
      body: { applicationId: 1, currentInterviewStep: 200 },
    } as unknown as Request;
    const res = makeRes();

    (updateCandidateStage as jest.Mock).mockRejectedValue(new Error('[object Object]'));

    await updateCandidateStageController(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Error updating candidate stage',
      error: '[object Object]',
    });
  });

  // [LEGACY/BUG] Si el service rechaza con un valor que NO es instancia
  // de Error (string u objeto plano), el controller responde 500 con un
  // mensaje genérico "Unknown error", perdiendo cualquier detalle del
  // valor original.
  it('[LEGACY/BUG] un rechazo que no es instancia de Error responde 500 con "Unknown error", perdiendo el detalle original', async () => {
    const req = {
      params: { id: '5' },
      body: { applicationId: 1, currentInterviewStep: 200 },
    } as unknown as Request;
    const res = makeRes();

    (updateCandidateStage as jest.Mock).mockRejectedValue('boom, algo se rompió');

    await updateCandidateStageController(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Error updating candidate stage',
      error: 'Unknown error',
    });
  });
});
