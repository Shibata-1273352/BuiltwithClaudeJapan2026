# Assets of the demo video

Images, audio and video are not committed (`.gitignore`); this lists where each comes from and on
what terms. "Not checked" means the record below was not re-verified at the source.

| Asset | Used for | Source | Terms | State |
| --- | --- | --- | --- | --- |
| `kaminarimon_cc0.jpg` | The lantern and 風雷神門 | Wikimedia Commons, `File:Lantern_of_Kaminarimon_Gate.JPG` | CC0 (`PROVENANCE.json`) | Not checked at Commons. Graded to dusk, cropped above the crowd |
| Hiroshige, *Kinryūsan Temple at Asakusa* (1856), in the app | Screen takes | The Met 56689 | Public domain (Open Access) | Not checked at The Met |
| `images/TSUMUGI.png` | Concept card | Author's concept image, made with generative AI | Usable (author confirmed) | Labelled on screen as a generated concept image |
| VSCO 2 Community Edition | Strings, harp, percussion | github.com/sgossner/VSCO-2-CE | CC0 (repository licence, checked) | Fetched by `score/fetch-samples.sh` |
| Score | Music | Composed by Claude as code, `score/` | This repository | See `score/PROVENANCE.md` |
| Plucked string | Theme | `apps/web/src/lib/live/feel.ts`, ported | This repository | |
| Silk, thread and letters | Opening, title, bridges, reach | Rendered in Blender Cycles, `render/` | This repository | Letters follow the strokes of the CC0 photo; the title is Shippori Mincho laid as satin stitch; the reach is a picture, labelled 模式図, not data |
| Screen takes | App scenes | `scripts/record-takes.ts` | This repository | One live run from the reading to the knot; enlarged cuts are stills from the recording, labelled 拡大 |
| Postcard | Close | The app's `/api/explorations/<id>/postcard`, native 1080×1920 | This repository | |
| Narration | Voice | ElevenLabs `eleven_v4`, stock voice George | Usable (author confirmed) | Fixed; do not regenerate |
| Shippori Mincho, EB Garamond | Type | Google Fonts | SIL OFL | Subtitles, credits, title stitch paths |

Credits on screen: author and role; music and thread images made with Claude Code. Small notes on their scenes: the photo graded to dusk, the print's film framing, the reach as a schematic, the concept image as generated.
