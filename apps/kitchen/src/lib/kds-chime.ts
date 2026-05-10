/** Short two-tone chime when new ticket hits the KDS (respect browser autoplay rules). */
export async function playKdsChime(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    type WindowWithWebkit = Window & { webkitAudioContext?: typeof AudioContext };
    const AC =
      window.AudioContext ??
      (window as WindowWithWebkit).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    if (ctx.state === 'suspended') await ctx.resume();

    const playTone = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.value = 0.055;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + dur);
    };

    playTone(880, ctx.currentTime, 0.11);
    playTone(1174.66, ctx.currentTime + 0.08, 0.14);

    window.setTimeout(() => void ctx.close(), 400);
  } catch {
    /* Autoplay blocked or no Web Audio — ignore */
  }
}
