/**
 * Simula un drag & drop compatible con react-beautiful-dnd.
 *
 * react-beautiful-dnd NO usa la API nativa HTML5 de drag & drop
 * (dragstart/dragover/drop): tiene su propio "sensor" basado en eventos
 * de mouse/touch reales, con umbrales de distancia y varios frames de
 * animación antes de "levantar" el elemento. Por eso `cy.trigger('dragstart')`
 * no funciona con esta librería: hay que simular una secuencia de
 * mousedown -> mousemove (varias veces, con pausas reales) -> mouseup.
 *
 * ADVERTENCIA (riesgo conocido): esta técnica es la más usada en la
 * comunidad para testear react-beautiful-dnd con Cypress, pero sigue
 * siendo inherentemente más frágil que un drag nativo, porque depende de
 * temporizaciones internas de la librería (requestAnimationFrame) que no
 * están pensadas para ser testeadas. Si este test empieza a fallar de
 * forma intermitente, ese es el primer sospechoso, no necesariamente un
 * bug de la aplicación. react-beautiful-dnd además está archivada
 * (sin mantenimiento activo) por Atlassian.
 */
Cypress.Commands.add('dragAndDrop', (sourceSelector, targetSelector) => {
  const BUTTON_INDEX = 0;
  const STEPS = 12;

  cy.get(sourceSelector).then(($source) => {
    const sourceRect = $source[0].getBoundingClientRect();
    const startX = sourceRect.x + sourceRect.width / 2;
    const startY = sourceRect.y + sourceRect.height / 2;

    cy.get(targetSelector).then(($target) => {
      const targetRect = $target[0].getBoundingClientRect();
      const endX = targetRect.x + targetRect.width / 2;
      const endY = targetRect.y + targetRect.height / 2;

      cy.wrap($source).trigger('mousedown', {
        button: BUTTON_INDEX,
        which: 1,
        clientX: startX,
        clientY: startY,
        force: true,
      });
      cy.wait(50);

      // Movimiento interpolado en varios pasos pequeños, en vez de un
      // único salto de origen a destino: react-beautiful-dnd recalcula
      // en qué droppable está el puntero en CADA mousemove usando las
      // coordenadas reales del evento, y necesita ver desplazamiento
      // progresivo (no un teletransporte) para levantar el elemento y
      // luego reconocer el droppable de destino de forma fiable.
      for (let step = 1; step <= STEPS; step += 1) {
        const x = startX + ((endX - startX) * step) / STEPS;
        const y = startY + ((endY - startY) * step) / STEPS;
        cy.wrap($source, { log: false }).trigger('mousemove', {
          button: BUTTON_INDEX,
          which: 1,
          clientX: x,
          clientY: y,
          force: true,
        });
      }

      cy.wait(200);
      // Dos mousemove finales exactamente sobre el centro del destino,
      // para dar tiempo a que react-beautiful-dnd fije el droppable
      // ganador antes de soltar.
      cy.wrap($source).trigger('mousemove', {
        button: BUTTON_INDEX,
        which: 1,
        clientX: endX,
        clientY: endY,
        force: true,
      });
      cy.wait(50);
      cy.wrap($source).trigger('mouseup', {
        button: BUTTON_INDEX,
        which: 1,
        clientX: endX,
        clientY: endY,
        force: true,
      });
    });
  });
});
