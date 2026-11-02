/**
 * FR-06 check: run the "see" stage on one image and save the result.
 *   npm run see -- $DATA_DIR/samples/kaminarimon_cc0.jpg
 * Output: $DATA_DIR/out/see/<name>.json (includes rate-limit headers for the tier check).
 */
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { seePhoto } from "../apps/web/src/lib/see";

const file = process.argv[2];
if (!file) throw new Error("usage: npm run see -- <image>");
const dataDir = process.env.DATA_DIR;
if (!dataDir) throw new Error("DATA_DIR is not set (.env)");

const ext = path.extname(file).toLowerCase();
const mediaType = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
if (statSync(file).size > 5 * 2 ** 20) throw new Error("image > 5MB; downscale first (API limit)");

const { validation, record } = await seePhoto({ base64: readFileSync(file).toString("base64"), mediaType });

const outDir = path.join(dataDir, "out", "see");
mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, `${path.basename(file, ext)}.json`);
writeFileSync(out, JSON.stringify({ validation, record }, null, 2));

console.log(JSON.stringify({ validation, record }, null, 2));
console.error(`\nsaved -> ${out}`);
process.exitCode = validation.ok ? 0 : 1;
