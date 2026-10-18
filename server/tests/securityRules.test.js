/**
 * Phase 9 — Step 1: Static Security Rules Unit Tests
 * server/tests/securityRules.test.js
 *
 * Verifies:
 * 1. Structural integrity and metadata of all 42 domain security rules.
 * 2. Positive vulnerability pattern detection across all 6 supported languages.
 * 3. Negative pattern immunity (safe APIs and parameterized code are not flagged).
 * 4. ReDoS safety verification (< 10ms execution on 50 KB adversarial buffers).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  allSecurityRules,
  securityRulesByDomain,
  securityRulesById,
  getSecurityRulesByLanguage,
  getSecurityRuleById
} from '../src/services/staticAnalyzer/rules/security/index.js';

describe('Phase 9 — Step 1: Static Security Rules Suite', () => {
  describe('1. Structural & Metadata Validation', () => {
    it('should export exactly 42 security rules across all domains', () => {
      assert.equal(allSecurityRules.length, 42);
      assert.equal(securityRulesById.size, 42);
    });

    it('every rule must possess valid ruleId, name, title, category, severity, cwe, owaspCategory, and confidence', () => {
      const validSeverities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
      const validConfidences = ['HIGH', 'MEDIUM', 'LOW'];

      for (const rule of allSecurityRules) {
        assert.ok(rule.ruleId, `Rule missing ruleId: ${JSON.stringify(rule)}`);
        assert.match(rule.ruleId, /^SEC-[A-Z]+-[A-Z]+-\d{3}$/, `Invalid ruleId format: ${rule.ruleId}`);
        assert.equal(rule.category, 'SEC', `Rule ${rule.ruleId} category must be 'SEC'`);
        assert.ok(validSeverities.includes(rule.severity), `Rule ${rule.ruleId} has invalid severity: ${rule.severity}`);
        assert.ok(validConfidences.includes(rule.confidence), `Rule ${rule.ruleId} has invalid confidence: ${rule.confidence}`);
        assert.match(rule.cwe, /^CWE-\d+$/, `Rule ${rule.ruleId} has invalid CWE: ${rule.cwe}`);
        assert.match(rule.owaspCategory, /^A\d{2}:2021-/, `Rule ${rule.ruleId} has invalid OWASP category: ${rule.owaspCategory}`);
        assert.ok(rule.regex instanceof RegExp, `Rule ${rule.ruleId} regex must be a RegExp instance`);
        assert.ok(rule.regex.global, `Rule ${rule.ruleId} regex must have global (g) flag`);
        assert.ok(typeof rule.explanation === 'string' && rule.explanation.length > 10, `Rule ${rule.ruleId} missing explanation`);
        assert.ok(typeof rule.remediation === 'string' && rule.remediation.length > 10, `Rule ${rule.ruleId} missing remediation`);
        assert.ok(Array.isArray(rule.languages) && rule.languages.length > 0, `Rule ${rule.ruleId} missing languages array`);
      }
    });

    it('should correctly filter rules by language', () => {
      const pythonRules = getSecurityRulesByLanguage('python');
      assert.ok(pythonRules.length >= 10);
      assert.ok(pythonRules.every((r) => r.languages.includes('python')));

      const jsRules = getSecurityRulesByLanguage('javascript');
      assert.ok(jsRules.length >= 14);
      assert.ok(jsRules.every((r) => r.languages.includes('javascript')));

      const javaRules = getSecurityRulesByLanguage('java');
      assert.ok(javaRules.length >= 8);
      assert.ok(javaRules.every((r) => r.languages.includes('java')));

      const cRules = getSecurityRulesByLanguage('c');
      assert.ok(cRules.length >= 6);
      assert.ok(cRules.every((r) => r.languages.includes('c')));
    });

    it('should correctly retrieve rules by ruleId', () => {
      const sqlRule = getSecurityRuleById('SEC-PY-SQL-001');
      assert.ok(sqlRule);
      assert.equal(sqlRule.cwe, 'CWE-89');
      assert.equal(sqlRule.severity, 'CRITICAL');
      assert.equal(sqlRule.confidence, 'HIGH');

      const nonExistent = getSecurityRuleById('SEC-NON-EXISTENT');
      assert.equal(nonExistent, null);
    });
  });

  describe('2. Positive Vulnerability Detections', () => {
    // --- PYTHON VULNERABILITIES ---
    it('SEC-PY-SQL-001: detects raw SQL f-string and format in Python', () => {
      const rule = getSecurityRuleById('SEC-PY-SQL-001');
      const snippet1 = 'cursor.execute(f"SELECT * FROM users WHERE id = {user_id}")';
      const snippet2 = 'db.execute("DELETE FROM orders WHERE user = \'%s\'" % name)';
      const snippet3 = 'cursor.execute("UPDATE accounts SET bal = 0 WHERE id = {}".format(uid))';

      assert.match(snippet1, new RegExp(rule.regex.source, rule.regex.flags));
      assert.match(snippet2, new RegExp(rule.regex.source, rule.regex.flags));
      assert.match(snippet3, new RegExp(rule.regex.source, rule.regex.flags));
    });

    it('SEC-PY-CMD-001: detects subprocess execution with shell=True in Python', () => {
      const rule = getSecurityRuleById('SEC-PY-CMD-001');
      const snippet = 'subprocess.Popen("ls -la " + path, shell=True)';
      assert.match(snippet, new RegExp(rule.regex.source, rule.regex.flags));
    });

    it('SEC-PY-DES-001: detects insecure pickle deserialization in Python', () => {
      const rule = getSecurityRuleById('SEC-PY-DES-001');
      const snippet = 'data = pickle.loads(untrusted_payload)';
      assert.match(snippet, new RegExp(rule.regex.source, rule.regex.flags));
    });

    it('SEC-PY-DES-002: detects unsafe yaml.load without SafeLoader in Python', () => {
      const rule = getSecurityRuleById('SEC-PY-DES-002');
      const snippet1 = 'config = yaml.load(data, Loader=yaml.Loader)';
      const snippet2 = 'config = yaml.unsafe_load(data)';
      assert.match(snippet1, new RegExp(rule.regex.source, rule.regex.flags));
      assert.match(snippet2, new RegExp(rule.regex.source, rule.regex.flags));
    });

    it('SEC-PY-DBG-001: detects active debug mode in Python', () => {
      const rule = getSecurityRuleById('SEC-PY-DBG-001');
      const snippet1 = 'DEBUG = True';
      const snippet2 = 'app.run(host="0.0.0.0", debug=True)';
      assert.match(snippet1, new RegExp(rule.regex.source, rule.regex.flags));
      assert.match(snippet2, new RegExp(rule.regex.source, rule.regex.flags));
    });

    it('SEC-PY-CRY-001: detects weak hash algorithms in Python (md5/sha1)', () => {
      const rule = getSecurityRuleById('SEC-PY-CRY-001');
      const snippet = 'token = hashlib.md5(password.encode()).hexdigest()';
      assert.match(snippet, new RegExp(rule.regex.source, rule.regex.flags));
    });

    it('SEC-PY-RNG-001: detects weak random module usage in Python', () => {
      const rule = getSecurityRuleById('SEC-PY-RNG-001');
      const snippet = 'session_id = random.randint(1000, 9999)';
      assert.match(snippet, new RegExp(rule.regex.source, rule.regex.flags));
    });

    it('SEC-PY-SSRF-001: detects unvalidated outbound requests in Python', () => {
      const rule = getSecurityRuleById('SEC-PY-SSRF-001');
      const snippet = 'resp = requests.get(target_url)';
      assert.match(snippet, new RegExp(rule.regex.source, rule.regex.flags));
    });

    it('SEC-PY-TRAV-001: detects path traversal via os.path.join in Python', () => {
      const rule = getSecurityRuleById('SEC-PY-TRAV-001');
      const snippet = 'with open(os.path.join(UPLOAD_DIR, request.args["file"])) as f:';
      assert.match(snippet, new RegExp(rule.regex.source, rule.regex.flags));
    });

    it('SEC-PY-DEP-001: detects dynamic module loading in Python', () => {
      const rule = getSecurityRuleById('SEC-PY-DEP-001');
      const snippet = 'plugin = importlib.import_module(module_name)';
      assert.match(snippet, new RegExp(rule.regex.source, rule.regex.flags));
    });

    // --- JAVASCRIPT / TYPESCRIPT VULNERABILITIES ---
    it('SEC-JS-SQL-001: detects raw SQL concatenation and templates in JS/TS', () => {
      const rule = getSecurityRuleById('SEC-JS-SQL-001');
      const snippet1 = 'db.query(`SELECT * FROM users WHERE email = \'${req.body.email}\'`);';
      const snippet2 = 'db.raw("SELECT * FROM accounts WHERE id = " + accountId);';
      assert.match(snippet1, new RegExp(rule.regex.source, rule.regex.flags));
      assert.match(snippet2, new RegExp(rule.regex.source, rule.regex.flags));
    });

    it('SEC-JS-CMD-001: detects command injection via child_process.exec in JS/TS', () => {
      const rule = getSecurityRuleById('SEC-JS-CMD-001');
      const snippet1 = 'child_process.exec("cat " + userFile, callback);';
      const snippet2 = 'child_process.exec(`ping ${host}`, callback);';
      assert.match(snippet1, new RegExp(rule.regex.source, rule.regex.flags));
      assert.match(snippet2, new RegExp(rule.regex.source, rule.regex.flags));
    });

    it('SEC-JS-NOSQL-001: detects MongoDB $where evaluation in JS/TS', () => {
      const rule = getSecurityRuleById('SEC-JS-NOSQL-001');
      const snippet = 'User.find({ $where: "this.name == \'" + name + "\'" });';
      assert.match(snippet, new RegExp(rule.regex.source, rule.regex.flags));
    });

    it('SEC-JS-EVAL-001: detects dynamic code execution in JS/TS (eval/new Function)', () => {
      const rule = getSecurityRuleById('SEC-JS-EVAL-001');
      const snippet1 = 'eval(userInput);';
      const snippet2 = 'const fn = new Function("a", "b", code);';
      assert.match(snippet1, new RegExp(rule.regex.source, rule.regex.flags));
      assert.match(snippet2, new RegExp(rule.regex.source, rule.regex.flags));
    });

    it('SEC-JS-XSS-001 & SEC-JS-XSS-002: detects DOM XSS and document.write in JS/TS', () => {
      const r1 = getSecurityRuleById('SEC-JS-XSS-001');
      const r2 = getSecurityRuleById('SEC-JS-XSS-002');
      assert.match('document.getElementById("out").innerHTML = rawHtml;', new RegExp(r1.regex.source, r1.regex.flags));
      assert.match('document.write("<p>" + userText + "</p>");', new RegExp(r2.regex.source, r2.regex.flags));
    });

    it('SEC-TS-XSS-001: detects React dangerouslySetInnerHTML in TS/JS', () => {
      const rule = getSecurityRuleById('SEC-TS-XSS-001');
      const snippet = '<div dangerouslySetInnerHTML={{ __html: unescapedContent }} />';
      assert.match(snippet, new RegExp(rule.regex.source, rule.regex.flags));
    });

    it('SEC-JS-COOKIE-001 & SEC-JS-COOKIE-002: detects insecure cookie options in JS/TS', () => {
      const r1 = getSecurityRuleById('SEC-JS-COOKIE-001');
      const r2 = getSecurityRuleById('SEC-JS-COOKIE-002');
      assert.match('res.cookie("token", val, { secure: false });', new RegExp(r1.regex.source, r1.regex.flags));
      assert.match('res.cookie("session", val, { httpOnly: false });', new RegExp(r2.regex.source, r2.regex.flags));
    });

    it('SEC-JS-CORS-001: detects wildcard CORS with credentials in JS/TS', () => {
      const rule = getSecurityRuleById('SEC-JS-CORS-001');
      const snippet = 'cors({ origin: "*", credentials: true })';
      assert.match(snippet, new RegExp(rule.regex.source, rule.regex.flags));
    });

    it('SEC-JS-TLS-001: detects rejectUnauthorized: false in JS/TS', () => {
      const rule = getSecurityRuleById('SEC-JS-TLS-001');
      const snippet = 'https.request({ rejectUnauthorized: false });';
      assert.match(snippet, new RegExp(rule.regex.source, rule.regex.flags));
    });

    it('SEC-JS-DES-001: detects node-serialize.unserialize in JS/TS', () => {
      const rule = getSecurityRuleById('SEC-JS-DES-001');
      const snippet = 'const obj = node-serialize.unserialize(serializedData);';
      assert.match(snippet, new RegExp(rule.regex.source, rule.regex.flags));
    });

    it('SEC-JS-SSRF-001: detects unvalidated axios/fetch requests in JS/TS', () => {
      const rule = getSecurityRuleById('SEC-JS-SSRF-001');
      const snippet1 = 'const res = await axios.get(req.query.target);';
      const snippet2 = 'const res = await fetch(remoteUrl);';
      assert.match(snippet1, new RegExp(rule.regex.source, rule.regex.flags));
      assert.match(snippet2, new RegExp(rule.regex.source, rule.regex.flags));
    });

    it('SEC-JS-DEP-001: detects dynamic require in JS/TS', () => {
      const rule = getSecurityRuleById('SEC-JS-DEP-001');
      const snippet = 'const module = require(modulePath);';
      assert.match(snippet, new RegExp(rule.regex.source, rule.regex.flags));
    });

    // --- JAVA VULNERABILITIES ---
    it('SEC-JAV-SQL-001: detects unprepared SQL concatenation in Java', () => {
      const rule = getSecurityRuleById('SEC-JAV-SQL-001');
      const snippet = 'stmt.executeQuery("SELECT * FROM accounts WHERE id = " + accountId);';
      assert.match(snippet, new RegExp(rule.regex.source, rule.regex.flags));
    });

    it('SEC-JAV-CMD-001: detects command injection in Java (Runtime.exec)', () => {
      const rule = getSecurityRuleById('SEC-JAV-CMD-001');
      const snippet = 'Runtime.getRuntime().exec("sh " + scriptPath);';
      assert.match(snippet, new RegExp(rule.regex.source, rule.regex.flags));
    });

    it('SEC-JAV-DES-001: detects Java readObject deserialization', () => {
      const rule = getSecurityRuleById('SEC-JAV-DES-001');
      const snippet = 'Object obj = ois.readObject();';
      assert.match(snippet, new RegExp(rule.regex.source, rule.regex.flags));
    });

    it('SEC-JAV-CRY-001 & SEC-JAV-CRY-002: detects weak ciphers and hashes in Java', () => {
      const r1 = getSecurityRuleById('SEC-JAV-CRY-001');
      const r2 = getSecurityRuleById('SEC-JAV-CRY-002');
      assert.match('Cipher c = Cipher.getInstance("DES");', new RegExp(r1.regex.source, r1.regex.flags));
      assert.match('Cipher c = Cipher.getInstance("AES/ECB/PKCS5Padding");', new RegExp(r1.regex.source, r1.regex.flags));
      assert.match('MessageDigest md = MessageDigest.getInstance("MD5");', new RegExp(r2.regex.source, r2.regex.flags));
    });

    it('SEC-JAV-XXE-001: detects DocumentBuilderFactory XXE risk in Java', () => {
      const rule = getSecurityRuleById('SEC-JAV-XXE-001');
      const snippet = 'DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();';
      assert.match(snippet, new RegExp(rule.regex.source, rule.regex.flags));
    });

    it('SEC-JAV-CRED-001: detects hardcoded JDBC database credentials in Java', () => {
      const rule = getSecurityRuleById('SEC-JAV-CRED-001');
      const snippet = 'Connection conn = DriverManager.getConnection("jdbc:mysql://localhost/db?user=root&password=SuperSecretPassword123");';
      assert.match(snippet, new RegExp(rule.regex.source, rule.regex.flags));
    });

    // --- C / C++ VULNERABILITIES ---
    it('SEC-C-BUF-001 to SEC-C-BUF-004: detects C memory hazards (strcpy, gets, sprintf, scanf)', () => {
      const r1 = getSecurityRuleById('SEC-C-BUF-001');
      const r2 = getSecurityRuleById('SEC-C-BUF-002');
      const r3 = getSecurityRuleById('SEC-C-BUF-003');
      const r4 = getSecurityRuleById('SEC-C-BUF-004');

      assert.match('strcpy(dest, src);', new RegExp(r1.regex.source, r1.regex.flags));
      assert.match('gets(buffer);', new RegExp(r2.regex.source, r2.regex.flags));
      assert.match('sprintf(buffer, "User: %s", name);', new RegExp(r3.regex.source, r3.regex.flags));
      assert.match('scanf("%s", input);', new RegExp(r4.regex.source, r4.regex.flags));
    });

    it('SEC-C-CMD-001 & SEC-CPP-CMD-001: detects system command invocation in C and C++', () => {
      const r1 = getSecurityRuleById('SEC-C-CMD-001');
      const r2 = getSecurityRuleById('SEC-CPP-CMD-001');

      assert.match('system(cmd);', new RegExp(r1.regex.source, r1.regex.flags));
      assert.match('std::system("rm -rf " + folder);', new RegExp(r2.regex.source, r2.regex.flags));
    });

    it('SEC-CPP-BUF-001 & SEC-CPP-FMT-001: detects C++ buffer hazards (strcpy/sprintf)', () => {
      const r1 = getSecurityRuleById('SEC-CPP-BUF-001');
      const r2 = getSecurityRuleById('SEC-CPP-FMT-001');

      assert.match('strcpy(dest, src);', new RegExp(r1.regex.source, r1.regex.flags));
      assert.match('sprintf(buf, "%d", value);', new RegExp(r2.regex.source, r2.regex.flags));
    });
  });

  describe('3. Negative Pattern Immunity (Safe Code Not Flagged)', () => {
    it('does NOT flag safe parameterized SQL in Python', () => {
      const rule = getSecurityRuleById('SEC-PY-SQL-001');
      const safe1 = 'cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))';
      const safe2 = 'cursor.execute("SELECT count(*) FROM orders")';
      assert.doesNotMatch(safe1, new RegExp(rule.regex.source, rule.regex.flags));
      assert.doesNotMatch(safe2, new RegExp(rule.regex.source, rule.regex.flags));
    });

    it('does NOT flag safe subprocess calls without shell in Python', () => {
      const rule = getSecurityRuleById('SEC-PY-CMD-001');
      const safe = 'subprocess.run(["ls", "-la", "/tmp"], shell=False, check=True)';
      assert.doesNotMatch(safe, new RegExp(rule.regex.source, rule.regex.flags));
    });

    it('does NOT flag safe PyYAML safe_load in Python', () => {
      const rule = getSecurityRuleById('SEC-PY-DES-002');
      const safe1 = 'data = yaml.safe_load(content)';
      const safe2 = 'data = yaml.load(content, Loader=yaml.SafeLoader)';
      assert.doesNotMatch(safe1, new RegExp(rule.regex.source, rule.regex.flags));
      assert.doesNotMatch(safe2, new RegExp(rule.regex.source, rule.regex.flags));
    });

    it('does NOT flag safe parameterized queries in JS/TS', () => {
      const rule = getSecurityRuleById('SEC-JS-SQL-001');
      const safe1 = 'db.query("SELECT * FROM users WHERE id = $1", [userId]);';
      const safe2 = 'db.query("SELECT * FROM accounts WHERE status = \'ACTIVE\'");';
      assert.doesNotMatch(safe1, new RegExp(rule.regex.source, rule.regex.flags));
      assert.doesNotMatch(safe2, new RegExp(rule.regex.source, rule.regex.flags));
    });

    it('does NOT flag safe child_process.execFile in JS/TS', () => {
      const rule = getSecurityRuleById('SEC-JS-CMD-001');
      const safe = 'child_process.execFile("ping", ["127.0.0.1"], callback);';
      assert.doesNotMatch(safe, new RegExp(rule.regex.source, rule.regex.flags));
    });

    it('does NOT flag safe cookie options (secure: true, httpOnly: true) in JS/TS', () => {
      const r1 = getSecurityRuleById('SEC-JS-COOKIE-001');
      const r2 = getSecurityRuleById('SEC-JS-COOKIE-002');
      const safe = 'res.cookie("token", val, { secure: true, httpOnly: true, sameSite: "strict" });';
      assert.doesNotMatch(safe, new RegExp(r1.regex.source, r1.regex.flags));
      assert.doesNotMatch(safe, new RegExp(r2.regex.source, r2.regex.flags));
    });

    it('does NOT flag safe PreparedStatement queries in Java', () => {
      const rule = getSecurityRuleById('SEC-JAV-SQL-001');
      const safe = 'PreparedStatement ps = conn.prepareStatement("SELECT * FROM users WHERE id = ?");';
      assert.doesNotMatch(safe, new RegExp(rule.regex.source, rule.regex.flags));
    });

    it('does NOT flag safe strncpy or snprintf in C', () => {
      const r1 = getSecurityRuleById('SEC-C-BUF-001');
      const r2 = getSecurityRuleById('SEC-C-BUF-002');
      const safe1 = 'strncpy(dest, src, sizeof(dest) - 1);';
      const safe2 = 'fgets(buf, sizeof(buf), stdin);';
      assert.doesNotMatch(safe1, new RegExp(r1.regex.source, r1.regex.flags));
      assert.doesNotMatch(safe2, new RegExp(r2.regex.source, r2.regex.flags));
    });
  });

  describe('4. ReDoS Safety Verification (< 10ms on 50 KB adversarial strings)', () => {
    it('all 42 regular expressions complete execution within 10ms on adversarial inputs', () => {
      // Construct a 50 KB adversarial string with repetitive characters and partial syntax tokens
      const baseChunk = 'const a = "SELECT * FROM users WHERE id = 12345" + \'abc\' + `${x}`;\n';
      const adversarialText = baseChunk.repeat(800); // ~56 KB
      assert.ok(adversarialText.length > 50000, `Buffer length: ${adversarialText.length}`);

      for (const rule of allSecurityRules) {
        const regex = new RegExp(rule.regex.source, rule.regex.flags);
        const startTime = process.hrtime.bigint();

        // Run regex execution over the 50 KB buffer
        let matchCount = 0;
        let match;
        while ((match = regex.exec(adversarialText)) !== null && matchCount < 100) {
          matchCount++;
          if (match.index === regex.lastIndex) regex.lastIndex++;
        }

        const endTime = process.hrtime.bigint();
        const durationMs = Number(endTime - startTime) / 1_000_000;

        assert.ok(
          durationMs < 10,
          `ReDoS warning: Rule ${rule.ruleId} took ${durationMs.toFixed(2)}ms (> 10ms threshold) on 50KB input`
        );
      }
    });
  });
});
