/**
 * Haptic feedback utilities for mobile devices
 * Provides tactile feedback for user interactions
 */

import { DEFAULT_SETTINGS } from "../services/register-settings";

export type HapticStyle = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

// Global settings check function
let isHapticEnabled = () => true;

/**
 * Set the haptic enabled check function
 * Called from components that have access to settings
 */
export function setHapticEnabledCheck(checkFn: () => boolean): void {
  isHapticEnabled = checkFn;
}

/**
 * Trigger haptic feedback on supported devices
 * Falls back gracefully on unsupported devices
 * Respects user settings
 */
export function triggerHaptic(style: HapticStyle = 'light'): void {
  // Check if haptics are enabled in settings
  if (!isHapticEnabled()) {
    return;
  }

  // Check if the device supports haptic feedback
  if (!navigator.vibrate) {
    return;
  }

  // Map haptic styles to vibration patterns (in milliseconds)
  const patterns: Record<HapticStyle, number | number[]> = {
    light: 10,
    medium: 20,
    heavy: 30,
    success: [10, 50, 10],
    warning: [20, 100, 20],
    error: [30, 100, 30, 100, 30],
  };

  const pattern = patterns[style];
  
  try {
    navigator.vibrate(pattern);
  } catch (error) {
    // Silently fail if vibration is not supported
    console.debug('Haptic feedback not supported:', error);
  }
}

/**
 * Check if haptic feedback is available on this device
 */
export function isHapticSupported(): boolean {
  return 'vibrate' in navigator;
}

/**
 * Haptic feedback for button press
 */
export function hapticButtonPress(): void {
  triggerHaptic('light');
}

/**
 * Haptic feedback for item added to cart
 */
export function hapticItemAdded(): void {
  triggerHaptic('medium');
}

/**
 * Haptic feedback for successful action
 */
export function hapticSuccess(): void {
  triggerHaptic('success');
}

/**
 * Haptic feedback for error or warning
 */
export function hapticError(): void {
  triggerHaptic('error');
}

/**
 * Haptic feedback for deletion
 */
export function hapticDelete(): void {
  triggerHaptic('heavy');
}
