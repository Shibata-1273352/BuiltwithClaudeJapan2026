// A few voices reading the same line, so the voice can be chosen by ear.
import { mkdirSync, writeFileSync } from "node:fs";

const key = process.env.ELEVENLABS_API_KEY;
const text = "この門には、もうひとつの名前が刻まれています。ふうらいじんもん、風神と雷神の門。あの日、友人には答えられなかった。確かめた糸で紡ぐ。ツムギ。";
const voices = { george: "JBFqnCBsd6RMkjVDRZzb", daniel: "onwK4e9ZLuTAKqWW03F9", alice: "Xb7hH8MSUJpSbSDYk0k2", matilda: "XrExE9yKIg6WjtfovkQ3" };
mkdirSync("out/voice", { recursive: true });
for (const model of ["eleven_v3", "eleven_multilingual_v2"]) {
  for (const [name, id] of Object.entries(voices)) {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${id}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": key, "content-type": "application/json" },
      body: JSON.stringify({ text, model_id: model, language_code: "ja" }),
    });
    const b = Buffer.from(await r.arrayBuffer());
    if (r.ok) writeFileSync(`out/voice/${name}-${model}.mp3`, b);
    console.log(name, model, r.status, r.ok ? `${b.length} bytes` : b.toString().slice(0, 160));
  }
}
