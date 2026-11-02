# Day-2 verification (2026-11-02, 11/3 milestone pulled forward)

Covers the 11/3 milestone in REQUIREMENTS.md section 14: spatial checks, corpus ingestion, search, context headers, the vector-search decision, on-device preprocessing, and inputs for the GO/fallback decision.

## 1. Spatial layer (間) — FR-28..32

Pipeline: `services/inference/scripts/build_scene.py` (SAM 3 + Depth Anything V2 Small on MPS).

| Element (photo `kaminarimon_cc0.jpg`) | SAM 3 prompt | Score | Relative depth | Layer |
| --- | --- | --- | --- | --- |
| Lantern | "paper lantern" | 0.894 | 4.48 | foreground |
| Lantern base | "gold metal base of the lantern" | 0.946 | 4.34 | foreground |
| Gate | "vermilion wooden structure" | 0.851 | 3.82 | midground |
| People | "person" (union) | 0.921 | 1.28 | background |

- "temple gate", "gate" and "red gate" returned nothing; a descriptive prompt ("vermilion wooden structure") worked. Prompts from the see stage should therefore be descriptive, with generic words as the fallback (4.10 step 1).
- Timing for a full scene: 4 prompts at about 2.9 s each, plus depth 0.4 s and the background plate 0.2 s, so about 12 s. That is within the 15 s "first mask" budget if the lantern prompt runs first and the model is warm.
- Background plate: lifted regions are inpainted with OpenCV Telea at 512 px, which took 12 s down to 0.2 s. Without it, a "ghost" lantern stays visible behind the floating cutout.

### Alignment to Hiroshige (FR-30, FR-31)

- Artifact `met-56689` is preprocessed with a box prompt (text prompts fail on the print; see day 1). Its annotation lives in `fixtures/artifacts/met-56689.json` with `annotated_by`.
- First attempt, aligning on the metal base (bottom + top-left of the base): the bases matched but the paper bodies did not. Hiroshige draws the lantern body much larger relative to its base than the real lantern is.
- Adopted: **silhouette anchors** (lowest point + leftmost point of the lantern mask) with a least-squares scale + translation and no rotation. Result: scale 1.87, 0.19 s. The lantern's left edge, bottom and base visibly coincide with the print (`$DATA_DIR/cache/scenes/kaminarimon_cc0/overlay_met-56689.jpg`).
- The print crops the top of its lantern, so only the lower part overlaps. This is expected and is what the "enter the painting" transition (FR-33, 11/6) will start from.

### Layered 3D view (FR-32)

- `/space/[id]` uses React Three Fiber. Each cutout floats to its layer depth over 750 ms and is scaled to compensate for depth, so the front view stays identical to the photo. Rotating reveals the layers.
- The overlay slider aligns the print, a list view mirrors the same content (6.4), and reduced motion is respected.
- Headless Chromium (software WebGL) runs at 52–57 fps. **Re-measure 60 fps in desktop Chrome with GPU.**

## 2. Corpus (FR-48) and search (FR-09)

Manifest: `corpus/sources.json`. Ingestion: `npm run corpus:ingest`. Raw downloads are cached in `$DATA_DIR/corpus/raw` with a sha256.

| Source | Lang | First pub. | Chapters | Passages | Sentences |
| --- | --- | --- | --- | --- | --- |
| Bird, *Unbeaten Tracks in Japan* (Gutenberg #2184, 1911 popular ed.) | en | 1880 | 46 | 1,322 | 4,287 |
| Scidmore, *Jinrikisha Days in Japan* (Gutenberg #72989) | en | 1891 | 39 | 1,621 | 4,506 |
| 永井荷風『日和下駄』(青空文庫 49658) | ja | 1915 | 12 | 194 | 885 |
| 高村光雲『幕末維新懐古談』(青空文庫, all 80 chapters) | ja | 1929 | 80 | 1,649 | 4,149 |
| 浅草寺 公式「雷門」 (excerpts, verified against the page) | ja | — | 1 | 6 | 6 |
| 観光庁 多言語解説文 R1-01373 (excerpts, verified) | en | — | 1 | 3 | 3 |

- **Important finding (research subagent, checked against the texts):** the "grand red gate with the Ni-ô" in Bird (Letter V) and Scidmore is the **Niōmon (today's Hōzōmon)**, not Kaminarimon. Kaminarimon did not exist from the 1865/66 fire until 1960. Neither English book mentions "Kaminari" or "Thunder Gate". This supports RAG-02 and the "absence" thread.
- Kōun is an eyewitness of the fire: 「慶応元年丑年の十二月十四日の夜…浅草始まっての大火で雷門もこの時に焼けてしまった」. Sensō-ji gives 慶応元年12月12日 / 田原町, Kōun gives 12月14日 / 三軒町, and the JTA text gives 1866 plus temporary gates. 慶応元年12月 falls in late January 1866 in the Gregorian calendar, so 1865 vs 1866 is a calendar conversion. The day, the fire's origin and the temporary gates are real disagreements, to be stored as Conflicts.
- Excerpt verification works: one sentence the research agent had paraphrased (「失火で」 vs the page's 「失火により」) was rejected at ingestion and then corrected.
- Mention counts (whole words for English, index chapters excluded): Bird Asakusa 6 / Kwan-non 8; Scidmore 3 / 5; 日和下駄 浅草 19 / 観音 7 / 雷門 1; 懐古談 浅草 57 / 観音 86 / 雷門 30.
- Search: named entities (A) plus relation vocabulary (B), fused with RRF, on SQLite FTS5 (unicode61 for English, trigram for Japanese) with a full scan for Japanese terms of 2 characters or fewer.
  - FR-09 met: English top results are Bird Letter V and Scidmore Ch. VI; Japanese top results are 日和下駄「第五 寺」 and 懐古談 ch. 11–13.
  - **Retrieval time: 15 ms.**

## 3. Context headers (FR-54)

- One Claude call per chapter (`claude-opus-5-5`, effort low, structured output), 175 chapters, **≈ $7.2 total**, 0 failures. Coverage is 100% of book passages.
- Date and place are recorded only when stated in the text; inferred values are marked `[estimated]`. For example, Bird Letter V gets "June 9 / H.B.M.'s Legation, Yedo" because the year is not written in the letter.
- Headers never identify Bird's gate as Kaminarimon (checked).
- Deviation from 4.4.2: requirement 4.4.2 says the whole book is shared via prompt caching. Chapter-level context was used instead because it is cheaper and enough for these headers.
- With headers, English candidates for the Asakusa query rose from 20 to 34. `searchEntities(..., { useHeader: false })` allows the RAG-12 comparison.

## 4. Vector search decision (FR-12) — stays P1

- FTS plus context headers already meets FR-09 in both languages in 15 ms.
- An embedding model would compete with SAM 3 for memory on the 16 GB machine.
- Revisit on 11/8 if the A–D comparison shows a recall gap that vectors would close.

## 5. On-device preprocessing (FR-02, FR-03)

- Steps: `createImageBitmap` (EXIF orientation applied), downscale to 2048 px long side, MediaPipe BlazeFace face detection, mosaic, then canvas JPEG.
- E2E (`scripts/e2e-capture.ts`, headless Chromium) on a 4096×3072 JPEG with EXIF GPS: output 2048×1536, **no EXIF**, send enabled, 0.8 s.
- Failure is fail-closed (verified when the full-range model errored): an error is shown and sending stays disabled.
- Model: the **full-range BlazeFace model is not supported by the Tasks API** (anchors 2304 vs 896), so the short-range model (Apache-2.0 per its model card) runs on multi-scale tiles (full, 768, 384, 256 px).
- Thresholds were tuned on raw detections: every detection ≥ 0.63 was a face; signs and lanterns scored 0.53–0.59. Adopted minScore 0.6 (0.7 for the full-image pass), a size cap of 60% of the tile, and NMS.
- **Known limitation:** profile and downward-looking faces are missed. On the test photo, about 70% of clearly visible faces were blurred.
  - Mitigations: the "missed detections are possible" notice, tap-to-add blur, preview before sending, and composing shots without faces (9.2).
  - Revisit on 11/4 with on-site photos.
- Model card note: "Any form of surveillance or identity recognition is explicitly out of scope". We only blur.

## 6. GO / fallback inputs (11/3 night)

| Item | Status |
| --- | --- |
| Masks, depth and layers | GO |
| Alignment to Hiroshige | GO (silhouette anchors; artifact anchors pre-annotated and shown) |
| Layered 3D | GO (verify 60 fps on GPU Chrome) |
| Corpus (2 English + 2 Japanese books + official excerpts) | GO |
| Face blur | GO with known limitation (profiles); manual blur available |
| Memory | Docker still 7.7 GB → lower to 4 GB and re-measure |

**Recommendation: GO (no fallback).**
