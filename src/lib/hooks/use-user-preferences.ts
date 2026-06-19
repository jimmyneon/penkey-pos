/**
 * Hook for accessing user preferences
 * Provides reactive preferences that update across devices
 */

import { useState, useEffect } from "react";
import { userPreferences, UserPreferences, DEFAULT_PREFERENCES } from "@/lib/services/user-preferences";

export function useUserPreferences(userId: string | undefined, orgId: string | undefined) {
  const [preferences, setPreferences] = useState<UserPreferences>(() => {
    try {
      const cached = localStorage.getItem("pos_user_preferences");
      if (cached) {
        return { ...DEFAULT_PREFERENCES, ...JSON.parse(cached) } as UserPreferences;
      }
    } catch {}
    return DEFAULT_PREFERENCES;
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userId || !orgId) {
      setLoading(false);
      return;
    }

    let unsubscribe: (() => void) | undefined;

    const loadPreferences = async () => {
      try {
        setLoading(true);
        const loadedPreferences = await userPreferences.get(userId, orgId);
        setPreferences(loadedPreferences);
        setError(null);

        // Subscribe to realtime changes
        unsubscribe = userPreferences.subscribe(userId, (newPreferences) => {
          setPreferences(newPreferences);
        });
      } catch (err) {
        console.error("[useUserPreferences] Failed to load preferences:", err);
        setError(err as Error);
        setPreferences(DEFAULT_PREFERENCES);
      } finally {
        setLoading(false);
      }
    };

    loadPreferences();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [userId, orgId]);

  const updatePreference = async <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => {
    if (!userId || !orgId) return;

    // Optimistic update: update local state immediately for instant UI feedback
    setPreferences(prev => ({ ...prev, [key]: value }));

    try {
      const updated = await userPreferences.updatePreference(userId, orgId, key, value);
      // Confirm with actual returned value from DB
      setPreferences(prev => ({ ...prev, [key]: updated[key] ?? value }));
    } catch (err) {
      console.error("[useUserPreferences] Failed to update preference:", err);
      // Revert on error
      setPreferences(prev => ({ ...prev, [key]: !value }));
      throw err;
    }
  };

  const updatePreferences = async (updates: Partial<UserPreferences>) => {
    if (!userId || !orgId) return;

    // Optimistic update
    setPreferences(prev => ({ ...prev, ...updates }));

    try {
      const updated = await userPreferences.update(userId, orgId, updates);
      setPreferences(prev => ({ ...prev, ...updated }));
    } catch (err) {
      console.error("[useUserPreferences] Failed to update preferences:", err);
      // Revert on error by reloading from service
      const reverted = await userPreferences.get(userId, orgId);
      setPreferences(reverted);
      throw err;
    }
  };

  return {
    preferences,
    loading,
    error,
    updatePreference,
    updatePreferences,
  };
}
