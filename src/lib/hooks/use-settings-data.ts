"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { RegisterSettings, DEFAULT_SETTINGS } from "@/lib/services/register-settings";
import { hapticButtonPress } from "@/lib/utils/haptics";

export interface SessionData {
  employee: { id: string; name: string; email?: string; role?: string };
  register: { id: string; name: string; store_name?: string };
  org_id: string;
  user_id?: string;
}

export function useSettingsData(showToast?: (message: string, type?: "success" | "error" | "info") => void) {
  const router = useRouter();
  const [settings, setSettings] = useState<RegisterSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [registerId, setRegisterId] = useState<string | null>(null);
  const [session, setSession] = useState<SessionData | null>(null);

  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const registerIdRef = useRef(registerId);
  registerIdRef.current = registerId;

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const sessionData = sessionStorage.getItem("pos_session") || localStorage.getItem("pos_session");
      if (!sessionData) {
        router.push("/lock");
        return;
      }

      const parsed = JSON.parse(sessionData);
      setSession(parsed);
      const regId = parsed.register?.id;

      if (!regId) {
        router.push("/lock");
        return;
      }

      setRegisterId(regId);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const settingsRes = await fetch(`/api/register/settings?register_id=${regId}`, {
        headers: {
          ...(sessionData && { "x-pos-session": sessionData }),
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (settingsRes.ok) {
        const loadedSettings = await settingsRes.json();
        setSettings({ ...DEFAULT_SETTINGS, ...(loadedSettings || {}) });
      } else {
        setSettings(DEFAULT_SETTINGS);
      }
    } catch (error: any) {
      if (error.name === "AbortError") {
        setSettings(DEFAULT_SETTINGS);
      } else {
        setSettings(DEFAULT_SETTINGS);
      }
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = useCallback(async <K extends keyof RegisterSettings>(
    key: K,
    value: RegisterSettings[K]
  ) => {
    hapticButtonPress();
    const newSettings = { ...settingsRef.current, [key]: value };
    setSettings(newSettings);

    const regId = registerIdRef.current;
    if (regId) {
      try {
        const sessionDataForApi = sessionStorage.getItem("pos_session") || localStorage.getItem("pos_session");
        const parsed = sessionDataForApi ? JSON.parse(sessionDataForApi) : null;
        const response = await fetch("/api/register/settings", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(sessionDataForApi && { "x-pos-session": sessionDataForApi }),
          },
          body: JSON.stringify({
            register_id: regId,
            org_id: parsed?.org_id,
            settings: newSettings,
          }),
        });

        if (!response.ok) {
          showToast?.("Failed to save setting", "error");
        } else {
          if (key === "theme") {
            window.location.reload();
          }
        }
      } catch (error) {
        console.error("Failed to save setting immediately:", error);
      }
    }
  }, [showToast]);

  return {
    settings,
    loading,
    registerId,
    session,
    updateSetting,
    setSettings,
    reloadSettings: loadSettings,
  };
}
