# Assets of the demo video

Images, audio and video are not committed (`.gitignore`); this lists where each comes from and on
what terms. "Not checked" means the record below was not re-verified at the source.

| Asset | Used for | Source | Terms | State |
| --- | --- | --- | --- | --- |
| `kaminarimon_cc0.jpg` | The lantern and 風雷神門 | Wikimedia Commons, `File:Lantern_of_Kaminarimon_Gate.JPG` | CC0 (`PROVENANCE.json`) | Not checked at Commons. Graded to dusk, cropped above the crowd |
| Hiroshige, *Kinryūsan Temple at Asakusa* (1856), in the app | Screen takes | The Met 56689 | Public domain (Open Access) | Not checked at The Met |
| `images/TSUMUGI.png` | Title card | Author's concept image | **Unknown** | Blocks the title card until the author confirms how it was made |
| VSCO 2 Community Edition | Strings, harp, percussion | github.com/sgossner/VSCO-2-CE | CC0 (repository licence, checked) | Fetched by `score/fetch-samples.sh` |
| Score | Music | Composed by Claude as code, `score/` | This repository | See `score/PROVENANCE.md` |
| Plucked string | Theme | `apps/web/src/lib/live/feel.ts`, ported | This repository | |
| Silk, thread and letters | Opening | Rendered in Blender Cycles, `render/` | This repository | Letters follow the strokes of the CC0 photo |
| Screen takes | App scenes | `scripts/record-takes.ts` | This repository | `read` is a live run; the others are the labelled recording |
| Narration | Voice | ElevenLabs `eleven_v4` | **Depends on the plan** | The free plan has no commercial licence; the chosen cloned voice needs a paid plan |
| Shippori Mincho, EB Garamond | Type | Google Fonts | SIL OFL | Not yet used in the final titles |

Credits on screen: music and thread by Claude Code; the photo graded to dusk; part of the recording
played at another speed; the title image is a concept image.
