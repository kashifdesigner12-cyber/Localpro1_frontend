// utils/sound.js

/**
 * Modern notification chime using browser's built-in Web Audio API.
 * Does not depend on external MP3 files, preventing 404 or network errors.
 */
export const playNotificationSound = () => {
  try {
    if (typeof window === "undefined") return;

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    const ctx = new AudioContext();

    const playTone = (freq, time, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, time);

      // Smooth volume fade out to avoid clicks
      gain.gain.setValueAtTime(0.2, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(time);
      osc.stop(time + duration);
    };

    const now = ctx.currentTime;
    // Harmonized double-chime (E6 -> A6)
    playTone(1318.51, now, 0.14);
    playTone(1760.00, now + 0.08, 0.32);
  } catch (error) {
    console.warn("Notification audio playback error:", error);
  }
};

/**
 * Alternative player if you later add an actual MP3 file to public/sounds/notification.mp3
 */
export const playMp3Sound = (soundPath = "/sounds/notification.mp3") => {
  try {
    if (typeof window === "undefined") return;
    const audio = new Audio(soundPath);
    audio.play().catch((err) => {
      console.warn("Audio autoplay prevented by browser policy:", err);
    });
  } catch (error) {
    console.warn("MP3 playback error:", error);
  }
};

export default playNotificationSound;