/** Words and colors the live stage shares (6.1–6.3). */

/** Who is working in each DAG stage — Claude, local models, or code — and on what. */
export const STAGE_WORK: Record<string, { who: "claude" | "local" | "code" | "graph"; ja: string }> = {
  see: { who: "claude", ja: "写真の文字と要素を読む" },
  place: { who: "code", ja: "場所を一つに決める" },
  plan: { who: "code", ja: "探す観点を立てる" },
  retrieve: { who: "code", ja: "日英の資料を検索" },
  "extract:en": { who: "claude", ja: "英語の資料から主張を抜き出す" },
  "extract:ja": { who: "claude", ja: "日本語の資料から主張を抜き出す" },
  gap: { who: "claude", ja: "足りない観点を判断" },
  extract2: { who: "claude", ja: "追加の資料を読む" },
  existence: { who: "code", ja: "書かれた年に、それはあったか" },
  names: { who: "code", ja: "呼び名の移り変わり" },
  threads: { who: "code", ja: "糸を結ぶ" },
  narrate: { who: "claude", ja: "根拠つきの物語を書く" },
  space: { who: "local", ja: "SAM 3 と深度で写真を層に分ける" },
  graph: { who: "graph", ja: "根拠グラフ（Neo4j）に保存" },
};

export const WHO_LABEL = { claude: "Claude", local: "ローカルGPU", code: "コード", graph: "Neo4j" } as const;

export const LAYER_COLOR: Record<string, string> = {
  toki: "var(--thread-toki)",
  ba: "var(--thread-ba)",
  koto: "var(--thread-koto)",
  ma: "var(--thread-ma)",
};

export const LAYER_JA: Record<string, string> = { toki: "時", ba: "場", koto: "言", ma: "間" };

/** 6.3 line styles: ink = solid, knot = combined evidence, absent = broken, pending = dashed, pencil = faint. */
export const STATE_JA: Record<string, string> = {
  ink: "確かな糸",
  combined: "結び目（複数の根拠）",
  absent: "切れた糸",
  pending: "保留の糸",
  fork: "分かれた糸",
  pencil: "鉛筆の糸",
};

export const EXIST_JA: Record<string, string> = {
  present: "その年、それはあった",
  absent: "その年、それはなかった",
  unknown: "判定保留",
};

/** The year axis (6.2): 1750–2030 covers the corpus (Hiroshige 1856 … official pages today). */
export const YEAR_MIN = 1750;
export const YEAR_MAX = 2030;
export const yearFrac = (y: number) => Math.min(1, Math.max(0, (y - YEAR_MIN) / (YEAR_MAX - YEAR_MIN)));
export const yearOf = (iso: string | null | undefined) => (iso ? Number(iso.slice(0, 4)) || null : null);
