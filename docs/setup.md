# 環境構築

## 必要なもの

| 項目 | 内容 |
| --- | --- |
| マシン | Apple Silicon の macOS、メモリ 16GB 以上 |
| ランタイム | Node.js 22 以上、[uv](https://docs.astral.sh/uv/)（Python 3.12 は uv が用意） |
| ツール | Docker Desktop、gitleaks |
| アカウント | Anthropic API キー、Hugging Face（`facebook/sam3` の利用申請） |

## 手順

### キーなしで見る

Node.js 22 以上だけで、保存した実行の録画を操作できます。API キー、GPU、Neo4j、推論サーバーは要らず、Claude も呼びません。GPU で計算した切り抜きと奥行き、Claude の出力を保存したものを再生する、CPU だけの再現環境です。資料のデータベースと画像は Release [`demo-assets-v1`](https://github.com/Shibata-1273352/BuiltwithClaudeJapan2026/releases/tag/demo-assets-v1) から取得します。

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

http://localhost:3000/replay/exp_2c03558d5c6d47cc9072 を開くと、読み取りから物語までが元の速さで再生されます。再生後は、物に触れる操作、時をめくる、言の地層、「絵の中へ」を試せます。「糸を引く」の質問欄は、`TSUMUGI_KILL=1` のため答えを返しません。

| 項目 | 内容 |
| --- | --- |
| `TSUMUGI_KILL=1` | 新しい探索と質問を止め、Claude を呼ばない |
| `-H 127.0.0.1` | `LOCAL_NO_AUTH=1` は鍵なしで開けるため、このマシンからの接続だけを受ける |
| 資料のデータベース | 録画に使う16資料の本文と索引。`npm run corpus:ingest` で作ったもので、自分で作る場合はこのコマンドを使う（PDF の2資料は uv が必要） |

審査用の公開版（https://tsumugi-demo.onrender.com）は、同じ手順を Render の無料枠で動かしたものです。アクセス用の鍵が必要です。

### 1. 環境変数

```bash
cp .env.example .env
mkdir -p "$HOME/tsumugi-data"
openssl rand -hex 32   # 乱数の作り方（ACCESS_TOKEN などに使う）
```

| 変数 | 必須 | 内容 |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | 必須 | Claude API キー |
| `ACCESS_TOKEN` | 必須 | 乱数。初回に `/?token=<値>` で開くと Cookie になる |
| `NEO4J_PASSWORD` | 必須 | 乱数 |
| `INFERENCE_TOKEN` | 必須 | 乱数 |
| `DATA_DIR` | 必須 | リポジトリ外のデータ置き場（絶対パス） |
| `PRESENTER_TOKEN` | 任意 | 発表モード用 |
| `HF_TOKEN` | 任意 | モデルの取得には `uv run hf auth login` を使う |
| `DAILY_COST_LIMIT_USD` | 任意 | 1日の費用上限（費用の安全装置） |
| `CLAUDE_FAST` | 任意 | `1` で fast mode（料金は約2倍、ライブデモ専用） |
| `LOCAL_NO_AUTH` | 任意 | `1` で同じマシンのブラウザだけトークンを省略（開発用） |
| `DEMO_REPLAY_ID` | 任意 | 公開する録画の探索 ID |

### 2. Node.js と Neo4j

```bash
npm ci
npx lefthook install      # コミット前の秘密情報スキャン
npm run graph:up
npm run graph:init
```

### 3. 推論サーバー

先に Hugging Face の `facebook/sam3` で利用条件に同意してください。

```bash
cd services/inference
uv sync
uv run hf auth login
uv run python scripts/download_models.py
cd ../..
npm run inference         # http://127.0.0.1:8100（別のターミナルで実行し、起動したままにする）
```

### 4. 資料とサンプル

```bash
set -a; . ./.env; set +a          # $DATA_DIR をシェルに読み込む
npm run corpus:ingest            # 資料の取得、抜粋の照合、データベースの作成
npm run corpus:headers -- --all  # 章ごとの文脈（任意。Claude を使う。現在の資料で約 $7）
npm run setup:samples            # パブリックドメイン、CC0 のサンプル写真
(cd services/inference && uv run python scripts/build_scene.py artifact met-56689 "$DATA_DIR/samples/met_56689.jpg")
(cd services/inference && uv run python scripts/build_scene.py photo "$DATA_DIR/samples/kaminarimon_cc0.jpg" --artifact met-56689)
```

似た図像の検索も使う場合（Wikimedia Commons のレート制限により、30分以上かかることがあります）：

```bash
npx tsx --env-file=.env scripts/visual/collect.ts
(cd services/inference && uv run python scripts/visual_lanterns.py)
(cd services/inference && uv run python scripts/visual_index.py build)
```

絵はがきには Shippori Mincho が必要です。`ShipporiMincho-Regular.ttf` と `-Bold.ttf`（OFL、Google Fonts）を `DATA_DIR/fonts` に置いてください。

### 5. 起動

```bash
npm run setup:web-assets   # 端末内の顔検出モデル
npm run build
npm run start -w web -- -p 3000
```

`http://localhost:3000/?token=<ACCESS_TOKEN>` を一度開きます。

| 画面 | パス |
| --- | --- |
| トップ | `/` |
| 雷門で試す | `/live`（開くと Claude を呼ぶ探索が始まる。平均 約 $0.3） |
| 上野・根本中堂で試す | `/live?sample=kaneiji_konponchudo_cc0.jpg`（同上） |
| しくみ | `/how` |
| 旅ノート | `/notes` |
| 録画の再生 | `/replay/<探索 ID>`（探索を実行したセッションか、`DEMO_REPLAY_ID` の ID） |

スマートフォンのカメラには HTTPS が必要です。`npm run tunnel` で公開できます。

## 確認コマンド

```bash
npm test
npm run typecheck
npm run lint
npm run build
(cd services/inference && uv run pytest)
npm run test:security     # Claude を呼ぶテストを含む。SEC_SKIP_LLM=1 で省略
npm run secrets:scan
npm run eval -- --no-llm  # Claude を呼ばない評価
```

## 費用の目安

実際に Claude を呼ぶ探索は、1回平均 $0.323 です（[実測の記録](../evaluation/results/2026-11-04.md)）。`CLAUDE_FAST=1` ではおよそ2倍になります。録画の再生は Claude を呼びません。

## トラブルシューティング

| 症状 | 確認すること |
| --- | --- |
| 画面に「空間解析：簡易表示」と出る | 推論サーバーが動いているか（`npm run inference`）。GPU を使う別の処理と重なるとタイムアウトする |
| 401 になる | `/?token=<ACCESS_TOKEN>` を開いたか |
| どの画面も 503 になる | `ACCESS_TOKEN` が 16 文字以上か（`LOCAL_NO_AUTH=1` でも必要） |
| 根拠グラフに保存されない | Docker と Neo4j が動いているか（`npm run graph:up`） |
| 探索が始まらない | `DAILY_COST_LIMIT_USD` と、停止スイッチ（`npm run kill -- status`） |
