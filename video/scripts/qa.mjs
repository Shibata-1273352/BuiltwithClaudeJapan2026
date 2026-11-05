// The last gate before submission: one command, pass or fail. Checks the file itself (a muxed audio
// track, length, size, loudness), the words (subtitle pace and line length, no 「コード」 in the voice),
// and the budget (how much of the film is the app and the real place).
//   node scripts/qa.mjs out/final.mp4
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";

const file = process.argv[2] ?? "out/final.mp4";
const LIMIT = 180; // the rule: three minutes
const OWN_LIMIT = 177; // ours: a margin for a player's rounding
const LUFS = [-17, -13];
const TRUE_PEAK = -1;
const SUB_CPS = 7; // Japanese subtitles read at about 4 per second in the Netflix guide; narration leads here, so the bar is the point of unreadable
const SUB_LINE = 30;
/** Scenes that are the working app, its output or the real place, for the budget. Printed in the result, to be judged by a person. */
const REAL = ["friend", "wall", "mystery", "press", "enter", "read", "print", "absence", "check", "burn", "gift", "reveal", "other", "close"];
const REAL_SHARE = 0.7;

const results = [];
const check = (name, ok, detail, warnOnly = false) => results.push({ name, ok, detail, warnOnly });

if (!existsSync(file)) {
  console.error(`no such file: ${file}`);
  process.exit(2);
}
const probe = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", file]).toString());
const video = probe.streams.find((s) => s.codec_type === "video");
const audio = probe.streams.find((s) => s.codec_type === "audio");
const duration = Number(probe.format.duration);
const mb = statSync(file).size / 1e6;

check("audio track", !!audio, audio ? `${audio.codec_name} ${audio.sample_rate} Hz ${audio.channels} ch` : "NONE: this is the silent render, not the muxed film");
check("video", video?.width === 1920 && video?.height === 1080, `${video?.codec_name} ${video?.width}x${video?.height} ${video?.r_frame_rate}`);
check("pixel format", video?.pix_fmt === "yuv420p", `${video?.pix_fmt} (players need yuv420p)`);
check("length", duration <= OWN_LIMIT, `${duration.toFixed(2)} s; rule ${LIMIT}, ours ${OWN_LIMIT}`);
check("size", mb < 2000, `${mb.toFixed(0)} MB`);
if (audio) {
  const gap = Math.abs(Number(audio.duration ?? duration) - Number(video.duration ?? duration));
  check("audio covers the film", gap < 0.2, `differs by ${gap.toFixed(2)} s`);
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-af", "ebur128=peak=true:framelog=quiet", "-f", "null", "-"], { encoding: "utf8" });
  const summary = r.stderr.slice(r.stderr.lastIndexOf("Summary:"));
  const lufs = Number(summary.match(/I:\s+(-?[\d.]+) LUFS/)?.[1]);
  const peak = Number(summary.match(/Peak:\s+(-?[\d.]+) dBFS/)?.[1]);
  check("loudness", lufs >= LUFS[0] && lufs <= LUFS[1], `${lufs} LUFS; want ${LUFS.join(" to ")}`);
  check("true peak", peak <= TRUE_PEAK, `${peak} dBFS; want ${TRUE_PEAK} or below`);
}
// a stretch of black longer than the film's breaths is a missing frame sequence
const black = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-vf", "blackdetect=d=1.5:pix_th=0.04", "-an", "-f", "null", "-"], { encoding: "utf8" });
const blacks = [...black.stderr.matchAll(/black_start:([\d.]+) black_end:([\d.]+)/g)].map((m) => `${m[1]}-${m[2]}`);
check("no long black", blacks.length === 0, blacks.join(", ") || "none", true);

const lines = JSON.parse(readFileSync("narration/lines.json", "utf8"));
const guide = JSON.parse(readFileSync("public/guide/index.json", "utf8"));
const { scenes, end } = JSON.parse(readFileSync("timeline.json", "utf8"));
const coded = lines.filter((l) => /コード/.test(l.ja + (l.sub ?? "")));
check("no コード in the voice", coded.length === 0, coded.map((l) => l.scene).join(", ") || "none");
check("subtitles match the voice", guide.length === lines.length && guide.every((g, i) => g.sub === lines[i].sub), `${guide.length} cues, ${lines.length} lines`);
const fast = guide.filter((g) => (g.sub ?? "").replace(/\s/g, "").length / g.seconds > SUB_CPS);
check("subtitle pace", fast.length === 0, fast.map((g) => g.sub.slice(0, 12)).join(" / ") || `all under ${SUB_CPS} per second`);
const long = guide.flatMap((g) => (g.sub ?? "").split("\n")).filter((l) => l.length > SUB_LINE);
check("subtitle line length", long.length === 0, long.join(" / ") || `all ${SUB_LINE} or fewer`);
const overrun = guide.filter((g, i) => guide[i + 1] && g.start + g.seconds > guide[i + 1].start);
check("no voice over voice", overrun.length === 0, overrun.map((g) => g.sub.slice(0, 12)).join(" / ") || "none");
check("timeline and file agree", Math.abs(end - duration) < 0.2, `timeline ${end.toFixed(2)}, file ${duration.toFixed(2)}`);
const counted = scenes.filter((s) => REAL.includes(s.id));
const real = counted.reduce((t, s) => t + s.end - s.start, 0);
check("the app and the place lead", real / end >= REAL_SHARE, `${((100 * real) / end).toFixed(0)}% of the film; want ${REAL_SHARE * 100}%. Counted: ${counted.map((s) => s.id).join(" ")}`);

for (const r of results) console.log(`${r.ok ? "ok  " : r.warnOnly ? "warn" : "FAIL"}  ${r.name.padEnd(26)} ${r.detail}`);
const failed = results.filter((r) => !r.ok && !r.warnOnly);
console.log(failed.length ? `\n${failed.length} failed: do not submit ${file}` : `\nall passed: ${file}`);
process.exit(failed.length ? 1 : 0);
