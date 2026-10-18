/**
 * Static Analysis Service Public Interface
 */

import { analyze } from './engine.js';
import { getRulesForLanguage, getAllRules, getAllRegisteredRules, validateRegistry } from './rules/index.js';
import { preprocessCode } from './utils/preprocessor.js';
import { calculateScore } from './scoring.js';

export {
  analyze,
  analyze as analyzeCode,
  getRulesForLanguage,
  getAllRules,
  getAllRegisteredRules,
  validateRegistry,
  preprocessCode,
  calculateScore
};

export default {
  analyze,
  analyzeCode: analyze,
  getRulesForLanguage,
  getAllRules,
  getAllRegisteredRules,
  validateRegistry,
  preprocessCode,
  calculateScore
};
