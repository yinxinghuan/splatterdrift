class SplatterAudio {
  constructor() {
    this.context = null;
    this.lastShotAt = 0;
  }

  unlock() {
    if (new URLSearchParams(location.search).get("mute") === "1") return null;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    if (!this.context) this.context = new AudioContext();
    if (this.context.state === "suspended") this.context.resume().catch(() => {});
    return this.context;
  }

  tone(frequency, duration, gain, type = "sine", slide = 1, delay = 0) {
    if (!this.context) return;
    const start = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const volume = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(28, frequency * slide), start + duration);
    volume.gain.setValueAtTime(0.0001, start);
    volume.gain.exponentialRampToValueAtTime(gain, start + 0.006);
    volume.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(volume).connect(this.context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  shot() {
    const now = performance.now();
    if (!this.context || now - this.lastShotAt < 76) return;
    this.lastShotAt = now;
    this.tone(150, 0.065, 0.018, "square", 0.43);
  }

  hit(tier) {
    if (tier === 2) {
      this.tone(210, 0.09, 0.034, "triangle", 1.57);
      this.tone(82, 0.07, 0.018, "sine", 0.78);
    } else {
      this.tone(360, 0.12, 0.038, "triangle", 1.72);
    }
  }

  brake() {
    this.tone(520, 0.11, 0.03, "sine", 0.6);
  }

  core(level) {
    const frequency = [0, 0, 620, 740, 880][level] || 620;
    this.tone(frequency, 0.07, 0.018, "sine", 1.08, 0.035);
  }

  wave() {
    [330, 440, 660].forEach((frequency, index) => {
      this.tone(frequency, 0.16, 0.026, "triangle", 1.04, index * 0.045);
    });
  }

  collision(ended) {
    this.tone(96, 0.16, 0.04, "sawtooth", 0.44);
    if (ended) this.tone(52, 0.28, 0.035, "sine", 0.72, 0.08);
  }

  finish(kind) {
    if (kind === "won") {
      [392, 523, 659, 784].forEach((frequency, index) => {
        this.tone(frequency, 0.32, 0.034, "triangle", 1.04, index * 0.055);
      });
    } else if (kind === "time") {
      this.tone(294, 0.16, 0.03, "triangle", 0.84);
      this.tone(247, 0.2, 0.028, "triangle", 0.78, 0.1);
    }
  }
}

export const splatterAudio = new SplatterAudio();
