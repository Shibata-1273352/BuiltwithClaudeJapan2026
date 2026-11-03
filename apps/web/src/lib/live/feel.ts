/**
 * The feel of touching a thread (Loom): a soft plucked note (Karplus-Strong, a koto-like string),
 * and a short vibration where the device can. Quiet by default, muted with one switch, silent
 * until the visitor's first touch (autoplay rules), and off entirely under reduced motion.
 */
let ctx: AudioContext | null = null;
let muted = false;

export function setMuted(m: boolean) {
  muted = m;
  try {
    localStorage.setItem("tsumugi_mute", m ? "1" : "0");
  } catch {
    /* private mode */
  }
}
export function isMuted(): boolean {
  try {
    return muted || localStorage.getItem("tsumugi_mute") === "1";
  } catch {
    return muted;
  }
}

export function reducedMotion(): boolean {
  return typeof window !== "undefined" && (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || new URLSearchParams(location.search).get("motion") === "0");
}

/** The samples of one plucked string (pure: tested). Pitch from the thread's length: longer = lower. */
export function pluckSamples(freq: number, sampleRate: number, seconds = 1.2, seed = 1): Float32Array<ArrayBuffer> {
  const n = Math.floor(sampleRate * seconds);
  const period = Math.max(2, Math.round(sampleRate / freq));
  const out = new Float32Array(n);
  const buf = new Float32Array(period);
  let s = seed;
  for (let i = 0; i < period; i++) {
    s = (s * 16807) % 2147483647; // deterministic noise burst
    buf[i] = (s / 2147483647) * 2 - 1;
  }
  for (let i = 0; i < n; i++) {
    const j = i % period;
    const next = (j + 1) % period;
    const v = 0.5 * (buf[j] + buf[next]) * 0.996; // low-pass + decay: the string
    out[i] = buf[j];
    buf[j] = v;
  }
  return out;
}

export const pitchFor = (lengthPx: number) => Math.max(180, Math.min(620, 90000 / Math.max(60, lengthPx)));

/** Pluck: a note for a thread of this length, and a tick of vibration. */
export function pluck(lengthPx = 300, { volume = 0.12 }: { volume?: number } = {}) {
  if (reducedMotion()) return;
  haptic();
  if (isMuted() || typeof window === "undefined") return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    const data = pluckSamples(pitchFor(lengthPx), ctx.sampleRate);
    const b = ctx.createBuffer(1, data.length, ctx.sampleRate);
    b.copyToChannel(data, 0);
    const src = ctx.createBufferSource();
    src.buffer = b;
    const g = ctx.createGain();
    g.gain.value = volume;
    src.connect(g).connect(ctx.destination);
    src.start();
  } catch {
    /* no audio: the visual tremble is enough */
  }
}

/**
 * A short vibration: navigator.vibrate where it exists (Android); on iOS 18+ Safari, toggling a
 * hidden <input type="checkbox" switch> gives the system haptic. Otherwise nothing (visual only).
 */
export function haptic() {
  if (reducedMotion() || typeof navigator === "undefined") return;
  if ("vibrate" in navigator) {
    try {
      navigator.vibrate(8);
      return;
    } catch {
      /* not allowed */
    }
  }
  try {
    let el = document.getElementById("tsumugi-haptic") as HTMLInputElement | null;
    if (!el) {
      const label = document.createElement("label");
      label.style.cssText = "position:fixed;left:-9999px;width:1px;height:1px;overflow:hidden";
      label.setAttribute("aria-hidden", "true");
      el = document.createElement("input");
      el.type = "checkbox";
      el.setAttribute("switch", "");
      el.id = "tsumugi-haptic";
      el.tabIndex = -1;
      label.appendChild(el);
      document.body.appendChild(label);
    }
    (el.parentElement as HTMLLabelElement).click();
  } catch {
    /* visual only */
  }
}
