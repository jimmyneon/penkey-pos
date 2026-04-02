/**
 * Hook for accessing register settings
 * Provides reactive settings that update across devices
 */

import { useState, useEffect } from "react";
import { registerSettings, RegisterSettings, DEFAULT_SETTINGS } from "@/lib/services/register-settings";

export function useRegisterSettings(registerId: string | undefined) {
  const [settings, setSettings] = useState<RegisterSettings>(() => {
    try {
      const cached = localStorage.getItem("pos_register_settings");
      if (cached) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(cached) } as RegisterSettings;
      }
    } catch {}
    return DEFAULT_SETTINGS;
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!registerId) {
      setLoading(false);
      return;
    }

    let unsubscribe: (() => void) | undefined;

    const loadSettings = async () => {
      try {
        setLoading(true);
        const loadedSettings = await registerSettings.get(registerId);
        setSettings(loadedSettings);
        setError(null);

        // Subscribe to realtime changes
        unsubscribe = registerSettings.subscribe(registerId, (newSettings) => {
          console.log("[useRegisterSettings] Settings updated:", newSettings);
          setSettings(newSettings);
        });
      } catch (err) {
        console.error("[useRegisterSettings] Failed to load settings:", err);
        setError(err as Error);
        setSettings(DEFAULT_SETTINGS);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [registerId]);

  const updateSetting = async <K extends keyof RegisterSettings>(
    key: K,
    value: RegisterSettings[K]
  ) => {
    if (!registerId) return;

    try {
      await registerSettings.updateSetting(registerId, key, value);
    } catch (err) {
      console.error("[useRegisterSettings] Failed to update setting:", err);
      throw err;
    }
  };

  const updateSettings = async (updates: Partial<RegisterSettings>) => {
    if (!registerId) return;

    try {
      await registerSettings.update(registerId, updates);
    } catch (err) {
      console.error("[useRegisterSettings] Failed to update settings:", err);
      throw err;
    }
  };

  return {
    settings,
    loading,
    error,
    updateSetting,
    updateSettings,
  };
}
