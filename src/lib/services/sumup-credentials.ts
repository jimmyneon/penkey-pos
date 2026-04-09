/**
 * SumUp Credentials Service
 * Securely stores SumUp API credentials with encryption
 * Uses localStorage with obfuscation (not true encryption, but better than plaintext)
 */

import { RegisterSettingsService } from "./register-settings";

export interface SumUpCredentials {
  apiKey: string;
  merchantCode: string;
  affiliateKey?: string;
  appId?: string;
  environment?: "production" | "sandbox";
}

const STORAGE_KEY = "pos_sumup_credentials_v2";

// Simple obfuscation - rotates characters by key
function obfuscate(text: string): string {
  if (!text) return "";
  return btoa(text.split("").reverse().join(""));
}

function deobfuscate(text: string): string {
  if (!text) return "";
  try {
    return atob(text).split("").reverse().join("");
  } catch {
    return "";
  }
}

/**
 * Store SumUp credentials securely
 */
export function storeSumUpCredentials(credentials: SumUpCredentials): void {
  try {
    const obfuscated = {
      apiKey: obfuscate(credentials.apiKey),
      merchantCode: obfuscate(credentials.merchantCode),
      affiliateKey: obfuscate(credentials.affiliateKey || ""),
      appId: obfuscate(credentials.appId || "com.penkey.pos"),
      environment: credentials.environment || "production",
      timestamp: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obfuscated));
    console.log("[SumUpCredentials] Stored credentials for merchant:", credentials.merchantCode);
  } catch (err) {
    console.error("[SumUpCredentials] Failed to store credentials:", err);
    throw new Error("Failed to save SumUp credentials");
  }
}

/**
 * Get stored SumUp credentials
 */
export function getSumUpCredentials(): SumUpCredentials | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored);
    
    return {
      apiKey: deobfuscate(parsed.apiKey),
      merchantCode: deobfuscate(parsed.merchantCode),
      affiliateKey: deobfuscate(parsed.affiliateKey),
      appId: deobfuscate(parsed.appId) || "com.penkey.pos",
      environment: parsed.environment || "production",
    };
  } catch (err) {
    console.error("[SumUpCredentials] Failed to retrieve credentials:", err);
    return null;
  }
}

/**
 * Check if credentials are stored and valid
 */
export function hasSumUpCredentials(): boolean {
  const creds = getSumUpCredentials();
  return !!(creds?.apiKey && creds?.merchantCode);
}

/**
 * Clear stored credentials
 */
export function clearSumUpCredentials(): void {
  localStorage.removeItem(STORAGE_KEY);
  console.log("[SumUpCredentials] Credentials cleared");
}

/**
 * Validate stored credentials with SumUp API
 */
export async function validateStoredCredentials(): Promise<{
  valid: boolean;
  merchantCode?: string;
  error?: string;
}> {
  const creds = getSumUpCredentials();
  
  if (!creds?.apiKey || !creds?.merchantCode) {
    return { valid: false, error: "No credentials stored" };
  }

  try {
    const { OfflineSumUpClient } = await import("@penkey/sumup");
    const client = new OfflineSumUpClient({
      clientId: "",
      clientSecret: "",
      redirectUri: "",
      environment: creds.environment || "production",
      apiKey: creds.apiKey,
      merchantCode: creds.merchantCode,
      affiliateKey: creds.affiliateKey,
      appId: creds.appId,
    });

    const isValid = await client.validateCredentials();
    
    if (isValid) {
      return { valid: true, merchantCode: creds.merchantCode };
    } else {
      return { valid: false, error: "Invalid API credentials" };
    }
  } catch (err) {
    console.error("[SumUpCredentials] Validation error:", err);
    return { valid: false, error: (err as Error).message };
  }
}

/**
 * Get client configuration for SumUp SDK
 */
export async function getSumUpClientConfig(): Promise<{
  apiKey: string;
  merchantCode: string;
  affiliateKey: string;
  appId: string;
  environment: "production" | "sandbox";
} | null> {
  const creds = getSumUpCredentials();
  if (!creds?.apiKey || !creds?.merchantCode) return null;

  return {
    apiKey: creds.apiKey,
    merchantCode: creds.merchantCode,
    affiliateKey: creds.affiliateKey || "",
    appId: creds.appId || "com.penkey.pos",
    environment: creds.environment || "production",
  };
}
