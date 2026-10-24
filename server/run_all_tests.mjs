import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: "../.env" });

const testFiles = fs.readdirSync("tests")
  .filter(f => f.endsWith(".test.js"))
  .sort();

console.log(`Found ${testFiles.length} test files to run sequentially:`);

let totalPassed = 0;
let totalFailed = 0;
let totalSuitesPassed = 0;
let totalSuitesFailed = 0;

for (const file of testFiles) {
  process.stdout.write(`Running ${file}... `);
  const start = Date.now();
  
  const testEnv = {
    ...process.env,
    NODE_ENV: "test",
    JWT_SECRET: "super-secret-jwt-key-for-testing-only-min-32-chars!"
  };

  // Only the comprehensive Phase 11 E2E suite issues >10 review requests within 60s
  if (file === "e2eFullApplicationPhase11.test.js") {
    testEnv.REVIEW_RATE_LIMIT_MAX = "100";
    testEnv.STATIC_ANALYSIS_RATE_LIMIT_MAX = "100";
  }

  const res = await new Promise((resolve) => {
    const child = spawn(process.execPath, ["--test", `tests/${file}`], {
      cwd: process.cwd(),
      env: testEnv
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", d => stdout += d.toString());
    child.stderr.on("data", d => stderr += d.toString());
    child.on("close", code => resolve({ code, stdout, stderr, duration: Date.now() - start }));
  });

  const passMatch = res.stdout.match(/(?:#|ℹ) pass (\d+)/);
  const failMatch = res.stdout.match(/(?:#|ℹ) fail (\d+)/);
  const pCount = passMatch ? parseInt(passMatch[1], 10) : 0;
  const fCount = failMatch ? parseInt(failMatch[1], 10) : 0;

  if (res.code === 0 && fCount === 0) {
    console.log(`PASS (${pCount} tests, ${res.duration}ms)`);
    totalSuitesPassed++;
    totalPassed += pCount;
  } else {
    console.log(`FAIL (${fCount} failed, ${pCount} passed, exit ${res.code}, ${res.duration}ms)`);
    totalSuitesFailed++;
    totalPassed += pCount;
    totalFailed += fCount;
    console.log("--- STDOUT ---");
    console.log(res.stdout);
    console.error("--- STDERR ---");
    console.error(res.stderr);
  }
}

console.log(`\n========================================`);
console.log(`Suites: ${totalSuitesPassed} passed, ${totalSuitesFailed} failed, ${testFiles.length} total`);
console.log(`Tests:  ${totalPassed} passed, ${totalFailed} failed, ${totalPassed + totalFailed} total`);
console.log(`========================================`);
if (totalSuitesFailed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
