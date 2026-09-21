/**
 * E2E — Página de detalle de una Position (Kanban de candidatos)
 * =================================================================
 * Cubre:
 *   Escenario 1: carga de la página de Position.
 *   Escenario 2: cambio de fase de un candidato (drag & drop).
 *
 * Selectores: se usan atributos `data-cy` agregados a
 * PositionDetails.js / StageColumn.js / CandidateCard.js
 * específicamente para esta suite (no existían antes). Se prefieren
 * sobre clases de Bootstrap (`.card-header`, `.card-title`) o texto,
 * para que la suite no se rompa ante un cambio puramente visual/de
 * librería de UI. La excepción es el drag & drop: el origen/destino se
 * identifica con el MISMO nodo DOM que ya lleva `data-cy`, así que no
 * hace falta depender de los atributos internos de `react-beautiful-dnd`
 * (`data-rbd-*`) para eso.
 *
 * Decisión de diseño: las llamadas de red al backend se interceptan con
 * `cy.intercept` en vez de depender de un backend + Postgres reales con
 * datos sembrados. Motivos:
 *   - Determinismo: el propio flujo real de esta página tiene una
 *     condición de carrera conocida entre sus dos GET iniciales (ver
 *     jpm-prompts/findings-04a-characterization-position.md); stubear
 *     controla el orden de resolución y evita que la suite de E2E
 *     herede esa intermitencia como "flakiness" del test.
 *   - No requiere Docker/Postgres/seed corriendo para poder ejecutarse.
 *   - Sigue siendo un test de navegador real: renderiza componentes
 *     reales, hace un drag real, y verifica el request HTTP real que el
 *     frontend construye y envía.
 * Si se quiere una variante contra el backend real, hay que: levantar
 * docker-compose, migrar/seedear Postgres con un position/candidate que
 * coincida con los ids usados aquí, correr el backend en :3010, y
 * reemplazar los `cy.intercept` por `cy.wait` sobre las rutas reales.
 *
 * Nota de contrato: el endpoint real es `PUT /candidates/:id` (plural),
 * no `/candidate/:id` — confirmado en
 * backend/src/routes/candidateRoutes.ts.
 */

const POSITION_ID = 1;

describe('Position detail — /positions/:id', () => {
  beforeEach(() => {
    // *** Nota de estabilización, NO una corrección del bug ***
    // PositionDetails.js dispara fetchInterviewFlow() y fetchCandidates()
    // en paralelo, sin coordinación. fetchCandidates hace un setStages
    // FUNCIONAL que depende de que fetchInterviewFlow ya haya poblado
    // `stages`; si la respuesta de /candidates se procesa antes que la de
    // /interviewFlow, los candidatos se pierden en silencio (condición de
    // carrera real, ya documentada y con test dedicado en
    // jpm-prompts/findings-04a-characterization-position.md, hallazgo #3).
    // Se comprobó ejecutando esta misma suite repetidas veces: sin este
    // `delay`, los tests de Escenario 1 y 2 fallan de forma intermitente
    // porque, en un navegador real, el orden de resolución entre dos
    // fetch mockeados NO está garantizado.
    // Este `delay` fuerza el ÚNICO orden que hoy funciona, para que esta
    // suite pueda verificar las escenarios pedidos (carga de columnas,
    // ubicación de candidatos, drag & drop) sin quedar atrapada en un bug
    // que ya está caracterizado por separado. Si se corrige la
    // orquestación de fetch en PositionDetails.js, este `delay` deja de
    // ser necesario y debería quitarse.
    cy.intercept('GET', `**/positions/${POSITION_ID}/interviewFlow`, {
      fixture: 'interviewFlow.json',
    }).as('getInterviewFlow');

    cy.intercept('GET', `**/positions/${POSITION_ID}/candidates`, {
      fixture: 'candidates.json',
      delay: 50,
    }).as('getCandidates');

    cy.visit(`/positions/${POSITION_ID}`);
    cy.wait(['@getInterviewFlow', '@getCandidates']);
    // Verificación explícita de que el workaround surtió efecto: si esto
    // falla, la condición de carrera volvió a manifestarse y el fixture
    // de estabilización ya no es suficiente (aumentar el delay o
    // investigar si el bug cambió de forma).
    cy.get('[data-cy="candidate-name"]').contains('Ada Lovelace').should('exist');
  });

  describe('Escenario 1 — Carga de la página de Position', () => {
    it('muestra el título de la posición', () => {
      cy.get('[data-cy="position-title"]').should('be.visible').and('have.text', 'Senior Backend Engineer');
    });

    it('muestra una columna por cada fase del proceso de contratación', () => {
      cy.get('[data-cy="stage-column-Screening"]').should('be.visible');
      cy.get('[data-cy="stage-column-Technical Interview"]').should('be.visible');
      cy.get('[data-cy="stage-column-Manager Interview"]').should('be.visible');
    });

    it('muestra cada tarjeta de candidato en la columna correspondiente a su fase actual', () => {
      // Ada Lovelace está en Screening (fixture: currentInterviewStep = "Screening")
      // Nota: se usa `cy.contains(selector, texto).should('not.exist')` en
      // vez de `cy.get(selector).should('not.contain.text', texto)` para
      // las negaciones. Ese segundo patrón es un antipatrón conocido de
      // Cypress: si la colección puede tener CERO elementos (como pasa
      // aquí cuando una columna se queda sin candidatos), la aserción
      // deja de ser confiable. `cy.contains(...).should('not.exist')` sí
      // maneja correctamente el caso de cero coincidencias.
      cy.get('[data-cy="stage-column-Screening"]').within(() => {
        cy.get('[data-cy="candidate-name"]').should('contain.text', 'Ada Lovelace');
        cy.contains('[data-cy="candidate-name"]', 'Alan Turing').should('not.exist');
      });

      // Alan Turing está en Technical Interview
      cy.get('[data-cy="stage-column-Technical Interview"]').within(() => {
        cy.get('[data-cy="candidate-name"]').should('contain.text', 'Alan Turing');
        cy.contains('[data-cy="candidate-name"]', 'Ada Lovelace').should('not.exist');
      });

      // Manager Interview no tiene candidatos en este fixture
      cy.get('[data-cy="stage-column-Manager Interview"]').within(() => {
        cy.get('[data-cy="candidate-name"]').should('not.exist');
      });
    });
  });

  describe('Escenario 2 — Cambio de fase de un candidato (drag & drop)', () => {
    it('mueve la tarjeta a la nueva columna y persiste el cambio vía PUT /candidates/:id', () => {
      cy.intercept('PUT', '**/candidates/*', {
        statusCode: 200,
        body: { message: 'Candidate stage updated successfully', data: {} },
      }).as('updateStage');

      // Ada Lovelace -> candidateId 5 -> data-cy="candidate-card-5"
      // Columna "Technical Interview" -> data-cy="stage-column-Technical Interview"
      // (mismo nodo DOM que ya lleva data-rbd-draggable-id/data-rbd-droppable-id,
      // agregados automáticamente por react-beautiful-dnd; usar data-cy aquí
      // evita depender de esos atributos internos de la librería).
      cy.get('[data-cy="candidate-card-5"]').as('candidateCard');
      cy.get('[data-cy="stage-column-Technical Interview"]').as('targetColumn');

      cy.dragAndDrop('@candidateCard', '@targetColumn');

      // Verificación visual: la tarjeta ya aparece bajo la nueva columna.
      cy.get('[data-cy="stage-column-Technical Interview"]').within(() => {
        cy.get('[data-cy="candidate-name"]').should('contain.text', 'Ada Lovelace');
      });
      cy.get('[data-cy="stage-column-Screening"]').within(() => {
        cy.contains('[data-cy="candidate-name"]', 'Ada Lovelace').should('not.exist');
      });

      // Verificación de contrato: el PUT real que el frontend envía al
      // backend, con el id de candidato en la URL y el payload esperado
      // (applicationId de Ada Lovelace + id numérico del step destino,
      // NO su nombre — así es como PositionDetails.js arma el payload
      // hoy, ver jpm-prompts/findings-04a-characterization-position.md).
      cy.wait('@updateStage').then((interception) => {
        expect(interception.request.url).to.match(/\/candidates\/5$/);
        expect(interception.request.body).to.deep.equal({
          applicationId: 55,
          currentInterviewStep: 200,
        });
      });
    });
  });
});
