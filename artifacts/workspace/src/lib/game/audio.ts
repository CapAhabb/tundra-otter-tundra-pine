export class GameAudio {
  private ctx: AudioContext | null = null;
  private muted = false;
  private lastStep = 0;
  private speakOn = false;
  private utterance: SpeechSynthesisUtterance | null = null;

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
  }

  speak(text: string) {
    if (!this.speakOn || this.muted || !text) return;
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    this.stopSpeak();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95;
    u.pitch = 1.05;
    this.utterance = u;
    window.speechSynthesis.speak(u);
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
