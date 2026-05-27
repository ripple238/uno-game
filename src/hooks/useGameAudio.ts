import { useCallback } from 'react';

// A simple Web Audio API synthesizer for retro/arcade style sounds
export const useGameAudio = () => {
  const playTone = useCallback((frequency: number, type: OscillatorType, duration: number, vol = 0.1) => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);
      
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      console.error('Audio play error:', e);
    }
  }, []);

  const playCardSound = useCallback(() => {
    // Quick pop sound for playing a normal card
    playTone(440, 'sine', 0.1, 0.1);
  }, [playTone]);

  const playSpecialCardSound = useCallback(() => {
    // More dramatic sound for special cards
    playTone(880, 'square', 0.15, 0.1);
    setTimeout(() => playTone(660, 'square', 0.2, 0.1), 100);
  }, [playTone]);

  const playDrawSound = useCallback(() => {
    // Sliding up sound
    playTone(200, 'triangle', 0.1, 0.05);
    setTimeout(() => playTone(300, 'triangle', 0.1, 0.05), 50);
  }, [playTone]);

  const playWinSound = useCallback(() => {
    // Triumphant arpeggio
    playTone(440, 'square', 0.1, 0.1);
    setTimeout(() => playTone(554, 'square', 0.1, 0.1), 100);
    setTimeout(() => playTone(659, 'square', 0.1, 0.1), 200);
    setTimeout(() => playTone(880, 'square', 0.3, 0.1), 300);
  }, [playTone]);

  return { playCardSound, playSpecialCardSound, playDrawSound, playWinSound };
};
