export type RealtimeAlertType = "new" | "update";

let audioContext: AudioContext | null = null;
let listenersAttached = false;

const getAudioContext = () => {
  if (typeof window === "undefined") return null;

  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;

  if (!audioContext) {
    audioContext = new AudioContextClass();
  }

  return audioContext;
};

export const primeRealtimeAudio = () => {
  if (typeof window === "undefined" || listenersAttached) return () => {};

  const unlockAudio = () => {
    const ctx = getAudioContext();
    if (ctx?.state === "suspended") {
      void ctx.resume();
    }
  };

  listenersAttached = true;
  window.addEventListener("pointerdown", unlockAudio, { passive: true });
  window.addEventListener("keydown", unlockAudio);
  window.addEventListener("touchstart", unlockAudio, { passive: true });

  return () => {
    listenersAttached = false;
    window.removeEventListener("pointerdown", unlockAudio);
    window.removeEventListener("keydown", unlockAudio);
    window.removeEventListener("touchstart", unlockAudio);
  };
};

export const playRealtimeAlert = (type: RealtimeAlertType = "new") => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === "suspended") {
      void ctx.resume();
    }

    const playTone = (frequency: number, startAt: number, duration: number, gainValue: number) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, startAt);
      gain.gain.setValueAtTime(gainValue, startAt);
      gain.gain.exponentialRampToValueAtTime(0.001, startAt + duration);
      oscillator.start(startAt);
      oscillator.stop(startAt + duration);
    };

    const now = ctx.currentTime;
    if (type === "new") {
      playTone(880, now, 0.18, 0.18);
      playTone(1120, now + 0.2, 0.22, 0.2);
      return;
    }

    playTone(560, now, 0.28, 0.16);
  } catch {
    // Ignore audio failures silently
  }
};
