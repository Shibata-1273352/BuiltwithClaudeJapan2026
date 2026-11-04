# 環境構築

## 必要なもの

| 項目 | 内容 |
| --- | --- |
| マシン | Apple Silicon の macOS、メモリ 16GB 以上 |
| ランタイム | Node.js 22 以上、[uv](https://docs.astral.sh/uv/)（Python 3.12 は uv が用意） |
| ツール | Docker Desktop、gitleaks |
| アカウント | Anthropic API キー、Hugging Face（`facebook/sam3` の利用申請） |

## 手順

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
npm run corpus:headers -- --all  # 章ごとの文脈（Claude を使う。現在の資料で約 $7）
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
| 雷門で試す | `/live`（開くと Claude を呼ぶ探索が始まる。約 $0.4） |
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

実際に Claude を呼ぶ探索は、1回およそ $0.2〜$0.4 です（標準速度の実測）。`CLAUDE_FAST=1` では高くなります。録画の再生は Claude を呼びません。

## トラブルシューティング

| 症状 | 確認すること |
| --- | --- |
| 画面に「空間解析：簡易表示」と出る | 推論サーバーが動いているか（`npm run inference`）。GPU を使う別の処理と重なるとタイムアウトする |
| 401 になる | `/?token=<ACCESS_TOKEN>` を開いたか |
| 根拠グラフに保存されない | Docker と Neo4j が動いているか（`npm run graph:up`） |
| 探索が始まらない | `DAILY_COST_LIMIT_USD` と、停止スイッチ（`npm run kill -- status`） |
