/**
 * Insecure Deserialization Static Analysis Rules
 * server/src/services/staticAnalyzer/rules/security/deserialization.rules.js
 *
 * Covers:
 * - Python pickle deserialization (CWE-502 / A08:2021-Software and Data Integrity Failures)
 * - Python unsafe PyYAML load (CWE-502 / A08:2021-Software and Data Integrity Failures)
 * - Java ObjectInputStream.readObject (CWE-502 / A08:2021-Software and Data Integrity Failures)
 * - JavaScript node-serialize.unserialize (CWE-502 / A08:2021-Software and Data Integrity Failures)
 */

export const deserializationRules = [
  {
    ruleId: 'SEC-PY-DES-001',
    name: 'Insecure Pickle Deserialization in Python',
    title: 'Insecure Object Deserialization (pickle)',
    category: 'SEC',
    severity: 'CRITICAL',
    owaspCategory: 'A08:2021-Software and Data Integrity Failures',
    cwe: 'CWE-502',
    confidence: 'HIGH',
    languages: ['python'],
    scanRaw: false,
    regex: /(?:pickle|_pickle|cPickle)\s*\.\s*(?:loads|load)\s*\(/g,
    explanation:
      'Deserializing untrusted data with pickle allows attackers to execute arbitrary code via __reduce__ hooks.',
    suggestedSnippet: 'json.loads(payload)',
    remediation: 'Avoid pickle for untrusted input. Use safe serialization formats such as JSON or Protocol Buffers.'
  },
  {
    ruleId: 'SEC-PY-DES-002',
    name: 'Unsafe PyYAML Load in Python',
    title: 'Unsafe PyYAML Object Load',
    category: 'SEC',
    severity: 'HIGH',
    owaspCategory: 'A08:2021-Software and Data Integrity Failures',
    cwe: 'CWE-502',
    confidence: 'HIGH',
    languages: ['python'],
    scanRaw: false,
    regex: /yaml\s*\.\s*(?:unsafe_load\s*\(|load\s*\([^)]*(?:Loader\s*=\s*yaml\.(?:Loader|UnsafeLoader)|(?<!Loader=yaml\.SafeLoader)\)))/g,
    explanation:
      'Invoking yaml.load() without SafeLoader or using yaml.unsafe_load() allows arbitrary Python object instantiation and code execution.',
    suggestedSnippet: 'yaml.safe_load(yaml_data)',
    remediation: 'Use yaml.safe_load() or specify Loader=yaml.SafeLoader when parsing YAML documents.'
  },
  {
    ruleId: 'SEC-JAV-DES-001',
    name: 'Insecure Java Deserialization via readObject',
    title: 'Insecure Object Deserialization (readObject)',
    category: 'SEC',
    severity: 'CRITICAL',
    owaspCategory: 'A08:2021-Software and Data Integrity Failures',
    cwe: 'CWE-502',
    confidence: 'HIGH',
    languages: ['java'],
    scanRaw: false,
    regex: /(?:ObjectInputStream|[a-zA-Z_]\w*)\s*\.\s*readObject\s*\(/g,
    explanation:
      'Native Java deserialization via ObjectInputStream.readObject() on untrusted input can trigger gadget chains resulting in remote code execution.',
    suggestedSnippet: 'UserRecord record = objectMapper.readValue(stream, UserRecord.class);',
    remediation: 'Avoid native Java object serialization. Use JSON/Protobuf or configure an explicit ObjectInputFilter.'
  },
  {
    ruleId: 'SEC-JS-DES-001',
    name: 'Insecure Object Unserialization in JavaScript/Node',
    title: 'Insecure Object Deserialization (node-serialize)',
    category: 'SEC',
    severity: 'CRITICAL',
    owaspCategory: 'A08:2021-Software and Data Integrity Failures',
    cwe: 'CWE-502',
    confidence: 'HIGH',
    languages: ['javascript', 'typescript'],
    scanRaw: false,
    regex: /node-serialize\s*\.\s*unserialize\s*\(/g,
    explanation:
      'Using node-serialize.unserialize() on untrusted strings allows remote code execution via Immediately Invoked Function Expressions (IIFE).',
    suggestedSnippet: 'JSON.parse(data)',
    remediation: 'Replace node-serialize with standard JSON.parse() or a validated typed schema parser.'
  }
];

export default deserializationRules;
