/**
 * Security Rules Aggregator & Index
 * server/src/services/staticAnalyzer/rules/security/index.js
 *
 * Centralizes all Phase 9 domain-specific OWASP security rules:
 * - Injection (SQL, NoSQL, Command, Code Injection, Buffer Overflows)
 * - Cross-Site Scripting (XSS)
 * - Insecure Deserialization
 * - Cryptographic Failures & Weak PRNG
 * - Security Misconfiguration & Insecure Cookies
 * - Server-Side Request Forgery (SSRF)
 * - Path Traversal
 * - Unsafe Dynamic Dependencies / Imports
 */

import injectionRules from './injection.rules.js';
import xssRules from './xss.rules.js';
import deserializationRules from './deserialization.rules.js';
import cryptoRules from './crypto.rules.js';
import misconfigRules from './misconfig.rules.js';
import ssrfRules from './ssrf.rules.js';
import traversalRules from './traversal.rules.js';
import dependenciesRules from './dependencies.rules.js';

export {
  injectionRules,
  xssRules,
  deserializationRules,
  cryptoRules,
  misconfigRules,
  ssrfRules,
  traversalRules,
  dependenciesRules
};

export const securityRulesByDomain = {
  injection: injectionRules,
  xss: xssRules,
  deserialization: deserializationRules,
  crypto: cryptoRules,
  misconfig: misconfigRules,
  ssrf: ssrfRules,
  traversal: traversalRules,
  dependencies: dependenciesRules
};

/**
 * Complete list of all Phase 9 static security rules across all domains.
 */
export const allSecurityRules = [
  ...injectionRules,
  ...xssRules,
  ...deserializationRules,
  ...cryptoRules,
  ...misconfigRules,
  ...ssrfRules,
  ...traversalRules,
  ...dependenciesRules
];

/**
 * In-memory map indexing every rule by ruleId for sub-millisecond lookup.
 */
export const securityRulesById = new Map(
  allSecurityRules.map((rule) => [rule.ruleId, rule])
);

/**
 * Returns all security rules applicable to a specific programming language.
 *
 * @param {string} language - Target language ('c', 'cpp', 'java', 'python', 'javascript', 'typescript')
 * @returns {Array<object>}
 */
export function getSecurityRulesByLanguage(language) {
  const norm = (language || '').toLowerCase().trim();
  return allSecurityRules.filter((rule) => {
    if (!rule.languages || !Array.isArray(rule.languages)) return false;
    return rule.languages.includes(norm);
  });
}

/**
 * Retrieves rule definition by ruleId.
 *
 * @param {string} ruleId
 * @returns {object|null}
 */
export function getSecurityRuleById(ruleId) {
  return securityRulesById.get(ruleId) || null;
}

export default {
  injectionRules,
  xssRules,
  deserializationRules,
  cryptoRules,
  misconfigRules,
  ssrfRules,
  traversalRules,
  dependenciesRules,
  securityRulesByDomain,
  allSecurityRules,
  securityRulesById,
  getSecurityRulesByLanguage,
  getSecurityRuleById
};
