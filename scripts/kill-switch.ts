/**
 * Kill switch (FR-53, 9.4.2 ASI10): stop new explorations immediately; running ones finish within
 * their own budget. Admin operation on the server machine only (writes $DATA_DIR/tsumugi.db).
 *   npm run kill -- on | off | status
 * TSUMUGI_KILL=1 in the environment also stops them (cannot be turned off from here).
 */
import { isKilled, setKill } from "../apps/web/src/lib/guards";

const cmd = process.argv[2] ?? "status";
if (cmd === "on") setKill(true);
else if (cmd === "off") setKill(false);
else if (cmd !== "status") throw new Error("usage: kill-switch.ts on | off | status");
console.log(JSON.stringify({ killed: isKilled(), env: process.env.TSUMUGI_KILL === "1" }));
