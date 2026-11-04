/** Words and colors the live stage shares (6.1–6.3). */

/** Who is working in each DAG stage — Claude, local models, or code — and on what. */
export const STAGE_WORK: Record<string, { who: "claude" | "local" | "code" | "graph"; ja: string; en: string }> = {
  see: { who: "claude", ja: "写真の文字と要素を読む", en: "reads the words and things in the photo" },
  place: { who: "code", ja: "場所を一つに決める", en: "settles on one place" },
  plan: { who: "code", ja: "探す観点を立てる", en: "plans what to look for" },
  retrieve: { who: "code", ja: "日英の資料を検索", en: "searches Japanese and English sources" },
  "extract:en": { who: "claude", ja: "英語の資料から主張を抜き出す", en: "takes claims from the English sources" },
  "extract:ja": { who: "claude", ja: "日本語の資料から主張を抜き出す", en: "takes claims from the Japanese sources" },
  gap: { who: "claude", ja: "足りない観点を判断", en: "judges what is missing" },
  extract2: { who: "claude", ja: "追加の資料を読む", en: "reads the extra sources" },
  existence: { who: "code", ja: "書かれた年に、それはあったか", en: "was it there in the year it was written?" },
  names: { who: "code", ja: "呼び名の移り変わり", en: "how its name changed" },
  threads: { who: "code", ja: "糸を結ぶ", en: "ties the threads" },
  narrate: { who: "claude", ja: "根拠つきの物語を書く", en: "writes the story, each sentence sourced" },
  space: { who: "local", ja: "SAM 3 と深度で写真を層に分ける", en: "splits the photo into layers (SAM 3, depth)" },
  viewpoint: { who: "claude", ja: "立ち位置と向きを見立てる（鉛筆）", en: "guesses where you stand (pencil)" },
  closer: { who: "claude", ja: "小さな文字に寄って読み直す", en: "reads the small writing again, closer" },
  guide: { who: "claude", ja: "ガイドノートを書く", en: "writes the guide notes" },
  graph: { who: "graph", ja: "根拠グラフ（Neo4j）に保存", en: "saves the evidence graph (Neo4j)" },
};

export const WHO_LABEL = {
  ja: { claude: "Claude", local: "ローカルGPU", code: "コード", graph: "Neo4j" },
  en: { claude: "Claude", local: "Local GPU", code: "Code", graph: "Neo4j" },
} as const;

export const LAYER_COLOR: Record<string, string> = {
  toki: "var(--thread-toki)",
  ba: "var(--thread-ba)",
  koto: "var(--thread-koto)",
  ma: "var(--thread-ma)",
};

/** 6.3 line styles: ink = solid, knot = combined evidence, absent = broken, pending = dashed, pencil = faint. */
export const STATE_LABEL: Record<"ja" | "en", Record<string, string>> = {
  ja: { ink: "確かな糸", combined: "結び目（複数の根拠）", absent: "切れた糸", pending: "保留の糸", fork: "分かれた糸", pencil: "鉛筆の糸" },
  en: { ink: "firm thread", combined: "knot (several sources)", absent: "broken thread", pending: "held thread", fork: "forked thread", pencil: "pencil thread" },
};

export const EXIST_LABEL: Record<"ja" | "en", Record<string, string>> = {
  ja: { present: "その年、それはあった", absent: "その年、それはなかった", unknown: "判定保留" },
  en: { present: "that year, it was there", absent: "that year, it was not there", unknown: "held" },
};

export const FACET_LABEL: Record<"ja" | "en", Record<string, string>> = {
  ja: { place_description: "場所の記述", naming: "呼び名", existence_timeline: "存在の年表", historical_artifacts: "歴史的な作品" },
  en: { place_description: "The place", naming: "Its names", existence_timeline: "When it stood", historical_artifacts: "Old pictures" },
};

/** The year axis (6.2): 1750–2030 covers the corpus (Hiroshige 1856 … official pages today). */
export const YEAR_MIN = 1750;
export const YEAR_MAX = 2030;
export const yearFrac = (y: number) => Math.min(1, Math.max(0, (y - YEAR_MIN) / (YEAR_MAX - YEAR_MIN)));
export const yearOf = (iso: string | null | undefined) => (iso ? Number(iso.slice(0, 4)) || null : null);
