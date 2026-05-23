/**
 * User Preferences Service
 * Manages user-specific UI preferences with database sync
 * Fixes the issue where localStorage preferences were shared across users
 */

import { createSupabaseClient } from "@/lib/database";

export interface UserPreferences {
  show_popular: boolean;
  show_favourites: boolean;
  additional_settings?: Record<string, any>;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  show_popular: true,
  show_favourites: false,
  additional_settings: {},
};

const CACHE_KEY = "pos_user_preferences";
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export class UserPreferencesService {
  private supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  private cache: { preferences: UserPreferences; timestamp: number } | null = null;

  /**
   * Get preferences for a user
   */
  async get(userId: string, orgId: string): Promise<UserPreferences> {
    // Check cache first
    if (this.cache && Date.now() - this.cache.timestamp < CACHE_DURATION) {
      return this.cache.preferences;
    }

    try {
      const { data, error } = await this.supabase.rpc("get_user_preferences", {
        p_user_id: userId,
        p_org_id: orgId,
      } as any);

      if (error) throw error;

      const preferences = { ...DEFAULT_PREFERENCES, ...(data as any) };
      
      // Update cache
      this.cache = { preferences, timestamp: Date.now() };
      
      // Also store in localStorage as backup
      localStorage.setItem(CACHE_KEY, JSON.stringify(preferences));

      return preferences;
    } catch (err) {
      console.error("[UserPreferences] Error fetching preferences:", err);
      
      // Fallback to localStorage
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        try {
          return { ...DEFAULT_PREFERENCES, ...JSON.parse(cached) };
        } catch {
          return DEFAULT_PREFERENCES;
        }
      }
      
      return DEFAULT_PREFERENCES;
    }
  }

  /**
   * Update preferences for a user
   */
  async update(
    userId: string,
    orgId: string,
    preferences: Partial<UserPreferences>
  ): Promise<UserPreferences> {
    try {
      const { data, error } = await this.supabase.rpc("update_user_preferences", {
        p_user_id: userId,
        p_org_id: orgId,
        p_show_popular: preferences.show_popular,
        p_show_favourites: preferences.show_favourites,
        p_additional_settings: preferences.additional_settings,
      } as any);

      if (error) throw error;

      const updated = { ...DEFAULT_PREFERENCES, ...(data as any) };
      
      // Update cache
      this.cache = { preferences: updated, timestamp: Date.now() };
      
      // Update localStorage
      localStorage.setItem(CACHE_KEY, JSON.stringify(updated));

      console.log("[UserPreferences] Preferences updated:", updated);
      return updated;
    } catch (err) {
      console.error("[UserPreferences] Error updating preferences:", err);
      throw err;
    }
  }

  /**
   * Update a single preference
   */
  async updatePreference<K extends keyof UserPreferences>(
    userId: string,
    orgId: string,
    key: K,
    value: UserPreferences[K]
  ): Promise<void> {
    await this.update(userId, orgId, { [key]: value } as Partial<UserPreferences>);
  }

  /**
   * Clear cache (force refresh on next get)
   */
  clearCache(): void {
    this.cache = null;
  }

  /**
   * Subscribe to preferences changes (for multi-device sync)
   */
  subscribe(
    userId: string,
    callback: (preferences: UserPreferences) => void
  ): () => void {
    const channel = this.supabase
      .channel(`user_preferences:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_preferences",
          filter: `user_id=eq.${userId}`,
        },
        (payload: any) => {
          console.log("[UserPreferences] Preferences changed:", payload);
          const preferences = { ...DEFAULT_PREFERENCES, ...payload.new };
          
          // Update cache
          this.cache = { preferences, timestamp: Date.now() };
          
          // Update localStorage
          localStorage.setItem(CACHE_KEY, JSON.stringify(preferences));
          
          callback(preferences);
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }

  /**
   * Migrate localStorage preferences to database
   */
  async migrateFromLocalStorage(userId: string, orgId: string): Promise<void> {
    try {
      const migrations: Partial<UserPreferences> = {};

      // Migrate showPopular
      const showPopular = localStorage.getItem("showPopular");
      if (showPopular !== null) {
        migrations.show_popular = showPopular === 'true';
      }

      // Migrate showFavourites
      const showFavourites = localStorage.getItem("showFavourites");
      if (showFavourites !== null) {
        migrations.show_favourites = showFavourites === 'true';
      }

      // Only update if we have migrations
      if (Object.keys(migrations).length > 0) {
        console.log("[UserPreferences] Migrating localStorage preferences:", migrations);
        await this.update(userId, orgId, migrations);
        
        // Clean up old localStorage keys
        localStorage.removeItem("showPopular");
        localStorage.removeItem("showFavourites");
      }
    } catch (err) {
      console.error("[UserPreferences] Migration failed:", err);
    }
  }
}

// Export singleton instance
export const userPreferences = new UserPreferencesService();
