// Lists the ElevenLabs plan, and Japanese voices from the shared library. The key stays in the env.
const key = process.env.ELEVENLABS_API_KEY;
if (!key) throw new Error("ELEVENLABS_API_KEY is not set");
const get = async (p) => {
  const r = await fetch(`https://api.elevenlabs.io${p}`, { headers: { "xi-api-key": key } });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const sub = await get("/v1/user/subscription");
console.log("subscription", sub.status, sub.body.tier ?? sub.body.detail?.status ?? "", sub.body.character_count, "/", sub.body.character_limit);
const models = await get("/v1/models");
console.log("models", models.status, Array.isArray(models.body) ? models.body.filter((m) => m.languages?.some((l) => l.language_id === "ja")).map((m) => m.model_id).join(" ") : models.body.detail?.status);
const mine = await get("/v1/voices");
console.log("own voices", mine.status, (mine.body.voices ?? []).length);
const shared = await get("/v1/shared-voices?language=ja&page_size=40&sort=usage_character_count_1y&use_cases=narrative_story");
console.log("shared", shared.status);
for (const v of shared.body.voices ?? []) {
  console.log([v.voice_id, v.public_owner_id?.slice(0, 6), v.name, v.gender, v.age, v.accent, v.use_case, v.descriptive, `free=${v.free_users_allowed}`, v.category].join(" | ").slice(0, 150));
}
