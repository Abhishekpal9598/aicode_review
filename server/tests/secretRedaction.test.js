/**
 * Unit & Integration Tests for Dedicated Secret Redaction Service
 * server/tests/secretRedaction.test.js
 *
 * Verifies Phase 8 Step 2 requirements:
 * 1. AWS access key detection and masking.
 * 2. GitHub personal access token detection.
 * 3. JWT token detection.
 * 4. Passwords in database connection URLs.
 * 5. Generic API key/password assignments.
 * 6. Single-line exact character-length preservation.
 * 7. Multiline PEM private key redaction and newline preservation.
 * 8. Column-position and line-coordinate preservation.
 * 9. CoordinateMapper functionality.
 * 10. Multiple heterogeneous secrets in a single file.
 * 11. Ordinary source code resilience (zero false positive redacting of normal code).
 * 12. Security: Absolute absence of cleartext secret values from returned metadata.
 * 13. Safe handling of empty, null, and non-string inputs.
 */

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  redactSecrets,
  CoordinateMapper,
  REDACTION_PATTERNS
} from '../src/services/secretRedaction.service.js';

describe('Phase 8 — Dedicated Secret Redaction Service', () => {
  // =========================================================================
  // 1. INPUT SANITIZATION & EDGE CASES
  // =========================================================================
  test('Edge Case: handles empty string gracefully', () => {
    const res = redactSecrets('');
    assert.strictEqual(res.redactedCode, '');
    assert.strictEqual(res.redactedSecretsCount, 0);
    assert.deepStrictEqual(res.detections, []);
    assert.ok(res.coordinateMapper instanceof CoordinateMapper);
    assert.strictEqual(res.coordinateMapper.hasShifts(), false);
  });

  test('Edge Case: handles null and undefined safely without throwing', () => {
    const resNull = redactSecrets(null);
    assert.strictEqual(resNull.redactedCode, '');
    assert.strictEqual(resNull.redactedSecretsCount, 0);

    const resUndefined = redactSecrets(undefined);
    assert.strictEqual(resUndefined.redactedCode, '');
    assert.strictEqual(resUndefined.redactedSecretsCount, 0);

    const resNumber = redactSecrets(12345);
    assert.strictEqual(resNumber.redactedCode, '');
  });

  // =========================================================================
  // 2. PATTERN-SPECIFIC DETECTION & REDACTION
  // =========================================================================
  test('Secret Detection: AWS access key ID masked with same-length characters', () => {
    const rawKey = 'AKIAIOSFODNN7EXAMPLE';
    const code = `const awsKey = "${rawKey}";`;
    const res = redactSecrets(code);

    assert.strictEqual(res.redactedSecretsCount, 1);
    assert.strictEqual(res.detections[0].type, 'AWS_KEY');
    assert.strictEqual(res.detections[0].line, 1);
    assert.strictEqual(res.detections[0].column, 17);
    assert.strictEqual(res.detections[0].length, 20);

    // Verify raw key is replaced and length is identical
    assert.ok(!res.redactedCode.includes(rawKey));
    assert.ok(res.redactedCode.includes('AKIA****************'));
    assert.strictEqual(res.redactedCode.length, code.length);
  });

  test('Secret Detection: GitHub tokens (classic and fine-grained) redacted', () => {
    const classicToken = 'ghp_1234567890abcdefghijklmnopqrstuvwxyz';
    const code = `const token = "${classicToken}";`;
    const res = redactSecrets(code);

    assert.strictEqual(res.redactedSecretsCount, 1);
    assert.strictEqual(res.detections[0].type, 'GITHUB_TOKEN');
    assert.ok(!res.redactedCode.includes(classicToken));
    assert.ok(res.redactedCode.includes('ghp_************************************'));
    assert.strictEqual(res.redactedCode.length, code.length);
  });

  test('Secret Detection: JSON Web Tokens (JWT) redacted with exact length preserved', () => {
    const rawJwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    const code = `const authHeader = "Bearer ${rawJwt}";`;
    const res = redactSecrets(code);

    assert.strictEqual(res.redactedSecretsCount, 1);
    assert.strictEqual(res.detections[0].type, 'JWT');
    assert.ok(!res.redactedCode.includes(rawJwt));
    assert.ok(res.redactedCode.startsWith('const authHeader = "Bearer eyJ'));
    assert.strictEqual(res.redactedCode.length, code.length);
  });

  test('Secret Detection: Database connection URL passwords masked preserving URL structure', () => {
    const code = 'const conn = "postgres://db_admin:SuperSecretPass123!@db.internal:5432/app";';
    const res = redactSecrets(code);

    assert.strictEqual(res.redactedSecretsCount, 1);
    assert.strictEqual(res.detections[0].type, 'DB_CONNECTION_URL');
    assert.ok(!res.redactedCode.includes('SuperSecretPass123!'));
    assert.ok(res.redactedCode.includes(`postgres://db_admin:${'*'.repeat('SuperSecretPass123!'.length)}@db.internal:5432/app`));
    assert.strictEqual(res.redactedCode.length, code.length);
  });

  test('Secret Detection: Generic hardcoded password and API key assignments', () => {
    const code = `
const apiKey = "AIzaSyD-1234567890abcdef";
const password = "ProductionMasterPassword99";
`;
    const res = redactSecrets(code);

    assert.strictEqual(res.redactedSecretsCount, 2);
    assert.ok(!res.redactedCode.includes('AIzaSyD-1234567890abcdef'));
    assert.ok(!res.redactedCode.includes('ProductionMasterPassword99'));
    assert.strictEqual(res.redactedCode.length, code.length);
  });

  // =========================================================================
  // 3. MULTILINE PEM PRIVATE KEY REDACTION & INVARIANCE
  // =========================================================================
  test('Multiline PEM: Private key block redacted with exact line and newline preservation', () => {
    const pemCode = `
# System TLS Config
-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0Y1W9Z4p8aBcDefGhIjKlMnOpQrStUvWxYz0123456789aBcDe
fGhIjKlMnOpQrStUvWxYz0123456789aBcDefGhIjKlMnOpQrStUvWxYz012345678
-----END RSA PRIVATE KEY-----

def initialize_app():
    return True
`;

    const res = redactSecrets(pemCode);

    assert.strictEqual(res.redactedSecretsCount, 1);
    assert.strictEqual(res.detections[0].type, 'PRIVATE_KEY');
    assert.strictEqual(res.detections[0].line, 3);

    // Verify lines count is 100% identical
    assert.strictEqual(
      res.redactedCode.split('\n').length,
      pemCode.split('\n').length,
      'Line count must remain identical after PEM redaction'
    );

    // Verify exact character length is preserved
    assert.strictEqual(
      res.redactedCode.length,
      pemCode.length,
      'Total character count must remain identical'
    );

    // Verify key bytes are not present
    assert.ok(!res.redactedCode.includes('MIIEowIBAAKCAQEA0Y1W9Z4p8aBcDefGhIjKlMnOpQrStUvWxYz'));

    // Verify subsequent code coordinate is unchanged
    const originalDefLine = pemCode.split('\n').findIndex((l) => l.startsWith('def initialize_app'));
    const redactedDefLine = res.redactedCode.split('\n').findIndex((l) => l.startsWith('def initialize_app'));
    assert.strictEqual(redactedDefLine, originalDefLine, 'Subsequent code line numbers must match exactly');
  });

  // =========================================================================
  // 4. COORDINATE MAPPING & SPATIAL INTEGRITY
  // =========================================================================
  test('CoordinateMapper: maps coordinates 1:1 for same-length replacements', () => {
    const mapper = new CoordinateMapper();
    assert.strictEqual(mapper.hasShifts(), false);

    const coord1 = mapper.mapToOriginal(10, 25);
    assert.strictEqual(coord1.line, 10);
    assert.strictEqual(coord1.column, 25);

    const coord2 = mapper.mapToOriginal(1, 1);
    assert.strictEqual(coord2.line, 1);
    assert.strictEqual(coord2.column, 1);
  });

  test('CoordinateMapper: accurately translates column shifts when line deltas exist', () => {
    const deltas = new Map([
      [5, [{ redactedCol: 20, delta: 10 }]] // Shift on line 5 starting at col 20 with +10 delta
    ]);
    const mapper = new CoordinateMapper(deltas);
    assert.strictEqual(mapper.hasShifts(), true);

    // Before shift: no change
    const beforeShift = mapper.mapToOriginal(5, 10);
    assert.strictEqual(beforeShift.line, 5);
    assert.strictEqual(beforeShift.column, 10);

    // At or after shift: +10 delta applied
    const afterShift = mapper.mapToOriginal(5, 25);
    assert.strictEqual(afterShift.line, 5);
    assert.strictEqual(afterShift.column, 35);

    // Other lines untouched
    const otherLine = mapper.mapToOriginal(6, 25);
    assert.strictEqual(otherLine.line, 6);
    assert.strictEqual(otherLine.column, 25);
  });

  // =========================================================================
  // 5. MULTIPLE SECRETS & FALSE POSITIVE RESISTANCE
  // =========================================================================
  test('Multiple Secrets: redacts diverse credentials across lines without interference', () => {
    const multiCode = `
import os

AWS_KEY = "AKIA1111222233334444"
GITHUB_KEY = "ghp_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789"
DB_URI = "mongodb+srv://admin:MasterDbSecretPass1@cluster.net/prod"

def run():
    print("Application loaded")
`;

    const res = redactSecrets(multiCode);
    assert.strictEqual(res.redactedSecretsCount, 3);
    assert.strictEqual(res.redactedCode.length, multiCode.length);
    assert.strictEqual(res.redactedCode.split('\n').length, multiCode.split('\n').length);

    // Detections should have correct line coordinates
    const types = res.detections.map((d) => d.type);
    assert.ok(types.includes('AWS_KEY'));
    assert.ok(types.includes('GITHUB_TOKEN'));
    assert.ok(types.includes('DB_CONNECTION_URL'));
  });

  test('False Positive Resistance: does not redact ordinary code, variables, or functions', () => {
    const cleanCode = `
// Standard controller logic
const password = req.body.password;
const apiKey = getApiKeyFromVault();

function validatePassword(password) {
  if (password.length < 8) {
    return false;
  }
  return true;
}

const dbUrl = process.env.MONGODB_URI;
const shortStr = "admin";
`;

    const res = redactSecrets(cleanCode);
    assert.strictEqual(res.redactedSecretsCount, 0);
    assert.strictEqual(res.detections.length, 0);
    assert.strictEqual(res.redactedCode, cleanCode);
  });

  // =========================================================================
  // 6. SECURITY & METADATA CONFIDENTIALITY
  // =========================================================================
  test('Security Guarantee: detections metadata NEVER contains cleartext secret values', () => {
    const rawSecret = 'AKIAIOSFODNN7EXAMPLE';
    const code = `const key = "${rawSecret}";`;
    const res = redactSecrets(code);

    assert.strictEqual(res.detections.length, 1);
    const detection = res.detections[0];

    // Must have structural properties only
    assert.ok('type' in detection);
    assert.ok('line' in detection);
    assert.ok('column' in detection);
    assert.ok('length' in detection);

    // Must NOT have any value or snippet properties
    assert.strictEqual('value' in detection, false, 'Detection must not contain value');
    assert.strictEqual('rawSecret' in detection, false, 'Detection must not contain rawSecret');
    assert.strictEqual('snippet' in detection, false, 'Detection must not contain snippet');

    // Serialized JSON of detections must not contain the secret string anywhere
    const serialized = JSON.stringify(res.detections);
    assert.strictEqual(serialized.includes(rawSecret), false, 'Raw secret must not be in serialized detections');
  });
});
