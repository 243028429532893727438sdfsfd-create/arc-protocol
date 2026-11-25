// Pure Web Audio API procedural sci-fi sound synthesizer (zero external assets required)

class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;

  private ensure(): AudioContext | null {
    if (this.muted) return null;
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  setMuted(m: boolean): void {
    this.muted = m;
  }

  isMuted(): boolean {
    return this.muted;
  }

  private tone(
    freq: number,
    endFreq: number,
    duration: number,
    type: OscillatorType = 'sine',
    gainPeak = 0.14,
    delay = 0
  ): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  playClick(): void {
    this.tone(520, 680, 0.06, 'triangle', 0.08);
  }

  playCardSelect(): void {
    this.tone(360, 560, 0.07, 'sine', 0.09);
  }

  playMove(): void {
    this.tone(180, 340, 0.12, 'triangle', 0.11);
  }

  playShield(): void {
    this.tone(280, 520, 0.16, 'sine', 0.11);
    this.tone(420, 640, 0.18, 'triangle', 0.08, 0.04);
  }

  playArcZap(chainCount: number): void {
    const steps = Math.min(6, Math.max(1, chainCount + 1));
    const base = 320;
    for (let i = 0; i < steps; i++) {
      const f = base * Math.pow(1.18, i);
      this.tone(f, f * 1.45, 0.12, 'sawtooth', 0.09, i * 0.045);
      this.tone(f * 2, f * 0.9, 0.09, 'square', 0.04, i * 0.045);
    }
  }

  playSlam(): void {
    this.tone(150, 42, 0.22, 'sawtooth', 0.18);
    this.tone(95, 32, 0.24, 'square', 0.12, 0.02);
  }

  playExplosion(): void {
    this.tone(130, 30, 0.3, 'sawtooth', 0.18);
    this.tone(240, 55, 0.22, 'triangle', 0.11, 0.03);
  }

  playEnemyHit(): void {
    this.tone(210, 85, 0.18, 'sawtooth', 0.15);
  }

  playVictory(): void {
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((n, i) => {
      this.tone(n, n * 1.01, 0.26, 'triangle', 0.12, i * 0.09);
    });
  }

  playDefeat(): void {
    const notes = [320, 270, 210, 140];
    notes.forEach((n, i) => {
      this.tone(n, n * 0.92, 0.28, 'sawtooth', 0.1, i * 0.12);
    });
  }
}

export const sound = new SoundEngine();
