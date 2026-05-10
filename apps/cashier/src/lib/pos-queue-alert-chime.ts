/** Lightweight acknowledgement tones — Web Audio; fails silently if autoplay blocks. */
export type PosQueueAlertKind = 'ready' | 'attention' | 'ping';

export async function playPosQueueAlertChime(kind: PosQueueAlertKind): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    type Win = Window & { webkitAudioContext?: typeof AudioContext };
    const AC = window.AudioContext ?? (window as Win).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    if (ctx.state === 'suspended') await ctx.resume();

    const beep = (freq: number, t0: number, dur: number, gain = 0.05) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      g.gain.value = gain;
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur);
    };

    const t0 = ctx.currentTime;
    if (kind === 'ready') {
      beep(784, t0, 0.1, 0.055);
      beep(988, t0 + 0.09, 0.12, 0.05);
    } else if (kind === 'attention') {
      beep(440, t0, 0.14, 0.065);
      beep(330, t0 + 0.12, 0.18, 0.055);
    } else {
      beep(660, t0, 0.08, 0.045);
    }

    window.setTimeout(() => void ctx.close(), 400);
  } catch {
    /* ignore */
  }
}
