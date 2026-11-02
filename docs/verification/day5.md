# Day-5 verification (2026-11-02)

## 1. Timeline cross-check (requirement 11, prepared for human sign-off)
See `timeline-review.md`.
- Every event and time is backed by passage text containing the stated date.
- Official pages were re-fetched and every excerpt is still present verbatim.
- Lunisolar dates were converted with the NAOJ 日本の暦日データベース. Three corrections followed:
  - 1767 fire = 05-06
  - 1795 rebuild = 04-19..05-18
  - 1866 fire = 01-28 (Sensō-ji) / 01-30 (Kōun)
- The demo judgments are unchanged: 1856 present; 1878 and 1914 absent; the fire day unknown. `reviewed_by` stays null until the user signs off.

## 2. 言の地層 (FR-24, RAG-01)
Name usages are matched in code (dictionary, longest-first, no overlaps) on the canonical sentences of all retrieved passages:

| Entity | Usages found (source, year) |
| --- | --- |
| 浅草寺 | Kwan-non Temple (Bird 1878), Kinryūsan (Hiroshige 1856), Asakusa temple (Scidmore), 観音堂 (Kafū, Kōun) |
| 観音 | Kwan-non, goddess of mercy (Bird), Kwannon (Scidmore), 観音 (Kafū) |
| 宝蔵門 | Ni-ô (Bird), Nio (Scidmore), 二王門 (Kafū), 仁王門 (Kōun) |
| 雷門 | 雷門 (Kafū, Kōun), 風雷神門 (Sensō-ji), Kaminarimon (JTA) |

"Kwan-non Temple" counts as one usage of the temple and is not also counted as the deity.

## 3. Language switch (FR-40, RAG-08)
- Claims, evidence and threads are computed once and are language-independent. Only the narrative is generated per language.
- Each narrative is cached in `narratives`. The other language is generated in the background right after the first one, and concurrent requests share one Claude call.
- `scripts/check-rag08.ts` on the latest exploration: one `threads` event, and both the ja and en narratives cite only existing claim ids → **ok**.
- English narrative: Japanese names appear as romanization with the original in parentheses ("Kaminarimon (雷門)", "Hiyori Geta (日和下駄)").
- Switch time: about 12 s if generated on demand. When clicked right after completion it waits for the in-flight background job (about 8 s). After that it is instant (cached).

## 4. Finding: the face-detection library tries to send telemetry
In the browser, `@mediapipe/tasks-vision` attempted `fetch https://odml.pa.googleapis.com/v1/log`. Our CSP (`connect-src 'self'`) blocked it. Face detection works without it, so the CSP acts as a privacy control here (9.2, ASI04). Keep `connect-src 'self'`.

## 5. End to end (Kaminarimon CC0 photo)
- 48–57 s total: see 13 s, extract 11 s, gap + round 2 10–15 s, narrate 10 s.
- 5–6 Claude calls, about $0.15–0.17 (plus about $0.02 for the background second language).
- **The 60 s budget is now tight.** Candidates for the next speed-up:
  - run gap evaluation and narrative preparation concurrently;
  - stream the see stage;
  - use effort `low` for the see stage.
