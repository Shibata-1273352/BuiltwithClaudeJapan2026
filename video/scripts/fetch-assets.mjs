// Copies the assets the compositions use into public/ (git-ignored). Rights: see ASSETS.md.
import { copyFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const data = process.env.DATA_DIR ?? join(homedir(), "tsumugi-data");

mkdirSync(join(root, "public"), { recursive: true });
copyFileSync(join(data, "samples/commons_lantern_of_kaminarimon_gate_3.jpg"), join(root, "public/lantern.jpg"));
copyFileSync(join(root, "../images/TSUMUGI.png"), join(root, "public/concept.png"));
console.log("assets copied to public/");
