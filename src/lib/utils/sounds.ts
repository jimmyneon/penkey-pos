/**
 * Sound effects utilities for POS interactions
 * Provides audio feedback for user actions
 */

// Global settings check function
let isSoundEnabled = () => true;

/**
 * Set the sound enabled check function
 * Called from components that have access to settings
 */
export function setSoundEnabledCheck(checkFn: () => boolean): void {
  isSoundEnabled = checkFn;
}

/**
 * Audio context for generating sounds
 */
let audioContext: AudioContext | null = null;

/**
 * Initialize audio context (must be called after user interaction)
 */
function initAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
}

/**
 * Generate a simple beep sound using Web Audio API
 */
function playBeep(frequency: number, duration: number, type: OscillatorType = 'sine'): void {
  if (!isSoundEnabled()) {
    return;
  }

  try {
    const ctx = initAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = type;

    gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  } catch (error) {
    console.debug('Sound not supported:', error);
  }
}

/**
 * Play a success sound (ascending tones)
 */
export function playSuccessSound(): void {
  if (!isSoundEnabled()) return;
  playBeep(523.25, 0.1, 'sine'); // C5
  setTimeout(() => playBeep(659.25, 0.1, 'sine'), 100); // E5
  setTimeout(() => playBeep(783.99, 0.15, 'sine'), 200); // G5
}

/**
 * Play an error sound (descending tones)
 */
export function playErrorSound(): void {
  if (!isSoundEnabled()) return;
  playBeep(400, 0.15, 'square');
  setTimeout(() => playBeep(300, 0.2, 'square'), 150);
}

/**
 * Play a button press sound (short click)
 */
export function playButtonSound(): void {
  if (!isSoundEnabled()) return;
  playBeep(800, 0.05, 'sine');
}

/**
 * Play an item added sound (pleasant chime)
 */
export function playItemAddedSound(): void {
  if (!isSoundEnabled()) return;
  playBeep(880, 0.1, 'sine'); // A5
}

/**
 * Play a delete sound (lower tone)
 */
export function playDeleteSound(): void {
  if (!isSoundEnabled()) return;
  playBeep(200, 0.2, 'square');
}

/**
 * Play a warning sound
 */
export function playWarningSound(): void {
  if (!isSoundEnabled()) return;
  playBeep(440, 0.1, 'triangle');
  setTimeout(() => playBeep(440, 0.1, 'triangle'), 150);
}

/**
 * Check if sound is supported on this device
 */
export function isSoundSupported(): boolean {
  return 'AudioContext' in window || 'webkitAudioContext' in window;
}
