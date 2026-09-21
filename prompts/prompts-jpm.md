# Archivo /prompts/prompts-jpm.md del Ejercicio del Módulo 11 - QA E2E

Cohort: AI4DEVS 2026/06 Rookies
Alumno: Jaime Pinal Maldonado
Herramienta: Claude Code

## Descripción del Ejercicio
Crear Pruebas E2E para la Interfaz "position" para los siguientes escenarios:

### Escenarios
Escenario 1 - Carga de la Página de Position:
- Verifica que el título de la posición se muestra correctamente.
- Verifica que se muestran las columnas correspondientes a cada fase del proceso de contratación.
- Verifica que las tarjetas de los candidatos se muestran en la columna correcta según su fase actual.

Escenario 2 - Cambio de Fase de un Candidato:
- Simula el arrastre de una tarjeta de candidato de una columna a otra.
- Verifica que la tarjeta del candidato se mueve a la nueva columna.
- Verifica que la fase del candidato se actualiza correctamente en el backend mediante el endpoint PUT /candidate/:id.


## Prompts Utilizados en este Ejercicio de E2E

### Prompt 1 - Exploración General 
Analiza backend y frontend y resume:

- Arquitectura general
- Flujo principal desde rutas hasta servicios y modelos
- Dónde está la lógica de negocio más importante
- Dónde están los mayores riesgos de calidad

Enfoca tu análisis en dos escenarios que quiero probar:
1. Carga de la página position
2. Cambio de fase de un candidato

---
### Prompt 2 - Análisis de Arquitectura
Actúa como Senior QA Architect.
 
Extiende el análisis. Antes de escribir pruebas o tocar código, identifica:
 
1. dónde están las rutas,
2. dónde están los controllers,
3. dónde está la lógica de negocio,
4. dónde están las validaciones,
5. qué runner de tests usa el proyecto.
 
Luego decide:
- si puedo comparar contrato vs implementación,
- qué archivos compararía,
- o qué haría si falta contrato o falta validador.
 
No modifiques archivos.
No generes tests todavía.
 
Devuelve:
- diagnóstico,
- archivos clave,
- brechas,
- siguiente prompt recomendado.

---
### Prompt 3 - Generar Characterization Test sobre Position
Actúa como un ingeniero senior experto en TDD y código legacy.

Trabaja sobre /frontend/src/components/PositionDetails.js

Objetivo:
Antes de corregir bugs, quiero crear characterization tests que documenten exactamente el comportamiento actual de PositionDetails.js, aunque ese comportamiento sea incorrecto.

Instrucciones:
1. Analiza el código actual.
2. Identifica los comportamientos actuales más importantes.
3. Genera tests que capturen ese comportamiento tal como está hoy.
4. No corrijas todavía la implementación.
5. Marca cuáles de esos comportamientos parecen legacy, incorrectos o riesgosos.
6. Separa claramente:
   - comportamiento actual documentado
   - posibles comportamientos a corregir después

Entrega:
- archivo - archivo /frontend/src/components/PositionDetails.characterization.spec.ts
- lista breve de comportamientos actuales a capturar
- comentarios dentro de los tests indicando cuáles son characterization tests de comportamiento legacy
- observaciones sobre qué tests probablemente cambiarán cuando corrijamos el código

Reglas:
- no inventes reglas nuevas
- no asumas comportamiento esperado futuro


---
### Prompt 4 - Generar Characterization Test sobre el Flujo de Cambio de Fase
Actúa como un ingeniero senior experto en TDD y código legacy.

Trabaja sobre el flujo de cambio de fase del repositorio actual.

Objetivo:
Antes de corregir bugs, quiero crear characterization tests que documenten exactamente el comportamiento actual del flujo de cambio de fase, aunque ese comportamiento sea incorrecto.

Instrucciones:
1. Analiza el código actual.
2. Identifica los comportamientos actuales más importantes.
3. Genera tests que capturen ese comportamiento tal como está hoy.
4. No corrijas todavía la implementación.
5. Marca cuáles de esos comportamientos parecen legacy, incorrectos o riesgosos.
6. Separa claramente:
   - comportamiento actual documentado
   - posibles comportamientos a corregir después

Entrega:
- archivo o archivos de characterization test
- lista breve de comportamientos actuales a capturar
- comentarios dentro de los tests indicando cuáles son characterization tests de comportamiento legacy
- observaciones sobre qué tests probablemente cambiarán cuando corrijamos el código

Reglas:
- no inventes reglas nuevas
- no asumas comportamiento esperado futuro


--- 
### Prompt 5 - Crear Pruebas E2E
Actúa como Senior QA Architect y experto en Pruenbas End to End (E2E) y legacy code.

Prepara lo necesario para realizar Pruebas E2E con Cypress para la Interfaz "position":

Debes crear pruebas E2E para verificar los siguientes escenarios:

Escenario 1 - Carga de la Página de Position:
- Verifica que el título de la posición se muestra correctamente.
- Verifica que se muestran las columnas correspondientes a cada fase del proceso de contratación.
- Verifica que las tarjetas de los candidatos se muestran en la columna correcta según su fase actual.

Escenarion 2 - Cambio de Fase de un Candidato:
- Simula el arrastre de una tarjeta de candidato de una columna a otra.
- Verifica que la tarjeta del candidato se mueve a la nueva columna.
- Verifica que la fase del candidato se actualiza correctamente en el backend mediante el endpoint PUT /candidate/:id.



--- 
### Prompt 6 - Agrega Selectores Estables
Revisa los componentes involucrados en las pruebas E2E de los dos escenarios involucrados e indica si tienen los selectores data-cy en los componentes. Si no cuentan con ello, agregarlos y actualizar los tests.

#### Prompt 6 - Observaciones
No hay data-cy en. Así es que se agregaron en:
- PositioDetails.js
- StageColumn.js
- CandidateCard.js
- CandidateDetails.js

## Instrucciones Necesarias para la ejecución de las Pruebas E2E
Una vez instalado Cypress, ejecutados los prompts y creadas las pruebas E2E, teniendo los servidores de backend y frontend corriendo en local, hacer lo siguiente:

### Paso 1 - Verificar creación 
Revisar que exista:
- /cypress/e2e/position.cy.js
- /cypress/e2e/fixtures/candidates.json
- /cypress/e2e/fixtures/interviewFlow.json

### Paso 2 - Run Cypress
Desde la terminal:  
npx cypress open

### Paso 3 - Select type of testing
Seleccionar E2E Testing en la interfaz de Cypress

### Paso 4 - Choose a browser
Start E2E testing in Chrome

### Paso 5 - Run the tests/scenarios
run e2e from spec