/**
 * Unsafe Dependency & Dynamic Import Static Analysis Rules
 * server/src/services/staticAnalyzer/rules/security/dependencies.rules.js
 *
 * Covers:
 * - Dynamic Module Loading / Unsafe Reflection in Python (CWE-470 / A06:2021-Vulnerable and Outdated Components)
 * - Dynamic Require / Unsafe Reflection in JavaScript/TypeScript (CWE-470 / A06:2021-Vulnerable and Outdated Components)
 */

export const dependenciesRules = [
  {
    ruleId: 'SEC-PY-DEP-001',
    name: 'Dynamic Module Loading in Python (Unsafe Reflection)',
    title: 'Dynamic Module Loading (Unsafe Reflection)',
    category: 'SEC',
    severity: 'HIGH',
    owaspCategory: 'A06:2021-Vulnerable and Outdated Components',
    cwe: 'CWE-470',
    confidence: 'MEDIUM',
    languages: ['python'],
    scanRaw: false,
    regex: /importlib\s*\.\s*import_module\s*\(\s*[a-zA-Z_]\w*\s*\)/g,
    explanation:
      'Dynamically loading modules based on external variable input (unsafe reflection) allows attackers to execute arbitrary local Python modules.',
    suggestedSnippet: 'ALLOWED_MODULES = {"plugin_a": plugin_a}\nmod = ALLOWED_MODULES.get(mod_name)',
    remediation: 'Validate module names against an explicit static allowlist before dynamically importing.'
  },
  {
    ruleId: 'SEC-JS-DEP-001',
    name: 'Dynamic Require in JavaScript/TypeScript (Unsafe Reflection)',
    title: 'Dynamic Require (Unsafe Reflection)',
    category: 'SEC',
    severity: 'HIGH',
    owaspCategory: 'A06:2021-Vulnerable and Outdated Components',
    cwe: 'CWE-470',
    confidence: 'MEDIUM',
    languages: ['javascript', 'typescript'],
    scanRaw: false,
    regex: /require\s*\(\s*[a-zA-Z_]\w*\s*\)/g,
    explanation:
      'Passing variable identifiers to require() allows arbitrary local file inclusion and execution of unintended modules.',
    suggestedSnippet: 'const handlers = { auth: require("./handlers/auth") };\nconst handler = handlers[type];',
    remediation: 'Use static import statements or an explicit dispatch map of pre-required modules.'
  }
];

export default dependenciesRules;
