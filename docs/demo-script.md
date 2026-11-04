# TSUMUGI デモ動画の構成（3分・審査は動画）

> 時と場所を読み、言葉の壁を越える。
> Read time and place. Cross the language barrier.

## 物語の背骨：95年の不在と、写真の中の名前

ひとことで言うと、95 年間再建されなかった門と、それを寄進した一人の人と、写真の提灯に刻まれたその名前の物語です。日本語と英語の記録が、一つの結び目になります。

場面ごとの事実は、すべて保存済みの資料の文か、Claude の読み（印付き）に裏付けがあります。

1. **壁**：作者は、外国人の友人の二つの問いに答えられなかった。作者は通信事業者で、人と人をつないできた。
2. **謎**：Claude が写真の提灯の金具から、ひとつの名前を読む。「松下幸之助」（Claude の読み）。
3. **喪失**：慶応元年（1865/66）に門は焼けた。浅草寺の記録には「この慶応の焼失より実に95年間も雷門は再建されなかった。」とある。その間、バード（1878 年）や荷風（1914 年）は、恒久的な門のない参道を歩いた（1868 年からは仮設の門が設けられた時期がある）。
   - バードの「赤い門」は奥の宝蔵門（仁王門）で、雷門ではない。
4. **Claude の判断**：Claude は資料が足りないと判断して探し直し、高村光雲『幕末維新懐古談』を見つけた。焼けた夜の回想で、浅草寺の説明とは日付と火元が食い違う。コードは両方を出す。
5. **寄進**：1960 年、門は寄進によって再建された。日本語の記録（浅草寺）と英語の記録（観光庁の多言語解説）が、この年に結ばれる。
   - 浅草寺：「現在の門は、昭和35年（1960）に…松下幸之助氏の寄進により、再建された。」
   - 観光庁："The current Kaminarimon was built in 1960 with donations from Matsushita Konosuke"
6. **つながり**：写真の提灯の名前は、門を返した人だった。あの日の質問に、いまは答えられる。

写真の名前と寄進者が同じ人だという断定は、コードではしない。画面では「写真から（Claude の読み）」と「記録の原文」を並べて見せるだけで、結びつけるのは見る人とナレーションに任せる。

## 審査基準から決めたこと

| 基準 | 見せること |
| --- | --- |
| インパクト 30% | 公式テーマ「多くの人を阻んできた壁を取り払う」（言葉の壁）。観光庁は英語解説を数千本整えてきた。理由は、観光地の魅力が「伝わらない」から。TSUMUGI は、写真から合う解説文を探し、確かめて引用する |
| デモ 25% | 冒頭 6 秒のつかみ。謎を一つ持たせて、最後に回収する。結び目と絵の中が「見て楽しい」場面 |
| Claude の活用 25% | 縦書きの筆文字と元号を読む。足りないものを自分で判断して探し直し、食い違う証言を見つける。答えには引用が付く。Claude Code で作った（フックの映像） |
| 深さと実行力 20% | 存在の判定はコード。否定の文を見分けて主張を格下げした実例を見せる。食い違いは両方を出す。引用は原文のまま |

## 台本

日本語は 1 秒 6〜7 字、英語字幕は 1 秒 15 字を上限にする。数字は、引用の中か保存済みの値からだけ使う。

| 時間 | 場面 | 画面・操作 | ナレーション（日本語） | 英語字幕 |
| --- | --- | --- | --- | --- |
| 0:00–0:08 | 冒頭：謎 | 提灯の金具の大写し（舞台の写真を編集で拡大）。Claude の枠と「Claude」の印。音楽なしで 1.5 秒の無音 | （無音のあと）「この提灯には、ひとつの名前があります。この人は誰なのか。なぜこの門は、95年も再建されなかったのか。」 | "There is a name on this lantern. Who is he — and why was this gate not rebuilt for 95 years?" |
| 0:08–0:20 | 壁 | 入口（いま｜1856） | 「浅草で、外国人の友人に聞かれました。『これ、なんて書いてあるの？ いつからあるの？』。人と人をつなぐ仕事をしてきたのに、答えられませんでした。」 | "In Asakusa, a friend asked me what this says, and how long it has been here. I connect people for a living — and I couldn't answer." |
| 0:20–0:40 | Claude が読む | `R?present=1&hold=broken&speed=0.5`。文字が写真から浮かぶ → 風雷神門 → 年月の銘 → 金具の名前 | 「Claude が縦書きの筆文字を読みます。風雷神門、風神と雷神の門。提灯の年月の銘、そして金具の名前まで。」 | "Claude reads the brush lettering — the Gate of the Wind and Thunder Gods — then the date on the lantern, and the name on its base." |
| 0:40–1:15 | 焼けて、食い違う | 完了（いま｜1856）→ Claude の判断の一行（見つけた：幕末維新懐古談）→ 時をめくるで 1866 年（両論） | 「1856年、広重が描いた門。そして門は燃えました。Claude は資料が足りないと判断して探し直し、焼けた夜を回想した彫刻家の本を見つけました。日付は、寺の記録と食い違います。だから、両方を出します。」 | "1856: Hiroshige draws the gate. Then it burns. Claude judged the record thin, searched again, and found a sculptor's memoir of that night. It disagrees with the temple on the date — so both are shown." |
| 1:15–1:30 | 確かめる | 舞台裏の確かめの実例（否定の言葉に下線） | 「Claude が読み、コードが確かめます。この文は否定だと見分け、主張として採りませんでした。」 | "Claude reads; code checks. This sentence is a negation, so it was not taken as a claim." |
| 1:30–1:50 | 不在 | 資料カードの「1878」を押す（`hold=broken`、ここで初めて発見が出る）→ 写真が夜に沈み、Bird の糸のうち時（金）の糸だけが切れる。場・言の糸は残る | 「1878年、イザベラ・バードは、恒久的な門のない参道を歩きました。判定したのは、年表を照らしたコードです。」 | "1878: Isabella Bird walks an avenue with no permanent gate. Code decided that, from the timeline." |
| 1:50–1:55 | 絵の中へ（つなぎ） | `/space/<scene>?enter=1&3d=1` を 5 秒 | （雪の音だけ） | — |
| 1:55–2:35 | 寄進 | 時をめくる →「時を流す」（1961 年で止まる）→ 日英の結び目 → 写真から：松下幸之助（Claude の読み・英語の意味） | 「95年のあいだ、雷門は再建されませんでした。1960年、一人の寄進で、門は戻りました。日本語の記録と、英語の記録が、ここで結ばれます。この写真の提灯に刻まれた名前は、門を返した人でした。」 | "For 95 years the gate was not rebuilt. In 1960, one man's gift brought it back — the Japanese and English records tie here. The name on this lantern is the man who gave the gate back." |
| 2:35–2:45 | 広がり | `/how`（2 秒）→ 入口の「いま使える場所」 | 「政府は観光地の英語解説を数千本整えてきました。TSUMUGI は、写真から合う一本を探し、確かめて引用します。」 | "Japan has written thousands of these English commentaries. TSUMUGI finds the right one from a photo and quotes it, checked." |
| 2:45–3:00 | 締め | 「絵はがきを作る」→ 画面に絵はがきが出る（1960 年の記録の一文が入る）| 「この場所を書き残した人たちと、いまの友人を、一本ずつ確かめた糸で紡ぐ。あの日の質問に、いまは答えられます。誰が門を返したのかも。TSUMUGI。」 | "The people who wrote about this place, and my friend today, woven with threads checked one by one. Now I can answer — and say who gave the gate back. TSUMUGI." |

- **必ず入れる場面**：0:00–1:50、1:55–2:35、締め
- **時間が足りなければ削る場面**：絵の中へ、広がり
- **Claude Code のフックの映像**（3 秒）：入れるなら「広がり」と差し替える。物語の流れを優先する。

**数字の出どころ**（ナレーションだけで使い、画面には手で打たない）
- 95 年：浅草寺の記録の原文「実に95年間」
- 1960：年表と資料の原文
- 英語解説の数（ナレーションでは「数千本」）：観光庁 多言語解説整備支援事業（約 9,000 本と公表） https://www.mlit.go.jp/tagengo-db/about.html
- 訪日客 42,683,600 人（2025 年）：JNTO 2026-01-21 https://www.jnto.go.jp/news/press/20260121_monthly.html

## 提出用の要約（100〜200語）

**日本語**

外国人の友人に浅草で「これ、なんて書いてあるの？ いつからあるの？」と聞かれ、答えられなかった。TSUMUGI は、その壁を取り払う。写真を撮ると、Claude が縦書きの筆文字を読み、意味を解説する。コードは、日英の一次資料と人が確認した年表で、その場所が「その年にあったか」を確かめる。Claude は資料が足りないと判断すれば探し直し、食い違う証言は両方を示す。資料にないことは「書かれていません」と答える。雷門は 95 年間再建されなかった。1960 年、一人の寄進で再建され、その名前は、写真の提灯に刻まれている。時と場所と人を、確かめた糸で紡ぐ。

**English**

In Asakusa, a friend asked me what a sign said and how long the gate had stood. I couldn't answer. TSUMUGI removes that wall. Take a photo: Claude reads the vertical brush lettering and explains it. Code checks, against Japanese and English primary sources and a human-reviewed timeline, whether the place existed in a given year. When the record is thin, Claude decides to search again. When sources disagree, both are shown. What the sources don't say, it says so. Kaminarimon was not rebuilt for 95 years. In 1960 one man's gift rebuilt it, and his name is on the lantern in the photo. TSUMUGI weaves time, place and people with threads checked one by one.

## 撮影の手順

**画面**
- 1920×1080 か 3840×2160 で撮る。舞台は `?present=1` にする（4K でも比例して拡大される）。
- プレゼンモードで隠れるもの：資料数・糸の数、資料の種類のタグ列、広重の絵と重ねる、言の地層。経過時間は出たまま。

**録画用の指定**（`/replay/<id>` に付ける）
- `?hold=broken`：1878 の発見を、年のつまみを動かして門がなかった年に入るまで出さない。
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

## 撮影当日のチェックリスト

1. `npm run build && npm start -w web` で起動する（`next dev` では撮らない）。推論サーバーと Neo4j が要るのは、予備のライブ撮影のときだけ。
2. `npx tsx --env-file=.env scripts/preflight.ts <base>` を実行し、すべて GO になっていることを確かめる。
3. Chrome を使う。`/?token=…` を一度開き、ヘッダーで UI の言語を選ぶ。
4. 画面：4K モニターを「1920×1080 相当」に設定し、Chrome を全画面にしてツールバーを隠す。集中モードを入れ、Dock を隠す。
5. 収録：音を入れるなら OBS（30 fps）で撮る。音なしで撮るなら、撮る前に「音：切」にする。
6. 一度ずつ開いて温める：`/`、`R`（= `/replay/<DEMO_REPLAY_ID>`）、`/space/<scene>?enter=1&3d=1`、`/how`。
7. `/present` の「撮影の場面」から各場面を開く（URL を打たない）。プレゼンモードはページを移っても保たれる。
   - 場面 2 の撮り始め：「場面 2–4：読む → 時をめくる（ゆっくり）」。画面の経過時間は録画の時間で表示される。
   - 場面 3 の撮り始め：「終わった舞台から」。
8. 撮り直しは、終わった舞台の「最初から再生」を押す。
9. 場面 3：資料カードの年「1878」を押す。門がなかった年に入った瞬間に 1878 の発見が出る（年のつまみと矢印キーでも動く）。
10. 場面 4：「時をめくる」→ 1866 年 →「時を流す」。1961 年で止まり、門が立つ。
11. 場面 5a：`/space/<scene>?enter=1&3d=1` を直接開く。プレゼンモードの舞台から入るときも `3d=1` が付く。カメラを動かしたいときまで、ポインタを動かさない。
12. 場面 5b：質問は最初に 1 回だけ撮る。1 時間に 10 問まで、1 問あたり約 $0.012。質問ごとの費用を記録する。
13. 場面 6a・6b：`/how` → Claude Code の画面収録（費用を記録）→ 絵はがき → `/`。
14. 操作の合間は、ポインタを画面の端に置いておく（ホバーで糸が光るため）。
15. 撮影の後、その日の Claude の費用を `ai_calls` から書き出す。

## 失敗したとき

- ライブが止まった：「記録を再生する（録画）」。30 秒応答がなければ、自動で録画を出す。
- 推論サーバーが落ちた：切り抜きなしでも、Claude の枠で触れられる。3D は 2D 表示になる（「3Dで見る」で戻せる）。
