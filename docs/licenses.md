# ライセンス

## 本体

このリポジトリのコードは [MIT License](../LICENSE) です。

## ソフトウェア

配布対象の npm 依存（開発用を除く）は `package-lock.json` で固定しています。多くは MIT、Apache-2.0、ISC、BSD です。注意が必要なものは次のとおりです。

| 名前 | ライセンス | 扱い |
| --- | --- | --- |
| sharp の libvips バイナリ（`@img/sharp-libvips-*`） | LGPL-3.0-or-later | 改変せず、別パッケージの共有ライブラリとして利用 |
| Neo4j Community 5.26.32 | GPLv3 | 改変せず、公式イメージを別コンテナで実行（同梱しない。digest で固定） |
| caniuse-lite | CC-BY-4.0 | ビルドツールのデータ |
| Remotion 4 | Remotion License | 個人の Free License の範囲で、動画の制作にのみ使用。アプリには含まない |

主なもの：Next.js、React（MIT）、three.js（MIT）、Tailwind CSS（MIT）、zod（MIT）、better-sqlite3（MIT）、neo4j-driver（Apache-2.0）、Anthropic SDK（Apache-2.0）。Python 側は `services/inference/uv.lock` で固定しています（PyTorch、Transformers、FastAPI など）。

各パッケージのライセンス本文は、それぞれの配布物に含まれます。

## モデル

| モデル | ライセンス | 扱い |
| --- | --- | --- |
| Claude | Anthropic の利用規約 | API で利用 |
| SAM 3 | SAM License | 重みは同梱しない。利用者が Hugging Face で同意して取得する |
| Depth Anything V2 Small | Apache-2.0 | 同上、取得スクリプトで取得 |
| SigLIP so400m | Apache-2.0 | 同上 |
| MediaPipe Face Detector | Apache-2.0 | 顔のぼかしにのみ使用（監視や個人識別には使わない） |

**SAM License の要約**（2026-11-02 に確認、2025-11-19 版）：利用、改変、再配布を認める非独占のライセンスで、非商用や研究用途への限定はありません。再配布時のライセンス本文の同梱、成果物での SAM の明記、輸出規制に関する禁止（軍事、兵器、諜報、核）、リバースエンジニアリングの禁止が条件です。TSUMUGI は重みを再配布しません。

## 資料

資料の本文は取り込み時に取得し、リポジトリには含めません。出所と条件は `corpus/sources.json` に資料ごとに記録しています。

| 資料 | 条件 |
| --- | --- |
| Isabella Bird, *Unbeaten Tracks in Japan* | パブリックドメイン（Project Gutenberg） |
| Eliza Scidmore, *Jinrikisha Days in Japan* | パブリックドメイン（Project Gutenberg） |
| 永井荷風『日和下駄』、高村光雲『幕末維新懐古談』 | パブリックドメイン（青空文庫） |
| 浅草寺、寛永寺、観光庁、国立国会図書館、GO TOKYO、東京都建設局 | 出典を明記した短い引用。抜粋は取り込み時に原文と照合 |
| The Met Collection API | データは CC0、画像はパブリックドメインのもののみ |

## 画像

| 素材 | 条件 |
| --- | --- |
| サンプル写真 | CC0、パブリックドメイン（`corpus/samples.json`） |
| 広重《名所江戸百景》ほか | パブリックドメイン（`corpus/visual-gallery.json`） |
| `images/TSUMUGI.png` | 作者が生成 AI で作成したコンセプト画像 |

## フォント

Shippori Mincho、EB Garamond（SIL Open Font License）。

## デモ動画

動画の素材は Git に含めません。出所は [video/ASSETS.md](../video/ASSETS.md) に記録しています。音楽は Claude がコードで作曲し、弦とパーカッションの音源は VSCO 2 Community Edition（CC0）です。語りは ElevenLabs です。
