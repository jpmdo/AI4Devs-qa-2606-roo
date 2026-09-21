// @ts-nocheck
/**
 * CHARACTERIZATION TESTS — frontend/src/components/PositionDetails.js
 * =====================================================================
 * Objetivo: documentar el comportamiento REAL y actual del componente,
 * incluyendo bugs conocidos, para tener una red de seguridad antes de
 * corregir nada. NINGÚN test aquí afirma "esto es lo correcto"; afirman
 * "esto es lo que el código hace hoy".
 *
 * Estado de este archivo (importante, léase antes de ejecutar):
 * - No se ha modificado `PositionDetails.js` ni ningún otro archivo de
 *   `frontend/src` (aparte de este propio spec, y de la config de Jest
 *   necesaria para poder ejecutarlo).
 * - Originalmente se escribió en `jpm-prompts/position.characterization.spec.ts`
 *   porque el runner de tests del frontend estaba roto (faltaba
 *   `frontend/jest.config.js`). Se movió después a esta ubicación
 *   (`frontend/src/components/`) y se corrigieron las rutas relativas de
 *   import que dependían de la ubicación anterior.
 * - Se mantiene `React.createElement` en vez de JSX porque el archivo
 *   conserva la extensión `.ts` (no `.tsx`), tal como se pidió su nombre.
 * - Dependencias asumidas (ya presentes en `frontend/package.json`):
 *   `@testing-library/react`, `@testing-library/jest-dom`, `react`,
 *   `react-dom`, `react-router-dom`, `react-bootstrap`,
 *   `react-beautiful-dnd`.
 *
 * Convención de comentarios en cada test:
 *   [CURRENT]      -> comportamiento actual, no necesariamente incorrecto,
 *                      pero documentado porque un fix podría cambiarlo.
 *   [LEGACY/BUG]   -> comportamiento actual que parece incorrecto/riesgoso.
 *                      Se documenta TAL COMO ESTÁ, no se corrige aquí.
 */

import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// ---------------------------------------------------------------------
// Mocks de módulos externos (no se toca PositionDetails.js)
// ---------------------------------------------------------------------

// react-router-dom: capturamos useParams/useNavigate para controlarlos
// por test.
jest.mock('react-router-dom', () => ({
  useParams: jest.fn(),
  useNavigate: jest.fn(),
}));
import { useParams, useNavigate } from 'react-router-dom';

// react-beautiful-dnd: PositionDetails.js (via StageColumn/CandidateCard)
// usa DragDropContext/Droppable/Draggable. Probar drag&drop real con RTL
// es frágil; en su lugar capturamos el callback onDragEnd que el
// componente registra, y simplificamos Droppable/Draggable para que solo
// rendericen sus children. Esto no cambia el comportamiento del
// componente, solo el entorno de test.
let capturedOnDragEnd: ((result: any) => void) | null = null;

jest.mock('react-beautiful-dnd', () => {
  const ReactActual = require('react');
  return {
    DragDropContext: ({ onDragEnd, children }: any) => {
      capturedOnDragEnd = onDragEnd;
      return children;
    },
    Droppable: ({ children }: any) => {
      const provided = {
        innerRef: () => {},
        droppableProps: {},
        placeholder: null,
      };
      return children(provided);
    },
    Draggable: ({ children }: any) => {
      const provided = {
        innerRef: () => {},
        draggableProps: {},
        dragHandleProps: {},
      };
      return children(provided);
    },
  };
});

// CandidateDetails: se mockea para aislar PositionDetails.js de un
// componente cuyo código interno no fue analizado en esta tarea. Solo
// nos interesa que PositionDetails le pase el candidato seleccionado y
// un onClose correcto.
jest.mock('./CandidateDetails', () => ({
  __esModule: true,
  default: ({ candidate, onClose }: any) => {
    const ReactActual = require('react');
    if (!candidate) return null;
    return ReactActual.createElement(
      'div',
      { 'data-testid': 'candidate-details', onClick: onClose },
      `Detalle de: ${candidate.name}`
    );
  },
}));

// Import real del componente bajo prueba (después de declarar los mocks).
import PositionDetails from './PositionDetails';

// ---------------------------------------------------------------------
// Fixtures — reflejan el contrato REAL observado en el backend
// (positionService.ts / positionController.ts), no el contrato ideal.
// ---------------------------------------------------------------------

const FLOW_RESPONSE_BODY = {
  interviewFlow: {
    positionName: 'Senior Backend Engineer',
    interviewFlow: {
      id: 1,
      description: 'Flujo estándar',
      interviewSteps: [
        { id: 100, interviewFlowId: 1, interviewTypeId: 1, name: 'Screening', orderIndex: 0 },
        { id: 200, interviewFlowId: 1, interviewTypeId: 2, name: 'Technical Interview', orderIndex: 1 },
      ],
    },
  },
};

const CANDIDATES_RESPONSE_BODY = [
  {
    fullName: 'Ada Lovelace',
    currentInterviewStep: 'Screening', // coincide por NOMBRE con stage.title, no por id
    candidateId: 5,
    applicationId: 55,
    averageScore: 4,
  },
];

function deferred<T = any>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function okJson(body: any) {
  return Promise.resolve({ ok: true, json: async () => body });
}

function mockSimpleFetch({
  flowBody = FLOW_RESPONSE_BODY,
  candidatesBody = CANDIDATES_RESPONSE_BODY,
  putOk = true,
}: { flowBody?: any; candidatesBody?: any; putOk?: boolean } = {}) {
  (global.fetch as jest.Mock).mockImplementation((url: string, init?: any) => {
    if (init && init.method === 'PUT') {
      return Promise.resolve({ ok: putOk, json: async () => ({}) });
    }
    if (typeof url === 'string' && url.includes('interviewFlow')) {
      return okJson(flowBody);
    }
    return okJson(candidatesBody);
  });
}

function renderPositionDetails() {
  return render(React.createElement(PositionDetails));
}

// PositionDetails.js no está envuelto en ningún ErrorBoundary en la app
// real (no existe ninguno en todo el frontend). Eso significa que, hoy,
// un throw durante el render de este componente se propaga como una
// excepción global no controlada (pantalla en blanco para el usuario).
// Para poder OBSERVAR ese crash de forma determinística en un test (sin
// que la excepción escape como un error no manejado del entorno de
// Jest/jsdom), se envuelve aquí con un ErrorBoundary mínimo, solo para
// esta suite de tests. Esto no cambia el comportamiento de la app real:
// solo hace visible, dentro del test, algo que en producción sería un
// crash silencioso de pantalla en blanco.
class TestOnlyErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch() {
    // Intencionalmente vacío: no queremos ruido adicional en consola,
    // console.error ya está espiado/silenciado por test.
  }
  render() {
    if (this.state.error) {
      return React.createElement(
        'div',
        { 'data-testid': 'test-only-error-boundary' },
        this.state.error.message
      );
    }
    return this.props.children;
  }
}

function renderPositionDetailsCapturingCrash() {
  return render(
    React.createElement(TestOnlyErrorBoundary, null, React.createElement(PositionDetails))
  );
}

// ---------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------

describe('PositionDetails.js — characterization tests (comportamiento actual)', () => {
  let consoleErrorSpy: jest.SpyInstance;
  let navigateMock: jest.Mock;

  beforeEach(() => {
    jest.resetAllMocks();
    capturedOnDragEnd = null;
    global.fetch = jest.fn();
    navigateMock = jest.fn();
    (useParams as jest.Mock).mockReturnValue({ id: '10' });
    (useNavigate as jest.Mock).mockReturnValue(navigateMock);
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  // [CURRENT] Estado inicial: antes de que resuelva cualquier fetch, no
  // hay columnas ni título. No hay loading spinner ni placeholder.
  test('[CURRENT] antes de que resuelvan los fetch, no renderiza columnas ni título', () => {
    const flowDeferred = deferred();
    const candidatesDeferred = deferred();
    (global.fetch as jest.Mock).mockImplementation((url: string) =>
      url.includes('interviewFlow') ? flowDeferred.promise : candidatesDeferred.promise
    );

    renderPositionDetails();

    expect(screen.queryByText('Senior Backend Engineer')).not.toBeInTheDocument();
    expect(screen.queryByText('Screening')).not.toBeInTheDocument();
    // No hay ningún indicador de carga: el h2 existe pero vacío.
    expect(document.querySelector('h2')?.textContent).toBe('');
  });

  // [CURRENT] Camino feliz DEPENDIENTE DEL ORDEN de resolución de red
  // (ver siguiente test para el caso contrario, que es un bug).
  test('[CURRENT] si interviewFlow resuelve antes que candidates, el candidato aparece en su columna', async () => {
    mockSimpleFetch();

    renderPositionDetails();

    await waitFor(() => expect(screen.getByText('Senior Backend Engineer')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Ada Lovelace')).toBeInTheDocument());

    expect(screen.getByText('Screening')).toBeInTheDocument();
    expect(screen.getByText('Technical Interview')).toBeInTheDocument();
  });

  // [LEGACY/BUG] Race condition real (ya documentada en
  // jpm-prompts/analisis-preliminar.md): fetchInterviewFlow y
  // fetchCandidates corren en paralelo sin coordinación. Si la respuesta
  // de /candidates llega y se procesa ANTES que la de /interviewFlow, el
  // setStages funcional de fetchCandidates mapea sobre un array vacío
  // (estado inicial) y el resultado se pierde cuando fetchInterviewFlow
  // sobrescribe stages después. El candidato desaparece silenciosamente,
  // sin ningún error visible.
  test('[LEGACY/BUG] si candidates resuelve antes que interviewFlow, el candidato se pierde silenciosamente', async () => {
    const flowDeferred = deferred();
    const candidatesDeferred = deferred();
    (global.fetch as jest.Mock).mockImplementation((url: string) =>
      url.includes('interviewFlow') ? flowDeferred.promise : candidatesDeferred.promise
    );

    renderPositionDetails();

    // 1) Resolvemos candidates PRIMERO.
    await act(async () => {
      candidatesDeferred.resolve({ ok: true, json: async () => CANDIDATES_RESPONSE_BODY });
      await Promise.resolve();
      await Promise.resolve();
    });

    // 2) Resolvemos interviewFlow DESPUÉS.
    await act(async () => {
      flowDeferred.resolve({ ok: true, json: async () => FLOW_RESPONSE_BODY });
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => expect(screen.getByText('Senior Backend Engineer')).toBeInTheDocument());

    // Las columnas sí existen (vienen del flow, que resolvió último y
    // sobrescribió todo)...
    expect(screen.getByText('Screening')).toBeInTheDocument();
    // ...pero el candidato NO aparece en ningún lado. Esto es el bug.
    expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument();
  });

  // [LEGACY/BUG] Ni fetchInterviewFlow ni fetchCandidates comprueban
  // `response.ok`. Si el backend responde con un body de error (ej.
  // { message, error }) pero con un status no controlado explícitamente,
  // el código intenta leer `data.interviewFlow.interviewFlow...` sobre
  // `undefined`, lanza un TypeError, y ese TypeError se captura en el
  // catch silencioso (`console.error`), sin mostrar nada al usuario.
  test('[LEGACY/BUG] una respuesta de error en /interviewFlow se traga en silencio (sin mensaje al usuario)', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('interviewFlow')) {
        // Forma real de un error del backend (positionController.ts):
        // { message: 'Position not found', error: '...' }
        return okJson({ message: 'Position not found', error: 'Position not found' });
      }
      return okJson(CANDIDATES_RESPONSE_BODY);
    });

    renderPositionDetails();

    await waitFor(() => expect(consoleErrorSpy).toHaveBeenCalled());

    // El título queda vacío para siempre, sin mensaje de error visible.
    expect(document.querySelector('h2')?.textContent).toBe('');
    expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument();
  });

  // [LEGACY/BUG] *** CORREGIDO tras ejecutar el test contra el código real ***
  // La hipótesis original (por lectura del código, sin ejecutar) era que
  // esto se comportaría igual que el caso de /interviewFlow: un throw
  // silencioso capturado por el catch local. Al EJECUTAR el test contra
  // el componente real, el resultado fue distinto y más grave: un
  // `TypeError` no controlado que crashea el render.
  //
  // Causa raíz (confirmada por el stack trace del fallo real):
  // en fetchInterviewFlow, `interviewSteps` se calcula de forma EAGER,
  // dentro del cuerpo async, antes de llamar a `setStages(interviewSteps)`
  // -> si falla, el throw ocurre dentro del try/catch local.
  // En fetchCandidates, en cambio, el `.filter(...)` que puede fallar
  // vive DENTRO del callback funcional pasado a
  // `setStages(prevStages => prevStages.map(...))`. React NO ejecuta ese
  // callback en el momento de la llamada: lo ejecuta después, durante el
  // render/reconciliación. Por lo tanto, si `candidates` no es un array,
  // el TypeError se lanza FUERA del try/catch de fetchCandidates, como un
  // error de render no controlado. Sin ErrorBoundary, React 18 desmonta
  // todo el árbol — incluido contenido que ya se había pintado
  // correctamente desde la otra petición (el nombre de la posición).
  test('[LEGACY/BUG] una respuesta con forma inesperada en /candidates crashea el render completo (no se maneja como error, no es "silencioso")', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('interviewFlow')) return okJson(FLOW_RESPONSE_BODY);
      return okJson({ message: 'Error retrieving candidates', error: 'boom' });
    });

    // Se usa el ErrorBoundary de prueba (ver renderPositionDetailsCapturingCrash)
    // porque el árbol REAL de la app no tiene ninguno: sin él, esta misma
    // excepción escaparía como un error global no controlado y dejaría
    // al usuario con una pantalla en blanco.
    renderPositionDetailsCapturingCrash();

    // El botón "Volver a Posiciones" no depende de ningún fetch: está en
    // el render inicial siempre. Sirve como testigo de que el árbol de
    // React sigue vivo antes del crash.
    expect(screen.getByRole('button', { name: /volver a posiciones/i })).toBeInTheDocument();

    // En cuanto resuelve /candidates con esta forma, el TypeError escapa
    // del try/catch local de fetchCandidates (ver comentario arriba) y es
    // atrapado por el ErrorBoundary de prueba. El botón, que no depende
    // de datos de candidatos, desaparece igual, porque TODO el árbol bajo
    // el boundary se reemplaza por su fallback.
    await waitFor(() =>
      expect(screen.getByTestId('test-only-error-boundary')).toBeInTheDocument()
    );
    expect(screen.getByTestId('test-only-error-boundary').textContent).toBe(
      'candidates.filter is not a function'
    );
    expect(screen.queryByRole('button', { name: /volver a posiciones/i })).not.toBeInTheDocument();
  });

  // [LEGACY/BUG] `id` viene de useParams() sin validar. Si falta,
  // se interpola literalmente "undefined" en la URL.
  test('[LEGACY/BUG] si useParams no entrega id, la URL solicitada contiene el literal "undefined"', async () => {
    (useParams as jest.Mock).mockReturnValue({});
    mockSimpleFetch();

    renderPositionDetails();

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));

    const calledUrls = (global.fetch as jest.Mock).mock.calls.map((c) => c[0]);
    expect(calledUrls.some((u) => u.includes('/positions/undefined/interviewFlow'))).toBe(true);
    expect(calledUrls.some((u) => u.includes('/positions/undefined/candidates'))).toBe(true);
  });

  // [CURRENT] Botón "Volver a Posiciones" navega a /positions.
  test('[CURRENT] el botón "Volver a Posiciones" llama a navigate("/positions")', async () => {
    mockSimpleFetch();
    renderPositionDetails();

    await waitFor(() => expect(screen.getByText('Senior Backend Engineer')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /volver a posiciones/i }));

    expect(navigateMock).toHaveBeenCalledWith('/positions');
  });

  // [CURRENT] Click en una tarjeta de candidato abre CandidateDetails con
  // ese candidato; el onClose de CandidateDetails vuelve a null.
  test('[CURRENT] click en una tarjeta de candidato muestra CandidateDetails, y su onClose lo oculta', async () => {
    mockSimpleFetch();
    renderPositionDetails();

    await waitFor(() => expect(screen.getByText('Ada Lovelace')).toBeInTheDocument());

    expect(screen.queryByTestId('candidate-details')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Ada Lovelace'));

    expect(screen.getByTestId('candidate-details')).toHaveTextContent('Ada Lovelace');

    fireEvent.click(screen.getByTestId('candidate-details'));

    expect(screen.queryByTestId('candidate-details')).not.toBeInTheDocument();
  });

  describe('onDragEnd — capturado vía mock de react-beautiful-dnd', () => {
    // [CURRENT] Si react-beautiful-dnd entrega `destination: null` (soltado
    // fuera de cualquier columna), la función retorna temprano: no hay
    // mutación de estado ni llamada de red.
    test('[CURRENT] sin destination, no cambia el estado ni llama al PUT', async () => {
      mockSimpleFetch();
      renderPositionDetails();
      await waitFor(() => expect(screen.getByText('Ada Lovelace')).toBeInTheDocument());

      const fetchCallsBefore = (global.fetch as jest.Mock).mock.calls.length;

      act(() => {
        capturedOnDragEnd!({
          source: { droppableId: '0', index: 0 },
          destination: null,
        });
      });

      expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
      expect((global.fetch as jest.Mock).mock.calls).toHaveLength(fetchCallsBefore);
    });

    // [LEGACY/BUG] Actualización optimista: la UI se mueve de columna
    // de forma SÍNCRONA, antes de que el PUT siquiera resuelva. Esto es
    // "current behavior", documentado tal cual, no una corrección.
    test('[CURRENT] mover una tarjeta actualiza la UI de inmediato, antes de que el PUT resuelva', async () => {
      const putDeferred = deferred();
      (global.fetch as jest.Mock).mockImplementation((url: string, init?: any) => {
        if (init && init.method === 'PUT') return putDeferred.promise; // nunca resuelto en este test
        if (url.includes('interviewFlow')) return okJson(FLOW_RESPONSE_BODY);
        return okJson(CANDIDATES_RESPONSE_BODY);
      });

      renderPositionDetails();
      await waitFor(() => expect(screen.getByText('Ada Lovelace')).toBeInTheDocument());

      act(() => {
        capturedOnDragEnd!({
          source: { droppableId: '0', index: 0 },
          destination: { droppableId: '1', index: 0 },
        });
      });

      // El candidato ya aparece bajo la columna "Technical Interview"
      // (segundo Droppable) aunque el PUT sigue pendiente.
      const technicalColumn = screen.getByText('Technical Interview').closest('.card');
      expect(technicalColumn).not.toBeNull();
      expect(technicalColumn && technicalColumn.textContent).toContain('Ada Lovelace');
    });

    // [CURRENT] Verifica el payload exacto enviado al backend al mover
    // de fase: applicationId y currentInterviewStep = id numérico del
    // stage destino (NO su nombre).
    test('[CURRENT] mover una tarjeta llama PUT /candidates/:id con applicationId y el id numérico del stage destino', async () => {
      mockSimpleFetch();
      renderPositionDetails();
      await waitFor(() => expect(screen.getByText('Ada Lovelace')).toBeInTheDocument());

      act(() => {
        capturedOnDragEnd!({
          source: { droppableId: '0', index: 0 },
          destination: { droppableId: '1', index: 0 },
        });
      });

      await waitFor(() => {
        const putCall = (global.fetch as jest.Mock).mock.calls.find(
          (c) => c[1] && c[1].method === 'PUT'
        );
        expect(putCall).toBeDefined();
      });

      const putCall = (global.fetch as jest.Mock).mock.calls.find(
        (c) => c[1] && c[1].method === 'PUT'
      )!;
      expect(putCall[0]).toBe('http://localhost:3010/candidates/5'); // candidateId
      expect(JSON.parse(putCall[1].body)).toEqual({
        applicationId: 55,
        currentInterviewStep: 200, // id del stage "Technical Interview"
      });
    });

    // [LEGACY/BUG] El hallazgo más importante de este bloque: si el PUT
    // falla (network error o response.ok === false), NO hay rollback.
    // La tarjeta se queda en la columna destino como si el cambio se
    // hubiera guardado, aunque el backend nunca lo persistió. Solo se
    // hace console.error.
    test('[LEGACY/BUG] si el PUT falla, la tarjeta NO vuelve a su columna original (no hay rollback)', async () => {
      (global.fetch as jest.Mock).mockImplementation((url: string, init?: any) => {
        if (init && init.method === 'PUT') return Promise.resolve({ ok: false });
        if (url.includes('interviewFlow')) return okJson(FLOW_RESPONSE_BODY);
        return okJson(CANDIDATES_RESPONSE_BODY);
      });

      renderPositionDetails();
      await waitFor(() => expect(screen.getByText('Ada Lovelace')).toBeInTheDocument());

      act(() => {
        capturedOnDragEnd!({
          source: { droppableId: '0', index: 0 },
          destination: { droppableId: '1', index: 0 },
        });
      });

      // Esperamos a que el catch interno de updateCandidateStep corra.
      await waitFor(() => expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error updating candidate step:',
        expect.any(Error)
      ));

      const screeningColumn = screen.getByText('Screening').closest('.card');
      const technicalColumn = screen.getByText('Technical Interview').closest('.card');

      // Bug documentado: sigue en la columna destino...
      expect(technicalColumn && technicalColumn.textContent).toContain('Ada Lovelace');
      // ...y NO volvió a la columna de origen.
      expect(screeningColumn && screeningColumn.textContent).not.toContain('Ada Lovelace');
    });
  });
});

/**
 * OBSERVACIONES ADICIONALES (no convertidas en test, por desproporción
 * esfuerzo/valor en esta etapa, pero relevantes para la corrección):
 *
 * - `stages.map((stage, index) => <StageColumn key={index} .../>)` usa el
 *   índice del array como key. Es un antipatrón de React; no se probó
 *   directamente porque requeriría forzar una reordenación de stages
 *   entre renders para observar un efecto visible, lo cual no ocurre hoy
 *   en el flujo normal del componente.
 * - `import { Offcanvas } from 'react-bootstrap'` nunca se usa en el JSX.
 *   Import muerto, sin efecto funcional.
 * - La mutación de `sourceStage.candidates` / `destStage.candidates` vía
 *   `.splice()` ocurre directamente sobre los objetos ya presentes en el
 *   state de React, antes de llamar `setStages([...stages])`. No se probó
 *   como unidad aislada porque es un detalle interno; su efecto
 *   observable ya está cubierto por los tests de "mover una tarjeta".
 */
