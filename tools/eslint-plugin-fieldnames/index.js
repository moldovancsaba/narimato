'use strict';

/**
 * FUNCTIONAL: Expose local custom ESLint rules as a standard plugin so the ESLint CLI can load them.
 * STRATEGIC: Reuses existing rule definitions from .eslintrc.field-names.js without introducing external deps.
 */
const path = require('path');

// Reuse existing rule definitions (Reuse Before Creation rule)
const localConfig = require(path.resolve(__dirname, '../../.eslintrc.field-names.js'));

const rules = (localConfig && localConfig.rules) ? localConfig.rules : {};

module.exports = {
  rules,
};

