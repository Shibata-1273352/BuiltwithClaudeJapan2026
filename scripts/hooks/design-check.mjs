#!/usr/bin/env node
/**
 * Claude Code PostToolUse hook: after an edit under apps/web/src/app, run the design rules test
 * (CLAUDE.md "Design", apps/web/src/design.test.ts). A failure exits 2 with the report on stderr,
 * which Claude Code feeds back to Claude, so a broken rule is fixed in the same turn.
 */
import { execFileSync } from "node:child_process";

let input = "";
for await (const chunk of process.stdin) input += chunk;
let file = "";
try {
  const j = JSON.parse(input || "{}");
  file = j.tool_input?.file_path ?? j.tool_response?.filePath ?? "";
} catch {
  process.exit(0);
}
if (!/apps\/web\/src\/app\/.+\.(tsx?|css)$/.test(file)) process.exit(0);
try {
  execFileSync("npx", ["vitest", "run", "apps/web/src/design.test.ts", "--reporter=dot"], {
    cwd: process.env.CLAUDE_PROJECT_DIR || process.cwd(),
    stdio: "pipe",
    timeout: 120_000,
  });
} catch (e) {
  const out = `${e.stdout ?? ""}${e.stderr ?? ""}`.slice(-2000);
  process.stderr.write(`Design rules (CLAUDE.md, apps/web/src/design.test.ts) fail after editing ${file}:\n${out}`);
  process.exit(2);
}
