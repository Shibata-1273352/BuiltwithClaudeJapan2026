// Timestamped contact sheet of a render, so a frame-by-frame check needs no video player.
// usage: node scripts/contact-sheet.mjs out/opening.mp4 out/opening-sheet.png [seconds between frames]
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [input, output, step = "0.5"] = process.argv.slice(2);
if (!input || !output) throw new Error("usage: contact-sheet <video> <sheet.png> [step]");

const dir = mkdtempSync(join(tmpdir(), "sheet-"));
mkdirSync(dir, { recursive: true });
execFileSync("ffmpeg", ["-v", "error", "-i", input, "-vf", `fps=1/${step},scale=640:-1`, join(dir, "f%03d.png")]);

const files = readdirSync(dir).sort();
const labelled = files.map((f, i) => {
  const out = join(dir, `l${f}`);
  const label = `${(i * Number(step)).toFixed(1)}s`;
  execFileSync("magick", [join(dir, f), "-font", "/System/Library/Fonts/Supplemental/Arial.ttf", "-gravity", "NorthWest", "-fill", "white", "-undercolor", "#00000080", "-pointsize", "22", "-annotate", "+8+8", label, out]);
  return out;
});
execFileSync("magick", ["montage", "-font", "/System/Library/Fonts/Supplemental/Arial.ttf", ...labelled, "-tile", "3x", "-geometry", "+4+4", "-background", "#111", output]);
rmSync(dir, { recursive: true });
console.log(`${output}: ${files.length} frames`);
