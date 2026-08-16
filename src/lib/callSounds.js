/**
 * Call UX tones via Web Audio API.
 * Note: Apple's Opening (and other iOS ringtones) are copyrighted — we cannot
 * ship them. This uses a short smartphone-style chime + classic ringback/busy.
 */

let sharedCtx = null;

const getCtx = () => {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!sharedCtx || sharedCtx.state === "closed") {
    sharedCtx = new AC();
  }
  return sharedCtx;
};

const resumeCtx = async (ctx) => {
  if (ctx?.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      /* autoplay policies */
    }
  }
};

/** @type {{ stop: () => void } | null} */
let activeLoop = null;

export const stopCallSounds = () => {
  if (activeLoop) {
    try {
      activeLoop.stop();
    } catch {
      /* ignore */
    }
    activeLoop = null;
  }
};

const tone = (ctx, freq, start, dur, gainValue, type = "sine") => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
};

/**
 * Soft repeating chime for incoming calls (portfolio-safe substitute for
 * Apple's Opening ringtone).
 */
export const startIncomingRingtone = async () => {
  stopCallSounds();
  const ctx = getCtx();
  if (!ctx) return;
  await resumeCtx(ctx);

  let cancelled = false;
  let timer = null;

  const playCycle = () => {
    if (cancelled) return;
    const t0 = ctx.currentTime + 0.02;
    // Bright major arpeggio — smartphone-like, not Apple's Opening melody
    const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 659.25];
    notes.forEach((freq, i) => {
      tone(ctx, freq, t0 + i * 0.12, 0.28, 0.09, "triangle");
    });
    timer = setTimeout(playCycle, 2200);
  };

  playCycle();
  activeLoop = {
    stop: () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    },
  };
};

/** Classic North-American ringback while waiting for answer. */
export const startOutgoingRingback = async () => {
  stopCallSounds();
  const ctx = getCtx();
  if (!ctx) return;
  await resumeCtx(ctx);

  let cancelled = false;
  let timer = null;

  const playCycle = () => {
    if (cancelled) return;
    const t0 = ctx.currentTime + 0.02;
    // Dual-tone ringback ~2s on
    for (let i = 0; i < 2; i += 1) {
      const start = t0 + i * 0.02;
      tone(ctx, 440, start, 1.9, 0.045);
      tone(ctx, 480, start, 1.9, 0.045);
    }
    timer = setTimeout(playCycle, 6000);
  };

  playCycle();
  activeLoop = {
    stop: () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    },
  };
};

/** Short busy signal (reorder tone). */
export const playBusyTone = async () => {
  stopCallSounds();
  const ctx = getCtx();
  if (!ctx) return;
  await resumeCtx(ctx);

  const t0 = ctx.currentTime + 0.02;
  for (let i = 0; i < 3; i += 1) {
    const start = t0 + i * 0.5;
    tone(ctx, 480, start, 0.4, 0.07);
    tone(ctx, 620, start, 0.4, 0.07);
  }
};
