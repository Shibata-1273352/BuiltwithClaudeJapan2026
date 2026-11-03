/**
 * FR-45 案内役「らぶちゃん」: short, non-assertive lines chosen by code from the exploration's state.
 * The guide never adds facts: every line only points at what the screen already shows (or says
 * what is not known), and none is written by Claude.
 */
export type GuideState = {
  phase: "idle" | "sending" | "exploring" | "done" | "failed" | "no_place";
  absent?: number; // existence rows judged absent
  withheld?: number; // sources_disagree / boundary
  conflicts?: number;
  pending?: number; // pencil / pending threads
  visual?: boolean; // lantern-to-lantern hits shown
  degraded?: boolean; // space analysis in simple display
};

export function guideLine(s: GuideState, lang: "ja" | "en" = "ja"): string {
  const ja = lang === "ja";
  switch (s.phase) {
    case "idle":
      return ja ? "写真を一枚、見せてもらえますか。どこかで見た景色かもしれません。" : "Could you show me a photo? It might be a place someone wrote about.";
    case "sending":
      return ja ? "顔はぼかしてから送りますね。見落としがあれば、タップで足せます。" : "Faces are blurred before sending. Tap to add more if I missed one.";
    case "exploring":
      return ja ? "古い本と記録をめくっています。少し待ってくださいね。" : "Turning the pages of old books and records. Just a moment.";
    case "failed":
      return ja ? "うまく紡げませんでした。もう一度試してみましょうか。" : "I couldn't weave this one. Shall we try again?";
    case "no_place":
      return ja ? "この場所は、まだ手元の資料にないようです。分からないことは、分からないままにしておきますね。" : "This place isn't in my sources yet. I'd rather say so than guess.";
    case "done": {
      if (s.conflicts) return ja ? "資料どうしで食い違うところがあります。どちらが正しいかは、決めずに並べておきますね。" : "Some sources disagree. I've left both side by side instead of choosing.";
      if (s.withheld) return ja ? "日付がはっきりしないところは「判定保留」にしています。断言はしないでおきますね。" : "Where the dates are unclear, I've marked it as withheld rather than guess.";
      if (s.absent) return ja ? "途切れた糸は、その時代にはまだなかったしるし。年表と照らしただけの推定ですけれど。" : "A broken thread means it wasn't there yet — an inference from the chronology, not a quote.";
      if (s.visual) return ja ? "似た絵も見つかりました。似ているだけで、根拠ではありませんよ。" : "I found prints that look alike — similar, not evidence.";
      if (s.pending) return ja ? "鉛筆の線は、まだ確かめきれていないところです。あなたの目でも見てみてください。" : "Pencil lines aren't fully checked yet. Have a look yourself.";
      if (s.degraded) return ja ? "今日は立体にはできなかったので、平らなまま見てくださいね。" : "I couldn't build the 3D view today, so it stays flat.";
      return ja ? "一文ずつ、根拠に戻れます。気になる文を押してみてください。" : "Every sentence leads back to its evidence. Tap one you're curious about.";
    }
  }
}
