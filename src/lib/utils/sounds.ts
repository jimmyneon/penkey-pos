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
  
  // Resume audio context if suspended (browser autoplay policy)
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  
  return audioContext;
}

/**
 * Generate a simple beep sound using Web Audio API
 */
function playBeep(frequency: number, duration: number, type: OscillatorType = 'sine'): void {
  if (!isSoundEnabled()) {
    console.log('[Sound] Sound disabled, skipping');
    return;
  }

  try {
    const ctx = initAudioContext();
    console.log('[Sound] Playing beep:', frequency, duration, type, 'context state:', ctx.state);
    
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = type;

    // Increase volume for better audibility
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  } catch (error) {
    console.error('[Sound] Error playing sound:', error);
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
 * Play a payment initiation sound (cash register style)
 */
export function playPaymentInitSound(): void {
  if (!isSoundEnabled()) return;
  playBeep(1200, 0.05, 'square');
  setTimeout(() => playBeep(1600, 0.05, 'square'), 50);
}

/**
 * Play a payment processing sound (ascending)
 */
export function playPaymentProcessingSound(): void {
  if (!isSoundEnabled()) return;
  playBeep(400, 0.1, 'sine');
  setTimeout(() => playBeep(500, 0.1, 'sine'), 100);
  setTimeout(() => playBeep(600, 0.1, 'sine'), 200);
}

/**
 * Play a payment success sound (celebratory chime)
 */
export function playPaymentSuccessSound(): void {
  if (!isSoundEnabled()) return;
  playBeep(523.25, 0.15, 'sine'); // C5
  setTimeout(() => playBeep(659.25, 0.15, 'sine'), 150); // E5
  setTimeout(() => playBeep(783.99, 0.15, 'sine'), 300); // G5
  setTimeout(() => playBeep(1046.50, 0.3, 'sine'), 450); // C6
}

/**
 * Play a payment failed sound (sad descending tones)
 */
export function playPaymentFailedSound(): void {
  if (!isSoundEnabled()) return;
  playBeep(400, 0.2, 'sawtooth');
  setTimeout(() => playBeep(300, 0.2, 'sawtooth'), 200);
  setTimeout(() => playBeep(200, 0.3, 'sawtooth'), 400);
}

/**
 * Play a cart open sound
 */
export function playCartOpenSound(): void {
  if (!isSoundEnabled()) return;
  playBeep(800, 0.08, 'sine');
}

/**
 * Play a cart close sound
 */
export function playCartCloseSound(): void {
  if (!isSoundEnabled()) return;
  playBeep(600, 0.1, 'sine');
}

/**
 * Play a navigation sound (menu click)
 */
export function playNavigationSound(): void {
  if (!isSoundEnabled()) return;
  playBeep(900, 0.06, 'sine');
}

/**
 * Check if sound is supported on this device
 */
export function isSoundSupported(): boolean {
  return 'AudioContext' in window || 'webkitAudioContext' in window;
}
