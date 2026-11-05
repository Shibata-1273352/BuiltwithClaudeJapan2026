// The narration, and the check of the script: characters per second, and whether each line fits
// its scene. With ELEVENLABS_API_KEY set it uses the chosen ElevenLabs voice; without it, macOS say.
// The voice is given readings, because the words on screen are not always read as they look.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const VOICE = process.env.VOICE ?? "JBFqnCBsd6RMkjVDRZzb";
const MODEL = process.env.VOICE_MODEL ?? "eleven_v4";
const READINGS = [
  ["浅草寺", "せんそうじ"], ["浅草", "あさくさ"], ["SAM 3", "サムスリー"], ["17回", "じゅうななかい"], ["筆文字", "ふでもじ"], ["二冊", "にさつ"], ["明治", "めいじ"], ["AI", "エーアイ"], ["1856年。", "せんはっぴゃくごじゅうろくねん。"], ["観光庁", "かんこうちょう"], ["延べ約9,000本", "のべやくきゅうせんぼん"],
  ["風雷神門", "ふうらいじんもん"], ["風神と雷神", "ふうじんとらいじん"], ["TSUMUGI", "ツムギ"], ["Claude", "クロード"],
  ["1856年", "せんはっぴゃくごじゅうろくねん"], ["1878年", "せんはっぴゃくななじゅうはちねん"], ["1960年", "せんきゅうひゃくろくじゅうねん"],
  ["95年間", "きゅうじゅうごねんかん"], ["95年", "きゅうじゅうごねん"], ["金具", "かなぐ"], ["年月の銘", "ねんげつのめい"], ["寄進", "きしん"], ["延べ約9,000本", "のべやくきゅうせんぼん"],
  ["松下電器産業", "まつしたでんきさんぎょう"], ["松下幸之助", "まつしたこうのすけ"], ["根本中堂", "こんぽんちゅうどう"], ["上野", "うえの"], ["雷門", "かみなりもん"], ["恒久的", "こうきゅうてき"], ["銘板", "めいばん"],
  ["イザベラ・バード", "イザベラ バード"], ["紡ぐ", "つむぐ"], ["広重", "ひろしげ"], ["参道", "さんどう"],
];
const reading = (ja) => READINGS.reduce((t, [a, b]) => t.replaceAll(a, b), ja);

async function eleven(text, wav) {
  const hash = createHash("sha1").update(`${VOICE}|${MODEL}|${text}`).digest("hex").slice(0, 12);
  mkdirSync("out/voice/lines", { recursive: true });
  const mp3 = `out/voice/lines/${hash}.mp3`;
  if (!existsSync(mp3)) {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY, "content-type": "application/json" },
      body: JSON.stringify({ text, model_id: MODEL, language_code: "ja" }),
    });
    if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 200)}`);
    writeFileSync(mp3, Buffer.from(await r.arrayBuffer()));
  }
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", mp3, "-ar", "48000", "-ac", "1", wav]);
}

const lines = JSON.parse(readFileSync("narration/lines.json", "utf8"));
const { scenes, end, opening } = JSON.parse(readFileSync("timeline.json", "utf8"));
mkdirSync("public/guide", { recursive: true });
const index = [];
let bad = 0;
for (const [i, l] of lines.entries()) {
  const wav = `public/guide/${i}.wav`;
  if (process.env.ELEVENLABS_API_KEY) await eleven(reading(l.ja), wav);
  else execFileSync("say", ["-v", "Kyoko", "-r", "215", "-o", wav, "--data-format=LEI16@48000", reading(l.ja)]);
  const seconds = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", wav]).toString());
  const scene = scenes.find((s) => s.id === l.scene);
  const start = scene.start + l.at;
  const chars = l.ja.replace(/[、。『』？ ]/g, "").length;
  const next = lines[i + 1];
  const limit = next?.scene === l.scene ? scene.start + next.at : scene.end;
  const fits = start + seconds <= limit;
  if (!fits) bad++;
  const enRate = (l.sub ?? "").length / seconds;
  console.log(`${l.scene.padEnd(8)} ${chars} chars ${seconds.toFixed(1)}s ${(chars / seconds).toFixed(1)}/s  sub ${enRate.toFixed(1)}/s  ${fits ? "ok" : `OVER by ${(start + seconds - limit).toFixed(1)}s`}`);
  index.push({ wav: `guide/${i}.wav`, start, seconds, sub: l.sub });
}
writeFileSync("public/guide/index.json", JSON.stringify(index));
console.log(`total ${Math.floor(end / 60)}:${(end % 60).toFixed(1).padStart(4, "0")} (opening ${opening.duration}s); limit 2:57; ${bad} lines over`);
