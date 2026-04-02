/**
 * Upsell Preferences Service
 * Manages user preferences for upselling features
 */

export interface UpsellPreferences {
  enabled: boolean;
  autoDismissSeconds: number; // 0 = manual dismiss only
  showPopularCategory: boolean;
}

const DEFAULT_PREFERENCES: UpsellPreferences = {
  enabled: true,
  autoDismissSeconds: 3,
  showPopularCategory: true,
};

const STORAGE_KEY = "pos_upsell_preferences";

export class UpsellPreferencesService {
  /**
   * Get upsell preferences for current user
   */
  get(): UpsellPreferences {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        return DEFAULT_PREFERENCES;
      }

      const parsed = JSON.parse(stored);
      return { ...DEFAULT_PREFERENCES, ...parsed };
    } catch (err) {
      console.error("[UpsellPreferences] Error reading preferences:", err);
      return DEFAULT_PREFERENCES;
    }
  }

  /**
   * Update upsell preferences
   */
  set(preferences: Partial<UpsellPreferences>): void {
    try {
      const current = this.get();
      const updated = { ...current, ...preferences };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      console.log("[UpsellPreferences] Updated preferences:", updated);
    } catch (err) {
      console.error("[UpsellPreferences] Error saving preferences:", err);
    }
  }

  /**
   * Reset to default preferences
   */
  reset(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
      console.log("[UpsellPreferences] Reset to defaults");
    } catch (err) {
      console.error("[UpsellPreferences] Error resetting preferences:", err);
    }
  }

  /**
   * Check if upsells are enabled
   */
  isEnabled(): boolean {
    return this.get().enabled;
  }

  /**
   * Check if popular category should be shown
   */
  shouldShowPopular(): boolean {
    return this.get().showPopularCategory;
  }

  /**
   * Get auto-dismiss timing
   */
  getAutoDismissSeconds(): number {
    return this.get().autoDismissSeconds;
  }
}

// Export singleton instance
export const upsellPreferences = new UpsellPreferencesService();
