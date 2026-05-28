/**
 * Biometrics Service — WebAuthn platform authenticator
 *
 * Uses the device's built-in authenticator (Face ID / fingerprint) as a
 * lock-screen gate.  The OS picks face first, then fingerprint, based on
 * what's enrolled — no special handling needed.
 *
 * Credentials are stored locally (localStorage) keyed by user_id.
 * No server involvement required — biometrics is a local convenience layer
 * on top of an already-valid Supabase session.
 */

const CRED_KEY = (uid: string) => `biometric_cred_${uid}`;
const ENABLED_KEY = (uid: string) => `biometric_enabled_${uid}`;

// ─── Availability ────────────────────────────────────────────────────────────

export async function checkPlatformAuthenticator(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!window.PublicKeyCredential || !navigator.credentials) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export function isBiometricEnabled(userId: string): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(ENABLED_KEY(userId)) === "true";
}

export function disableBiometric(userId: string): void {
  localStorage.removeItem(CRED_KEY(userId));
  localStorage.removeItem(ENABLED_KEY(userId));
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function challenge(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

function toBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function fromBase64(s: string): ArrayBuffer {
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

// ─── Registration ─────────────────────────────────────────────────────────────

export async function registerBiometric(
  userId: string,
  displayName: string
): Promise<boolean> {
  try {
    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge: challenge(),
        rp: { name: "Penkey POS", id: window.location.hostname },
        user: {
          id: new TextEncoder().encode(userId),
          name: displayName,
          displayName,
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },   // ES256
          { type: "public-key", alg: -257 },  // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          residentKey: "preferred",
        },
        timeout: 60_000,
      },
    })) as PublicKeyCredential | null;

    if (!credential) return false;

    localStorage.setItem(CRED_KEY(userId), toBase64(credential.rawId));
    localStorage.setItem(ENABLED_KEY(userId), "true");
    return true;
  } catch (err: any) {
    console.error("[Biometrics] Registration failed:", err);
    return false;
  }
}

// ─── Authentication ───────────────────────────────────────────────────────────

export async function authenticateBiometric(userId: string): Promise<boolean> {
  const raw = localStorage.getItem(CRED_KEY(userId));
  if (!raw) return false;

  try {
    const assertion = (await navigator.credentials.get({
      publicKey: {
        challenge: challenge(),
        allowCredentials: [
          {
            type: "public-key",
            id: fromBase64(raw),
            transports: ["internal"],
          },
        ],
        userVerification: "required",
        timeout: 60_000,
      },
    })) as PublicKeyCredential | null;

    return !!assertion;
  } catch (err: any) {
    // NotAllowedError = user cancelled or biometric mismatch — not a crash
    if (err.name !== "NotAllowedError") {
      console.error("[Biometrics] Auth error:", err);
    }
    return false;
  }
}
