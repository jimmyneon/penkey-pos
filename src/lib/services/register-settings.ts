/**
 * Register Settings Service
 * Manages POS register-specific settings with database sync
 */

import { createSupabaseClient } from "@penkey/database";

export interface RegisterSettings {
  // Display preferences
  layout_preference: "grid" | "list";
  theme: "dark" | "light";
  font_size: "small" | "medium" | "large";
  grid_size: 2 | 3 | 4 | 5 | 6; // Number of columns in grid view

  // Penkey Prompts settings
  penkey_prompts_enabled: boolean;
  penkey_auto_dismiss_seconds: number; // 0 = manual dismiss only
  penkey_show_popular: boolean;

  // Operational preferences
  auto_print_receipt: boolean;
  receipt_copies: number;
  default_dining_option: "eat-in" | "takeaway";
  require_customer_name: boolean;

  // Sound and feedback
  sound_enabled: boolean;
  haptic_enabled: boolean;

  // Shift management
  shift_management_enabled: boolean;
  require_opening_cash: boolean;
  auto_close_shift: boolean;
  auto_close_time: string; // HH:mm format

  // Additional settings (extensible)
  additional_settings?: Record<string, any>;
}

export const DEFAULT_SETTINGS: RegisterSettings = {
  layout_preference: "grid",
  theme: "dark",
  font_size: "medium",
  grid_size: 3,
  penkey_prompts_enabled: true,
  penkey_auto_dismiss_seconds: 3,
  penkey_show_popular: true,
  auto_print_receipt: true,
  receipt_copies: 1,
  default_dining_option: "eat-in",
  require_customer_name: false,
  sound_enabled: true,
  haptic_enabled: true,
  shift_management_enabled: true,
  require_opening_cash: true,
  auto_close_shift: false,
  auto_close_time: "23:00",
  additional_settings: {},
};

const CACHE_KEY = "pos_register_settings";
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export class RegisterSettingsService {
  private supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  private cache: { settings: RegisterSettings; timestamp: number } | null = null;

  /**
   * Get settings for a register
   */
  async get(registerId: string): Promise<RegisterSettings> {
    // Check cache first
    if (this.cache && Date.now() - this.cache.timestamp < CACHE_DURATION) {
      return this.cache.settings;
    }

    try {
      const { data, error } = await this.supabase.rpc("get_register_settings", {
        p_register_id: registerId,
      });

      if (error) throw error;

      const settings = { ...DEFAULT_SETTINGS, ...data };
      
      // Update cache
      this.cache = { settings, timestamp: Date.now() };
      
      // Also store in localStorage as backup
      localStorage.setItem(CACHE_KEY, JSON.stringify(settings));

      return settings;
    } catch (err) {
      console.error("[RegisterSettings] Error fetching settings:", err);
      
      // Fallback to localStorage
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        try {
          return { ...DEFAULT_SETTINGS, ...JSON.parse(cached) };
        } catch {
          return DEFAULT_SETTINGS;
        }
      }
      
      return DEFAULT_SETTINGS;
    }
  }

  /**
   * Update settings for a register
   */
  async update(
    registerId: string,
    settings: Partial<RegisterSettings>
  ): Promise<RegisterSettings> {
    try {
      const { data, error } = await this.supabase.rpc("update_register_settings", {
        p_register_id: registerId,
        p_settings: settings,
      });

      if (error) throw error;

      const updated = { ...DEFAULT_SETTINGS, ...data };
      
      // Update cache
      this.cache = { settings: updated, timestamp: Date.now() };
      
      // Update localStorage
      localStorage.setItem(CACHE_KEY, JSON.stringify(updated));

      console.log("[RegisterSettings] Settings updated:", updated);
      return updated;
    } catch (err) {
      console.error("[RegisterSettings] Error updating settings:", err);
      throw err;
    }
  }

  /**
   * Update a single setting
   */
  async updateSetting<K extends keyof RegisterSettings>(
    registerId: string,
    key: K,
    value: RegisterSettings[K]
  ): Promise<void> {
    await this.update(registerId, { [key]: value } as Partial<RegisterSettings>);
  }

  /**
   * Clear cache (force refresh on next get)
   */
  clearCache(): void {
    this.cache = null;
  }

  /**
   * Subscribe to settings changes (for multi-device sync)
   */
  subscribe(
    registerId: string,
    callback: (settings: RegisterSettings) => void
  ): () => void {
    const channel = this.supabase
      .channel(`register_settings:${registerId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "register_settings",
          filter: `register_id=eq.${registerId}`,
        },
        (payload: any) => {
          console.log("[RegisterSettings] Settings changed:", payload);
          const settings = { ...DEFAULT_SETTINGS, ...payload.new };
          
          // Update cache
          this.cache = { settings, timestamp: Date.now() };
          
          // Update localStorage
          localStorage.setItem(CACHE_KEY, JSON.stringify(settings));
          
          callback(settings);
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }

  /**
   * Migrate localStorage settings to database
   */
  async migrateFromLocalStorage(registerId: string): Promise<void> {
    try {
      const migrations: Partial<RegisterSettings> = {};

      // Migrate layout preference
      const layout = localStorage.getItem("pos_layout");
      if (layout === "grid" || layout === "list") {
        migrations.layout_preference = layout;
      }

      // Migrate upsell preferences
      const upsellPrefs = localStorage.getItem("pos_upsell_preferences");
      if (upsellPrefs) {
        try {
          const parsed = JSON.parse(upsellPrefs);
          migrations.penkey_prompts_enabled = parsed.enabled ?? true;
          migrations.penkey_auto_dismiss_seconds = parsed.autoDismissSeconds ?? 3;
          migrations.penkey_show_popular = parsed.showPopularCategory ?? true;
        } catch {
          // Ignore parse errors
        }
      }

      // Only update if we have migrations
      if (Object.keys(migrations).length > 0) {
        console.log("[RegisterSettings] Migrating localStorage settings:", migrations);
        await this.update(registerId, migrations);
        
        // Clean up old localStorage keys
        localStorage.removeItem("pos_layout");
        localStorage.removeItem("pos_upsell_preferences");
      }
    } catch (err) {
      console.error("[RegisterSettings] Migration failed:", err);
    }
  }
}

// Export singleton instance
export const registerSettings = new RegisterSettingsService();
