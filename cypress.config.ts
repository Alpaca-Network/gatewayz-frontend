import { defineConfig } from 'cypress'

export default defineConfig({
  projectId: 'jwq6tx',

  component: {
    devServer: {
      framework: 'react',
      bundler: 'webpack',
      webpackConfig: require('./cypress/webpack.config.ts').default,
    },
    specPattern: 'cypress/component/**/*.cy.{ts,tsx}',
    supportFile: 'cypress/support/component.ts',
  },

  e2e: {
    baseUrl: 'http://localhost:3000',
    specPattern: 'cypress/e2e/**/*.cy.{ts,tsx}',
    supportFile: 'cypress/support/e2e.ts',
  },

  env: {
    apiBaseUrl: 'https://api.gatewayz.ai',
  },

  viewportWidth: 1280,
  viewportHeight: 720,
  video: false,
  screenshotOnRunFailure: true,

  retries: {
    runMode: 2,
    openMode: 0,
  },

  defaultCommandTimeout: 10000,
  pageLoadTimeout: 30000,
  requestTimeout: 10000,
  responseTimeout: 30000,
})
