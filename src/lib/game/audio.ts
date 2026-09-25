export class GameAudio {
  private ctx: AudioContext | null = null;
  private muted = false;
  private lastStep = 0;
  private speakOn = false;
  private utterance: SpeechSynthesisUtterance | null = null;
  private voiceEl: HTMLAudioElement | null = null;
  private voiceCache = new Map<string, string>();
  private piperDown = false;
  private speakToken = 0;

  unlock() {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    void this.ctx.resume();
  }

  setMuted(v: boolean) {
    this.muted = v;
    if (v) this.stopSpeak();
  }

  setSpeakOn(v: boolean) {
    this.speakOn = v;
    if (!v) this.stopSpeak();
  }

  isSpeakOn() {
    return this.speakOn;
  }

  stopSpeak() {
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* ignore */
    }
    this.utterance = null;
    if (this.voiceEl) {
      this.voiceEl.pause();
      this.voiceEl.src = "";
      this.voiceEl = null;
    }
  }

  private speakBrowser(text: string) {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices?.() ?? [];
    const voice =
      voices.find((v) => /samantha|karen|moira|victoria|fiona|allison|ava|zira|siri|female/i.test(v.name)) ||
      voices.find((v) => v.lang.startsWith("en") && /female/i.test(v.name)) ||
      voices.find((v) => v.lang.startsWith("en-"));
    if (voice) u.voice = voice;
    u.rate = 1.02;
    u.pitch = 1.28;
    this.utterance = u;
    window.speechSynthesis.speak(u);
  }

  /**
   * Kara's voice: tries the local Piper neural TTS endpoint (dev-only, free,
   * see scripts/piper-tts-plugin.mjs) first, since it sounds far smoother
   * than the browser's espeak-backed SpeechSynthesis on Linux. Falls back to
   * SpeechSynthesis if the endpoint isn't available (production builds, or
   * Piper not installed) so the game never goes silent.
   */
  speak(text: string) {
    if (!this.speakOn || this.muted || !text) return;
    this.stopSpeak();
    if (this.piperDown) {
      this.speakBrowser(text);
      return;
    }
    const token = ++this.speakToken;
    void this.speakPiper(text, token);
  }

  private async speakPiper(text: string, token: number) {
    try {
      let url = this.voiceCache.get(text);
      if (!url) {
        const res = await fetch(`/api/tts-piper?text=${encodeURIComponent(text)}`);
        if (!res.ok) throw new Error(`tts-piper ${res.status}`);
        const blob = await res.blob();
        url = URL.createObjectURL(blob);
        this.voiceCache.set(text, url);
      }
      // A newer speak() call (or mute/stop) superseded this one while we
      // were fetching; don't step on it.
      if (token !== this.speakToken || !this.speakOn || this.muted) return;
      const el = new Audio(url);
      this.voiceEl = el;
      await el.play();
    } catch {
      this.piperDown = true;
      if (token === this.speakToken && this.speakOn && !this.muted) {
        this.speakBrowser(text);
      }
    }
  }

  private now() {
    return this.ctx?.currentTime ?? 0;
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain = 0.04, at = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.now() + at;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  footstep() {
    const t = performance.now();
    if (t - this.lastStep < 280) return;
    this.lastStep = t;
    this.tone(90 + Math.random() * 30, 0.07, "triangle", 0.03);
  }

  pickup() {
    this.tone(523, 0.1, "sine", 0.05);
    this.tone(784, 0.16, "sine", 0.04, 0.07);
  }

  outage() {
    this.tone(70, 0.5, "sawtooth", 0.05);
    this.tone(48, 0.7, "sine", 0.06, 0.05);
  }

  success() {
    this.tone(392, 0.12, "sine", 0.05);
    this.tone(523, 0.14, "sine", 0.05, 0.1);
    this.tone(659, 0.22, "sine", 0.045, 0.2);
  }

  kara() {
    this.tone(880, 0.08, "sine", 0.03);
  }

  click() {
    this.tone(240, 0.04, "square", 0.02);
  }
}

export const gameAudio = new GameAudio();
