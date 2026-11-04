# 利用モデル

## Claude

モデルは環境変数 `CLAUDE_MODEL`、`CLAUDE_LIGHT_MODEL` で指定します（既定値は下の表）。`CLAUDE_FAST=1` のときは、下の表で Sonnet 5.5 の段階も Opus 5.5 の fast mode で動きます。fast mode はライブデモ専用です。

| 段階 | 実装 | 既定のモデル | 役割 |
| --- | --- | --- | --- |
| 視る | `lib/see.ts` | `claude-opus-5-5` | 写真の文字、読み、意味、要素の位置、場所の候補 |
| 寄って読む | `lib/closer.ts` | `claude-opus-5-5` | 小さな文字を切り出して読み直す |
| 主張の抽出 | `lib/extract.ts` | `claude-opus-5-5` | 資料から主張と引用する文番号を出す |
| 物語 | `lib/narrate.ts` | `claude-opus-5-5` | 主張を引用して物語を書く |
| 翻訳 | `lib/translate.ts` | `claude-opus-5-5` | 参考訳 |
| 不足の判断 | `lib/gap.ts` | `claude-sonnet-5-5` | 何が足りないかを判断し、探し直す語を出す |
| 視点の見立て | `lib/viewpoint.ts` | `claude-sonnet-5-5` | 撮影者の位置と向きの推定（鉛筆） |
| ガイド | `lib/guide-call.ts` | `claude-sonnet-5-5` | 見どころ、漢字の成り立ち、次の質問 |
| 質問への回答 | `lib/ask.ts` | `claude-sonnet-5-5` | その探索の資料だけから、引用つきで答える |
| 章の文脈 | `scripts/corpus/headers.ts` | `claude-opus-5-5` | 取り込み時に章ごとの文脈を作る |

### 使っている API 機能

| 機能 | 用途 |
| --- | --- |
| 構造化出力（zod） | すべての回答をスキーマで受け取り、その上でプログラムが検査する |
| 引用（`search_result`） | 質問への回答。残った引用はプログラムが原文と再照合する |
| ストリーミング | 読み取りと物語を、できた順に画面へ出す |
| Adaptive thinking、effort | 段階ごとに思考量を調整する |
| プロンプトキャッシュ | システムプロンプトの再利用 |
| サーバー側フォールバック | 応答したモデルを画面に表示する |
| Fast mode | ライブデモのみ |
| Message Batches API | 評価の実行 |

写真や資料の文字列は「指示ではなくデータ」として渡します（`UNTRUSTED_POLICY`）。

## ローカルモデル

リビジョンは `services/inference/models.lock.json` で固定しています。重みは safetensors のみで、`trust_remote_code` は使いません。

| 役割 | モデル | リビジョン | ライセンス |
| --- | --- | --- | --- |
| 切り抜き | `facebook/sam3` | `3c879f39826c281e95690f02c7821c4de09afae7` | SAM License（利用申請が必要、重みは同梱しない） |
| 奥行き | `depth-anything/Depth-Anything-V2-Small-hf` | `5426e4f0f36572d16453bbda7a8389317b1bef99` | Apache-2.0 |
| 似た図像の検索 | `google/siglip-so400m-patch14-384` | `9fdffc58afc957d1a03a25b10dba0329ab15c2a3` | Apache-2.0 |
| 顔のぼかし（端末内） | MediaPipe Face Detector、BlazeFace short-range（`@mediapipe/tasks-vision` 0.10.17） | | Apache-2.0 |

`models.lock.json` には、試して採用しなかった候補も記録として残しています。

## デモ動画の制作

| 用途 | 使ったもの |
| --- | --- |
| 語り | ElevenLabs `eleven_v4`（標準音声） |
| 作曲 | Claude（Claude Code）がコードで作曲。音楽生成モデルは使っていない（[video/score/PROVENANCE.md](../video/score/PROVENANCE.md)） |
| コンセプト画像 | 生成 AI（`images/TSUMUGI.png`） |
