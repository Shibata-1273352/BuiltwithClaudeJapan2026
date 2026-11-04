# TSUMUGI デモ動画の構成（3分・審査は動画）

> 時と場所を読み、言葉の壁を越える。
> Read time and place. Cross the language barrier.

## 物語の背骨

- **Why me**：作者は通信事業者で、人と人をつなぐ仕事をしてきた。それなのに浅草で、外国人の友人と目の前の門をつなげなかった。
- **友人の二つの問い**：「これ、なんて書いてあるの？」「いつからあるの？」。二つ目の答えが「1878年、恒久的な雷門はなかった」という驚きになる。
- **締め**：この場所を書き残した人たち（イザベラ・バード、広重、荷風、高村光雲）と、いまの友人を、一本ずつ確かめた糸で紡ぐ。
  - アプリは、1878年と1914年には恒久的な門がなかったと判定している。だから「この門の前に立った人たち」とは言わない。

## 審査基準から決めたこと

| 基準 | 見せること | 場面 |
| --- | --- | --- |
| インパクト 30% | 作者の体験。困っているのは、日本が好きな外国人と、案内する日本人。カメラアプリが答えられない二つ目の問い「いつからあるの？」に、確かめた歴史で答える | 1, 3, 6 |
| デモ 25% | 場面は6つだけ。1878年と絵の中には、それぞれ20秒以上を使う。全編に英語字幕を付ける | 全体 |
| Claude の活用 25% | 次の3つを、それぞれ5秒ずつ見せる（「Claude」と「コード」のチップで分ける）。①縦書きの筆文字を読む ②足りない観点を判断して、追加で探す ③今回の資料だけから引用して答え、資料にないことは「書かれていません」と言う | 2, 5 |
| 深さと実行力 20% | 年代の判定はコードが年表で行う（Claude には判定させない）。食い違う資料は両方を出す。引用はコードが原文から切り出す | 3, 4, 6 |

## 台本（6場面）

- 秒数の目安は、デモ録画（`DEMO_REPLAY_ID`）の実測による。
- 録画では、写真の最初の文字が 2.3 秒、読み終わりが 4.4 秒、Claude の判断が 7.4 秒、糸が 9.6 秒、完了が 16.3 秒。
- 日本語は 1 秒 6〜7 字、英語字幕は 1 秒 15 字を上限にする。

| 時間 | 場面 | 画面・操作 | ナレーション（日本語） | 英語字幕 |
| --- | --- | --- | --- | --- |
| 0:00–0:15 | 1. 問い | 入口の「はじまり」→ 経歴の一文 | 「浅草で、外国人の友人に聞かれました。『これ、なんて書いてあるの？ いつからあるの？』。人と人をつなぐ仕事をしてきたのに、答えられませんでした。」 | "In Asakusa, a friend asked me: what does this say? How long has it been here? I connect people for a living — and I couldn't answer." |
| 0:15–0:45 | 2. 最初の答え（Claude ①②） | `/replay/<id>?present=1&hold=broken&speed=0.5`。文字が写真から浮かぶ → 最初の答え → Claude の判断の一行（速さ 0.5 で約 8 秒見える） | 「Claude が、縦書きの筆文字を読みます。風雷神門——風神と雷神の門。いまの門は1960年のもの。足りないと Claude が判断すると、資料を探し直します。では、明治の頃は？」 | "Claude reads the vertical brush lettering: Fūraijinmon, the Gate of the Wind and Thunder Gods. Today's gate dates from 1960. Claude sees what is missing and searches again. And in the Meiji era?" |
| 0:45–1:10 | 3. 1878年（コードの判定） | 年のつまみを 1878 へ。ここで初めて 1878 の発見が出る（`hold=broken`）。写真が夜に沈み、糸が切れる | 「1878年、イザベラ・バードがこの場所を書きました。そのとき、恒久的な雷門はまだありませんでした。判定したのは Claude ではなく、年表との照合です。」 | "In 1878, Isabella Bird wrote about this place. The permanent gate was not yet rebuilt. Code decided this from the timeline — not Claude." |
| 1:10–1:30 | 4. 食い違う資料 | 時をめくる → 1866 年 →「時を流す」（1961 年で止まり、門が立つ） | 「1866年、門は燃えました。日付と火元は、資料によって違います。違うときは、両方を出します。」 | "In 1866 the gate burned. The sources disagree on the day and the origin of the fire — so both are shown." |
| 1:30–2:05 | 5. 絵の中へ と 問う（Claude ③） | 「絵の中へ」で広重の1856年に入る（カメラが門へ歩き、雪が降る）→ 戻って一つ質問（引いた原文が答えの下に出る）→ 資料にない質問で「書かれていません」 | 「広重の1856年。版画が奥行きを持ちます。質問には、今回の資料だけで答えます。資料にないことは、書かれていないと答えます。」 | "Hiroshige, 1856 — the print opens into depth. Questions are answered from these sources only. What they don't say, it says so." |
| 2:05–2:40 | 6a. 確かめられる、ということ | `/how`（Claude とコードの分担、計測値、評価）→ 3 秒だけ Claude Code（デザイン規則のフックが違反を止め、同じターンで直す画面） | 「Claude は、読み、探し、書く。はい／いいえは、コードが決めます。引用は、コードが原文から切り出します。資料のない場所でも、読みとガイドは使えます。」 | "Claude reads, searches and writes. Code decides every yes or no. Quotes are cut from the original by code. Where there are no sources, the reading and the guide still work." |
| 2:40–3:00 | 6b. 締め | 絵はがき（2 秒）→ 入口へ | 「この場所を書き残した人たちと、いまの友人を、一本ずつ確かめた糸で紡ぐ。あの日の質問に、いまは答えられます。TSUMUGI。」 | "The people who wrote about this place, and my friend today — woven with threads checked one by one. Now I can answer. TSUMUGI." |

入れないもの：言の地層（前提知識が要る）、海を越える糸。

## 撮影の手順

**画面**
- 1920×1080 か 3840×2160 で撮る。舞台は `?present=1` にする（4K でも比例して拡大される）。
- プレゼンモードで隠れるもの：資料数・糸の数、資料の種類のタグ列、広重の絵と重ねる、言の地層。経過時間は出たまま。

**録画用の指定**（`/replay/<id>` に付ける）
- `?hold=broken`：1878 の発見を、年のつまみを動かすまで出さない。
- `?speed=0.5`：録画の再生の速さ。0.5〜4 倍を指定できる。
- `?at=end`：最後の状態から始める。戻ったときにも自動で付く。

**事前準備**
- 推論サーバーを起動し、入口を一度開いて温める（モデルは 30 分保持される）。
- 参考訳を作っておく：`npx tsx --env-file=.env scripts/warm-translations.ts <base> <DEMO_REPLAY_ID>`。プレゼンモードは参考訳を新しく作らない。

**質問（場面 5）**
- ライブで聞く（1 問あたり約 $0.01、1 時間に 10 問まで）。
- 答えられる質問（例：「提灯は誰が奉納した？」）と、資料にない質問（例：「提灯の重さは？」）を先に試し、「書かれていません」になる質問を選んでおく。

**Claude Code の画面（場面 6a）**
- 別の worktree でデザイン規則に反する編集（`text-sm` を足す）をさせる。
- フックが止め（exit 2）、同じターンで直す様子を画面収録する。
- 1 回のセッションの費用を記録する。

**予行と音**
- 予行：`scripts/acceptance.ts <base> <replay> <scene>`、戻る操作の確認は `scripts/back-check.ts`、4K の確認は `scripts/shots-4k.ts`、絵の中の GPU での確認は `scripts/space-probe.ts`。
- 音：糸を弾く音は最初のタッチから鳴る。ナレーションと重ねるなら「音：切」にする。

## 失敗したとき

- ライブが止まった：「記録を再生する（録画）」。30 秒応答がなければ、自動で録画を出す。
- 推論サーバーが落ちた：切り抜きなしでも、Claude の枠で触れられる。3D は 2D 表示になる（「3Dで見る」で戻せる）。
