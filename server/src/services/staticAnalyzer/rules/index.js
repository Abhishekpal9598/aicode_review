/**
 * Static Analysis Rule Registry Index
 * Combines language-specific rules with universal secrets rules.
 */

import secretRules from './shared/secrets.rules.js';
import pythonRules from './python.rules.js';
import javascriptRules from './javascript.rules.js';
import typescriptRules from './typescript.rules.js';
import javaRules from './java.rules.js';
import cRules from './c.rules.js';
import cppRules from './cpp.rules.js';
import {
  allSecurityRules,
  getSecurityRulesByLanguage
} from './security/index.js';

export const languageRuleMap = {
  python: pythonRules,
  javascript: javascriptRules,
  typescript: typescriptRules,
  java: javaRules,
  c: cRules,
  cpp: cppRules
};

/**
 * Validates structural integrity, metadata completeness, and uniqueness of all registered static rules.
 * Throws immediately at module initialization if any schema defect or ID collision exists.
 *
 * @param {Array<object>} rules - Full unified array of all registered rules (79 rules)
 */
export function validateRegistry(rules) {
  if (!Array.isArray(rules) || rules.length === 0) {
    throw new Error('REGISTRY_VALIDATION_ERROR: Rule registry must be a non-empty array');
  }

  const seenRuleIds = new Set();
  const validCategories = new Set(['SEC', 'RISK', 'QUAL']);
  const validSeverities = new Set(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']);
  const validLanguages = new Set(['python', 'javascript', 'typescript', 'java', 'c', 'cpp']);
  const validConfidences = new Set(['HIGH', 'MEDIUM', 'LOW']);

  for (const rule of rules) {
    if (!rule || typeof rule !== 'object') {
      throw new Error('REGISTRY_VALIDATION_ERROR: Rule definition must be an object');
    }

    // 1. ruleId validation
    if (!rule.ruleId || typeof rule.ruleId !== 'string' || !/^[A-Z0-9_-]+$/.test(rule.ruleId)) {
      throw new Error(`REGISTRY_VALIDATION_ERROR: Missing or invalid ruleId: ${JSON.stringify(rule)}`);
    }
    if (seenRuleIds.has(rule.ruleId)) {
      throw new Error(`REGISTRY_VALIDATION_ERROR: Duplicate ruleId detected: ${rule.ruleId}`);
    }
    seenRuleIds.add(rule.ruleId);

    // 2. name and title validation
    if (typeof rule.name !== 'string' || rule.name.trim().length === 0) {
      throw new Error(`REGISTRY_VALIDATION_ERROR: Rule ${rule.ruleId} missing non-empty name`);
    }
    if (typeof rule.title !== 'string' || rule.title.trim().length === 0) {
      throw new Error(`REGISTRY_VALIDATION_ERROR: Rule ${rule.ruleId} missing non-empty title`);
    }

    // 3. Category & severity validation
    if (!validCategories.has(rule.category)) {
      throw new Error(`REGISTRY_VALIDATION_ERROR: Rule ${rule.ruleId} has invalid category: ${rule.category}`);
    }
    if (!validSeverities.has(rule.severity)) {
      throw new Error(`REGISTRY_VALIDATION_ERROR: Rule ${rule.ruleId} has invalid severity: ${rule.severity}`);
    }

    // 4. Regex & scanRaw validation
    if (!(rule.regex instanceof RegExp)) {
      throw new Error(`REGISTRY_VALIDATION_ERROR: Rule ${rule.ruleId} regex must be a RegExp instance`);
    }
    if (!rule.regex.global) {
      throw new Error(`REGISTRY_VALIDATION_ERROR: Rule ${rule.ruleId} regex must have global (g) flag`);
    }
    if (typeof rule.scanRaw !== 'boolean') {
      throw new Error(`REGISTRY_VALIDATION_ERROR: Rule ${rule.ruleId} scanRaw must be boolean`);
    }

    // 5. Explanation, snippet, and remediation validation
    if (typeof rule.explanation !== 'string' || rule.explanation.trim().length < 10) {
      throw new Error(`REGISTRY_VALIDATION_ERROR: Rule ${rule.ruleId} explanation must be a string of at least 10 characters`);
    }
    const snippetType = typeof rule.suggestedSnippet;
    if (snippetType !== 'string' && snippetType !== 'function') {
      throw new Error(`REGISTRY_VALIDATION_ERROR: Rule ${rule.ruleId} suggestedSnippet must be string or function`);
    }
    if (typeof rule.remediation !== 'string' || rule.remediation.trim().length < 10) {
      throw new Error(`REGISTRY_VALIDATION_ERROR: Rule ${rule.ruleId} remediation must be a string of at least 10 characters`);
    }

    // 6. Conditional Phase 9 Security Metadata Validation
    const isPhase9SecurityRule = /^SEC-[A-Z]+-[A-Z]+-\d{3}$/.test(rule.ruleId);

    if (isPhase9SecurityRule) {
      // Languages array is MANDATORY for Phase 9 security rules
      if (!Array.isArray(rule.languages) || rule.languages.length === 0) {
        throw new Error(`REGISTRY_VALIDATION_ERROR: Security rule ${rule.ruleId} missing non-empty languages array`);
      }
      const seenLangs = new Set();
      for (const lang of rule.languages) {
        if (!validLanguages.has(lang)) {
          throw new Error(`REGISTRY_VALIDATION_ERROR: Security rule ${rule.ruleId} specifies unsupported language: ${lang}`);
        }
        if (seenLangs.has(lang)) {
          throw new Error(`REGISTRY_VALIDATION_ERROR: Security rule ${rule.ruleId} contains duplicate language: ${lang}`);
        }
        seenLangs.add(lang);
      }

      // CWE is MANDATORY for Phase 9 security rules
      if (typeof rule.cwe !== 'string' || !/^CWE-\d+$/.test(rule.cwe)) {
        throw new Error(`REGISTRY_VALIDATION_ERROR: Security rule ${rule.ruleId} has invalid CWE format: ${rule.cwe}`);
      }

      // Confidence is MANDATORY for Phase 9 security rules
      if (!validConfidences.has(rule.confidence)) {
        throw new Error(`REGISTRY_VALIDATION_ERROR: Security rule ${rule.ruleId} has invalid confidence: ${rule.confidence}`);
      }

      // OWASP Category is MANDATORY for Phase 9 security rules
      if (typeof rule.owaspCategory !== 'string' || !/^A\d{2}:2021-/.test(rule.owaspCategory)) {
        throw new Error(`REGISTRY_VALIDATION_ERROR: Security rule ${rule.ruleId} has invalid OWASP category format: ${rule.owaspCategory}`);
      }
    } else {
      // Optional validation for non-Phase 9 rules when present
      if (rule.languages !== undefined) {
        if (!Array.isArray(rule.languages) || rule.languages.length === 0) {
          throw new Error(`REGISTRY_VALIDATION_ERROR: Rule ${rule.ruleId} languages must be a non-empty array when present`);
        }
        const seenLangs = new Set();
        for (const lang of rule.languages) {
          if (!validLanguages.has(lang)) {
            throw new Error(`REGISTRY_VALIDATION_ERROR: Rule ${rule.ruleId} specifies unsupported language: ${lang}`);
          }
          if (seenLangs.has(lang)) {
            throw new Error(`REGISTRY_VALIDATION_ERROR: Rule ${rule.ruleId} contains duplicate language: ${lang}`);
          }
          seenLangs.add(lang);
        }
      }
      if (rule.cwe !== undefined && (typeof rule.cwe !== 'string' || !/^CWE-\d+$/.test(rule.cwe))) {
        throw new Error(`REGISTRY_VALIDATION_ERROR: Rule ${rule.ruleId} has invalid CWE format: ${rule.cwe}`);
      }
      if (rule.confidence !== undefined && !validConfidences.has(rule.confidence)) {
        throw new Error(`REGISTRY_VALIDATION_ERROR: Rule ${rule.ruleId} has invalid confidence: ${rule.confidence}`);
      }
      if (rule.owaspCategory !== undefined && (typeof rule.owaspCategory !== 'string' || !/^A\d{2}:2021-/.test(rule.owaspCategory))) {
        throw new Error(`REGISTRY_VALIDATION_ERROR: Rule ${rule.ruleId} has invalid OWASP category format: ${rule.owaspCategory}`);
      }
    }
  }
}

/**
 * Returns all rules applicable for a specific programming language.
 *
 * @param {string} language - Target language ('python', 'javascript', 'typescript', 'java', 'c', 'cpp')
 * @returns {Array<object>} - Array of rule definitions
 */
export function getRulesForLanguage(language) {
  const normalizedLang = (language || '').toLowerCase().trim();
  const specificRules = languageRuleMap[normalizedLang] || [];
  const securityRules = getSecurityRulesByLanguage(normalizedLang);
  return [...secretRules, ...specificRules, ...securityRules];
}

/**
 * Returns complete registry of all rules across all languages (Phase 7 legacy contract: exactly 37 rules).
 * @returns {Array<object>}
 */
export function getAllRules() {
  return [
    ...secretRules,
    ...pythonRules,
    ...javascriptRules,
    ...typescriptRules,
    ...javaRules,
    ...cRules,
    ...cppRules
  ];
}

/**
 * Returns complete unified registry of all rules (37 Phase 7 base rules + 42 Phase 9 security rules = 79 rules).
 * @returns {Array<object>}
 */
export function getAllRegisteredRules() {
  return [
    ...getAllRules(),
    ...allSecurityRules
  ];
}

// Execute registry validation at module initialization
validateRegistry(getAllRegisteredRules());

export default {
  languageRuleMap,
  getRulesForLanguage,
  getAllRules,
  getAllRegisteredRules,
  validateRegistry
};
