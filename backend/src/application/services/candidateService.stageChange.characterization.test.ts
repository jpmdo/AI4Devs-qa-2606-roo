/**
 * CHARACTERIZATION TESTS — candidateService.updateCandidateStage
 * =================================================================
 * Parte del flujo de "cambio de fase" de un candidato:
 *   routes/candidateRoutes.ts (PUT /:id)
 *     -> presentation/controllers/candidateController.ts (updateCandidateStageController)
 *       -> application/services/candidateService.ts (updateCandidateStage)   <-- este archivo
 *         -> domain/models/Application.ts (findOneByPositionCandidateId, save)
 *
 * Objetivo: documentar el comportamiento REAL de `updateCandidateStage`,
 * incluyendo detalles frágiles o incorrectos, ANTES de corregir nada.
 * Ningún test aquí prescribe cuál debería ser el comportamiento correcto;
 * solo fija el comportamiento actual como red de seguridad.
 *
 * Convención de comentarios:
 *   [CURRENT]    -> comportamiento actual, documentado, no necesariamente
 *                    incorrecto pero puede cambiar con una corrección.
 *   [LEGACY/BUG] -> comportamiento actual que parece incorrecto o riesgoso.
 *                    Se documenta tal cual, no se corrige aquí.
 *
 * No se modificó candidateService.ts, candidateController.ts, ni
 * Application.ts para escribir estos tests.
 */

import { updateCandidateStage } from './candidateService';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

jest.mock('@prisma/client', () => {
  const mockPrisma = {
    application: {
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
  };
  return { PrismaClient: jest.fn(() => mockPrisma) };
});

function baseApplicationRow(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 1,
    positionId: 10,
    candidateId: 5,
    applicationDate: new Date('2024-01-01T00:00:00.000Z'),
    currentInterviewStep: 100,
    notes: 'nota original',
    ...overrides,
  };
}

describe('candidateService.updateCandidateStage — characterization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // [CURRENT] Camino feliz: busca la Application por (applicationId,
  // candidateId), y persiste TODOS los campos de la entidad, no solo
  // `currentInterviewStep`. Esto es "full overwrite" en cada guardado.
  it('[CURRENT] busca por (applicationId, candidateId) y guarda TODOS los campos de la Application, no solo currentInterviewStep', async () => {
    const row = baseApplicationRow();
    (prisma.application.findFirst as jest.Mock).mockResolvedValue(row);
    (prisma.application.update as jest.Mock).mockResolvedValue({
      ...row,
      currentInterviewStep: 200,
    });

    const result = await updateCandidateStage(5, 1, 200);

    expect(prisma.application.findFirst).toHaveBeenCalledWith({
      where: { id: 1, candidateId: 5 },
    });

    // El update reenvía positionId, candidateId, applicationDate y notes
    // sin cambios, aunque solo currentInterviewStep fue modificado.
    expect(prisma.application.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        positionId: row.positionId,
        candidateId: row.candidateId,
        applicationDate: row.applicationDate,
        currentInterviewStep: 200,
        notes: row.notes,
      },
    });

    expect(result.currentInterviewStep).toBe(200);
  });

  // [LEGACY/BUG] Cuando la Application no existe, el service lanza
  // `new Error('Application not found')`, pero el catch la vuelve a
  // envolver como `new Error(error)`. Como `String(new Error('X'))` es
  // `"Error: X"`, el mensaje final termina siendo literalmente
  // "Error: Application not found" (con el prefijo "Error:" duplicado
  // dentro del mensaje). El controller depende de este string EXACTO
  // para devolver 404 — es un acoplamiento frágil, no un contrato
  // explícito.
  it('[LEGACY/BUG] Application no encontrada produce un mensaje con "Error:" duplicado: "Error: Application not found"', async () => {
    (prisma.application.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(updateCandidateStage(5, 999, 200)).rejects.toThrow(
      'Error: Application not found'
    );

    try {
      await updateCandidateStage(5, 999, 200);
      fail('se esperaba que updateCandidateStage lanzara un error');
    } catch (error: any) {
      expect(error.message).toBe('Error: Application not found');
    }

    expect(prisma.application.update).not.toHaveBeenCalled();
  });

  // [LEGACY/BUG] Si Prisma (u otra capa) rechaza con un objeto plano que
  // no es una instancia de Error (p. ej. un error con forma de
  // PrismaClientKnownRequestError simulado como objeto literal), el
  // `throw new Error(error)` del catch pierde TODA la información útil:
  // el mensaje final es literalmente el string "[object Object]",
  // porque `new Error(obj)` hace `String(obj)` internamente y un objeto
  // plano sin `toString` propio serializa así. Se pierde `code`,
  // `message` original, y cualquier metadata de diagnóstico.
  it('[LEGACY/BUG] un error no-Error lanzado por Prisma se convierte en el string inútil "[object Object]"', async () => {
    const row = baseApplicationRow();
    (prisma.application.findFirst as jest.Mock).mockResolvedValue(row);
    (prisma.application.update as jest.Mock).mockRejectedValue({
      code: 'P2003',
      message: 'Foreign key constraint failed on the field: currentInterviewStep',
    });

    await expect(updateCandidateStage(5, 1, 999999)).rejects.toThrow('[object Object]');
  });

  // [LEGACY/BUG] El candidateId (`id`) que llega a este service no se
  // valida en ningún punto: si llega NaN (por ejemplo, porque vino de un
  // parseInt de un path param no numérico en el controller), se propaga
  // sin guardas hasta el `where` de Prisma tal cual.
  it('[LEGACY/BUG] un candidateId inválido (NaN) se pasa sin validar directamente al where de Prisma', async () => {
    (prisma.application.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(updateCandidateStage(NaN, 1, 200)).rejects.toThrow();

    expect(prisma.application.findFirst).toHaveBeenCalledWith({
      where: { id: 1, candidateId: NaN },
    });
  });

  // [LEGACY/BUG] No existe ninguna regla de negocio que valide que
  // `currentInterviewStep` sea un id de InterviewStep real, ni que
  // pertenezca al interviewFlow de la posición de esta Application. El
  // service acepta cualquier número entero y lo persiste tal cual; la
  // única barrera posible sería una constraint de base de datos (FK),
  // que este test NO ejercita porque `prisma.application.update` está
  // mockeado (a nivel unitario, Prisma "acepta" cualquier valor).
  it('[LEGACY/BUG] acepta y persiste cualquier currentInterviewStep sin validar que exista o pertenezca al flujo de la posición', async () => {
    const row = baseApplicationRow();
    (prisma.application.findFirst as jest.Mock).mockResolvedValue(row);
    (prisma.application.update as jest.Mock).mockResolvedValue({
      ...row,
      currentInterviewStep: -999,
    });

    const result = await updateCandidateStage(5, 1, -999);

    expect(prisma.application.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ currentInterviewStep: -999 }) })
    );
    expect(result.currentInterviewStep).toBe(-999);
  });
});
