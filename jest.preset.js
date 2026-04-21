const nxPreset = require('@nx/jest/preset').default;

module.exports = {
  ...nxPreset,
  /**
   * Coverage thresholds — enforced on `nx test api --coverage`.
   * These apply to the aggregate across all files in the project.
   * Raise gradually as coverage increases; never lower without a formal RFC.
   */
  coverageThreshold: {
    global: {
      lines: 80,
      branches: 75,
    },
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.d.ts',
    '!src/main.ts',
    '!src/seed.ts',
  ],
};
