# TSUMUGI（紡ぎ）

[![CI](https://github.com/Shibata-1273352/BuiltwithClaudeJapan2026/actions/workflows/ci.yml/badge.svg)](https://github.com/Shibata-1273352/BuiltwithClaudeJapan2026/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE) [![Built with Claude Code](https://img.shields.io/badge/Built%20with-Claude%20Code-D97757.svg)](#claude-code-での開発)

**日本語** | [English](README.en.md)

> 撮るだけで、目の前の日本が、意味と物語になる。

**▶ [デモ動画を見る（2分51秒、YouTube）](https://youtu.be/ftTCR_WoUME)**

TSUMUGI は、旅先で撮った一枚の写真から、そこに書かれた言葉と、その場所の歴史を、根拠をたどれる形で返すアプリです。Built with Claude Japan 2026 のために、ハッカソン期間中に新規開発しました。

![雷門の写真を解析した TSUMUGI の画面](apps/web/public/landing/hero-ja.jpg)

| 読む | 時をめくる | 持ち帰る |
| --- | --- | --- |
| ![Claude のガイド](apps/web/public/landing/read-ja.jpg) | ![1878年、恒久的な雷門はまだ再建されていなかった](apps/web/public/landing/time-ja.jpg) | ![確かめた一文の絵はがき](apps/web/public/landing/postcard-ja.jpg) |

- **動画の構成：** [docs/demo-script.md](docs/demo-script.md)
- **動かす：** [キーなしで録画を見る](#キーなしで録画を見る)、[すべての機能を使う](#すべての機能を使う)
- **Claude の使い方：** [Claude Code での開発](#claude-code-での開発)
- **評価：** 手作りの小さな評価セットで、資料の刊行年で判定すると存在の判定は 41%、時代の取り違えは 6 件でした。年表で判定すると取り違えは 0 件で、捏造した引用は 4/4 を拒否しました（[詳細と限界](docs/evaluation.md)）

## きっかけ

浅草で、外国人の友人に聞かれました。「これ、なんて書いてあるの？ いつからあるの？」。人と人をつなぐ通信の仕事をしているのに、答えられませんでした。TSUMUGI は、時と場所と人を、確かめた糸でつなぎます。

![TSUMUGI コンセプト画像](images/TSUMUGI.png)

*生成AIによるコンセプト画像*

## 解く課題

旅先で目の前の文字が読めても、それが何を意味し、いつからそこにあるのかまでは分かりません。写真の文字を訳すアプリは「いつからあるか」には答えず、AI の答えは根拠をたどれず、時代を取り違えることがあります。TSUMUGI は、写真から言葉と歴史を、確かめた根拠つきで返します。

- 2025年の訪日客は 42,683,600 人で、過去最多でした（[JNTO、2026-01-21](https://www.jnto.go.jp/news/press/20260121_monthly.html)）。
- 観光庁は 2018 年度から英語解説を延べ約 9,000 本整えてきました。観光地の魅力が「伝わらない」からです（[多言語解説整備支援事業](https://www.mlit.go.jp/tagengo-db/about.html)）。TSUMUGI は、写真からこのデータベースの解説を探し、確かめて引用します。
- 文化庁と観光庁の指針は、直訳ではなく、訪問者の理解に必要なことを補うよう求めています（「文化財の英語解説のあり方について」2016）。

使う人は、日本が好きな旅行者と、その人たちを案内する日本人です。門や看板や提灯の前で、スマートフォンを手にしている場面を想定しています。

## ほかの方法との違い

公開資料で確認できる範囲の比較です（2026-11-04 確認）。

| ほかの方法 | TSUMUGI |
| --- | --- |
| 写真の文字を翻訳する（Google Lens、Papago、DeepL、Apple Visual Look Up） | 筆文字と元号を読み、意味と漢字を説明し、人が確認した年表から「いつからあるか」を答える |
| Web のリンクで答える（Lens の AI Overviews） | 当時の一次資料を日英の原文のまま引用し、主張ごとに引用した文とプログラムで照合する |
| 決まった場所で過去を AR で見せる（Hyper Edohaku XR、NHK AR タイムワープ） | 選んだ年にそれがあったかをプログラムが判定し、資料が食い違えば両方を示す |
| 機関が書いたガイド（Bloomberg Connects、Smartify） | どの写真からでも動き、確かめられる場所でだけ歴史を語り、資料にないことは「書かれていない」と答える |

## 何ができるか

| 体験 | 内容 |
| --- | --- |
| **読む** | Claude が写真の筆文字を原文のまま読み（風雷神門）、小さな銘板は寄って読み直します |
| **答える** | 「いつからあるの？」には、人が確認した年表からプログラムが答えます |
| **探す** | 日英の資料を手分けして読み、足りないと判断すれば Claude が自分で探し直します |
| **確かめる** | 主張は引用した文と照合し、否定の文は事実として採りません |
| **時をめくる** | 年を動かすと、門が焼け、再建されます。その年に門があったかはプログラムが判定します |
| **結ぶ** | 銘板の読みと日英の記録をプログラムが照合し、同じ文字に線を引きます |
| **絵の中へ** | 広重の版画が奥行きを持って開き、雪が舞います |
| **持ち帰る** | 確かめた一文を、絵はがきと旅ノートに残せます |

資料と年表があるのは、雷門（浅草寺）、根本中堂（上野・寛永寺）、吾妻橋の3か所です。雷門と根本中堂の年表は人が確認済みで、吾妻橋はこれから確認します。ほかの場所でも読み取りとガイドは動き、歴史は確かめられる場所でだけ語ります。

## 設計の核：Claude が読み、プログラムが決める

Claude には読むこと、判断すること、書くことを任せます。旅行者が頼りにする「はい／いいえ」は、すべてプログラムが決めます。

| | Claude | プログラム |
| --- | --- | --- |
| 写真 | 文字を読む、場所の候補を挙げる | 場所を辞書と照合する |
| 資料 | 主張を抜き出す、足りないものを判断する | 引用が原文にあるか、否定文でないかを検査する |
| 時間 | 担当しない | 年表と照合し、あった・なかったを判定する |
| 物語 | 主張を引用して書く | 一文ずつ引用を検査し、通らない文は出さない |

アプリの画面でも、Claude の出力とプログラムの判定は別の印で区別しています。処理の流れは[アーキテクチャ](docs/architecture.md)、Claude の使い方は[利用モデル](docs/models.md)と [docs/claude-code.md](docs/claude-code.md) にまとめました。

## 構成図

```mermaid
flowchart LR
  U[旅行者のスマートフォン・ブラウザ] -->|写真と SSE| W[Next.js アプリ]
  W -->|読む・判断する・書く| C[Claude API]
  W -->|切り抜き・奥行き・似た図像| I[推論サーバー FastAPI]
  W --> S[(SQLite 資料とイベント)]
  W --> N[(Neo4j 根拠グラフ)]
```

## 利用モデル

| 役割 | モデル |
| --- | --- |
| 写真を読む、主張の抽出、物語 | Claude Opus 5.5（`claude-opus-5-5`） |
| 不足の判断、視点の見立て、ガイド、質問への回答 | Claude Sonnet 5.5（`claude-sonnet-5-5`）。fast mode では Opus 5.5 |
| 切り抜き | SAM 3 |
| 奥行き | Depth Anything V2 Small |
| 似た図像の検索 | SigLIP so400m |
| 顔のぼかし（端末内） | MediaPipe Face Detector |

バージョンの固定、各段階の詳細、プロンプトの場所は [docs/models.md](docs/models.md) にあります。

## 技術スタック

| 層 | 技術 |
| --- | --- |
| Web | Next.js 16（App Router）、React 19、TypeScript、Tailwind CSS 4、Three.js |
| AI | Claude API（Anthropic SDK）、推論サーバーは FastAPI と PyTorch（Apple Silicon の MPS） |
| データ | SQLite（資料とイベント）、Neo4j Community（根拠グラフ） |
| 検証 | Vitest、Playwright、GitHub Actions、gitleaks |
| デモ動画 | Remotion、Blender（Cycles）、Python による作曲 |

## Claude Code での開発

TSUMUGI は Claude Code で開発しました。開発の決まりと道具も、そのままリポジトリに残しています。

| ファイル | 役割 |
| --- | --- |
| [CLAUDE.md](CLAUDE.md) | Claude Code が毎回読む開発の決まり。費用の報告、手で数字を書かないこと、デザインの 10 の規則 |
| [.claude/agents/design-critic.md](.claude/agents/design-critic.md) | 実際の画面を、審査基準とデザインの規則で批評する別の目 |
| [.claude/skills/tsumugi-verify](.claude/skills/tsumugi-verify/SKILL.md) | 変更の種類ごとに、走らせる検証と Claude の費用を示す手順 |
| [.claude/settings.json](.claude/settings.json) | 画面のファイルを編集するたびにデザインの検査を走らせ、失敗を Claude に返すフック |
| [apps/web/src/design.test.ts](apps/web/src/design.test.ts) | デザインの規則をテストにしたもの |
| [video/](video/) | デモ動画のソースコード。編集、Blender の絹糸、作曲もコードです |

計画、批評、検証の進め方と、批評で何が変わったかは [docs/claude-code.md](docs/claude-code.md)（英語）にまとめました。

## 動かし方

### キーなしで録画を見る

Node.js 22 以上だけで、保存した実行の録画を操作できます。API キー、GPU、Neo4j、推論サーバーは要らず、Claude も呼びません。

本来の TSUMUGI は、写真の切り抜き（SAM 3）、奥行き（Depth Anything V2）、似た図像の検索（SigLIP）を GPU の推論サーバーで計算し、Claude API が写真を読みます。この手順は CPU だけで動く再現環境です。実際の実行で得た Claude の出力、切り抜き、奥行きを保存したものを読み込み、再生します。資料のデータベースと画像は、Release [`demo-assets-v1`](https://github.com/Shibata-1273352/BuiltwithClaudeJapan2026/releases/tag/demo-assets-v1) から取得します。

新しく clone したフォルダで実行してください（`.env` を作り直します）。

```bash
npm ci
mkdir -p "$HOME/tsumugi-data/cache"
cat > .env <<EOF
DATA_DIR=$HOME/tsumugi-data
ACCESS_TOKEN=$(openssl rand -hex 32)
LOCAL_NO_AUTH=1
DEMO_REPLAY_ID=exp_2c03558d5c6d47cc9072
TSUMUGI_KILL=1
EOF
R=https://github.com/Shibata-1273352/BuiltwithClaudeJapan2026/releases/download/demo-assets-v1
npm run setup:samples                                                     # CC0 のサンプル写真
curl -fsSL "$R/tsumugi-demo-corpus.tar.gz" | tar xz -C "$HOME/tsumugi-data"       # 資料のデータベース
npm run demo:seed                                                         # 録画を読み込む
curl -fsSL "$R/tsumugi-demo-cache.tar.gz" | tar xz -C "$HOME/tsumugi-data/cache"  # 切り抜き、奥行き、広重の版画
npm run build
npm run start -w web -- -H 127.0.0.1                                      # このマシンからだけ開ける
```

http://localhost:3000/replay/exp_2c03558d5c6d47cc9072 を開くと、Claude が写真を読み、資料を探し、確かめるまでが元の速さで再生されます。再生が終わったら、写真の下のボタンから次の動線をたどれます。

- **時をめくる → 時を流す：** 年が流れ、門が焼け、再建されます。焼けた日が資料で食い違う1866年では、両方の根拠を示します
- **言の地層 → 名をたどる：** 広重の版画の上で、資料ごとの呼び名を手前から奥へたどります
- **絵の中へ：** 1856年の広重の版画が、奥行きを持って開きます

写真の提灯に触れたり、右の年表を1878年まで動かしたりもできます。「糸を引く」の質問欄は、この環境では答えを返しません（`TSUMUGI_KILL=1` で Claude を呼ばない設定のため）。

審査用に、同じ構成の公開版（https://tsumugi-demo.onrender.com）も用意しています。アクセス用の鍵は、提出フォームでお伝えしています。

### すべての機能を使う

必要なもの：Apple Silicon の macOS（メモリ 16GB 以上）、Node.js 22 以上、[uv](https://docs.astral.sh/uv/)、Docker Desktop、gitleaks、Anthropic API キー、Hugging Face アカウント（SAM 3 の利用申請）。

```bash
cp .env.example .env     # 値の入れ方は docs/setup.md を参照
npm ci
npx lefthook install
npm run graph:up && npm run graph:init
# 推論サーバー、資料とサンプルの準備は docs/setup.md の 3〜4
npm run setup:web-assets
npm run build
npm run start -w web -- -p 3000
```

`http://localhost:3000/?token=<ACCESS_TOKEN>` を一度開くと使えます。「雷門で試す」は Claude を呼びます（費用の目安も docs/setup.md にあります）。各手順の詳細と確認コマンドは [docs/setup.md](docs/setup.md) にあります。

## ドキュメント

| 文書 | 内容 |
| --- | --- |
| [docs/architecture.md](docs/architecture.md) | 全体構成、処理の流れ、データ、ディレクトリ |
| [docs/models.md](docs/models.md) | 利用モデル、段階ごとの使い分け、API 機能 |
| [docs/setup.md](docs/setup.md) | 環境構築、環境変数、確認コマンド |
| [docs/licenses.md](docs/licenses.md) | 本体、依存、モデル、資料、動画素材のライセンス |
| [docs/evaluation.md](docs/evaluation.md) | 評価、性能、セキュリティの結果 |
| [docs/claude-code.md](docs/claude-code.md) | Claude Code の活用（英語） |
| [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) | 要件定義 |
| [docs/verification/](docs/verification/) | 検証の記録、年表の人の確認 |
| [video/ASSETS.md](video/ASSETS.md) | デモ動画の素材の出所 |
| [README.en.md](README.en.md) | 英語版。機能の詳細もここにあります |

## 今後の展開（Future Work）

- **確かめた知識が育つ：** 確かめた主張と根拠は、根拠グラフに保存されています。同じ場所を次の人が撮ったときに、保存した根拠から先に答え、Claude は足りない部分だけを読むようにします。育つのは、照合を通った主張と、人が確認した年表だけです
- **場所の選び直し：** Claude の候補から利用者が場所を選べるようにする（FR-07）
- **時間で絞る検索：** 時代の範囲を指定して資料を探す（FR-55）
- **実機での磨き込み：** スマートフォンでの触感、音、フレームレートを計測する
- **多言語化：** 日英に続き、フランス語へ広げる（FR-41）
- **名所の拡大：** 吾妻橋の年表の人の確認と、橋の世代ごとの管理を進め、名所を増やす
- **評価の強化：** 正解データを人が確認し、より難しい事例を加える
- **寄って読むの検証：** 銘板の前半は写真の中でぼやけており、読み取りと知識による補完の切り分けが次の課題です。高解像度の写真で検証する

## 状態

Built with Claude Japan 2026 の提出版です。審査の対象となるコードは、タグ `submission-v3` の時点のものです。開発の過程は [Issues](https://github.com/Shibata-1273352/BuiltwithClaudeJapan2026/issues?q=is%3Aissue) に残しています。

## 作者と謝辞

作者：柴田 高志（通信事業者の AI エンジニア）

資料と画像は、国立国会図書館、青空文庫、Project Gutenberg、浅草寺、寛永寺、観光庁、The Metropolitan Museum of Art、Wikimedia Commons の公開資料を使わせていただきました。動画の音源は VSCO 2 Community Edition です。出所と条件は [docs/licenses.md](docs/licenses.md) と [video/ASSETS.md](video/ASSETS.md) にあります。

## ライセンス

本体は [MIT License](LICENSE) です。第三者のソフトウェア、モデル、資料、素材はそれぞれの条件に従います。詳細は [docs/licenses.md](docs/licenses.md) を参照してください。
