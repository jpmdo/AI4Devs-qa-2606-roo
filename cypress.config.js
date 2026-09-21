const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    // El frontend es una app CRA (react-scripts start) servida en :3000.
    // Estos tests NO requieren el backend real corriendo: las llamadas de
    // red se interceptan (ver cypress/e2e/position.cy.js) para que la
    // suite sea determinística y no dependa de datos sembrados en Postgres.
    baseUrl: 'http://localhost:3000',
    specPattern: 'cypress/e2e/**/*.cy.js',
    supportFile: 'cypress/support/e2e.js',
    fixturesFolder: 'cypress/fixtures',
    video: false,
  },
});
