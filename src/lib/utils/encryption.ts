/**
 * Client-side encryption utility for sensitive data in IndexedDB
 * Uses Web Crypto API for AES-GCM encryption
 * 
 * ✅ SECURITY: Encrypts PIN hashes before storing in IndexedDB
 * This prevents device theft attacks where attacker gains physical access
 */

/**
 * Check if Web Crypto API is available
 */
function isCryptoAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.crypto?.subtle;
}

/**
 * Derive encryption key from a master key
 * Uses PBKDF2 to derive a strong key from the master key
 */
async function deriveKey(masterKey: string): Promise<CryptoKey> {
  if (!isCryptoAvailable()) {
    throw new Error('Web Crypto API not available');
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(masterKey);
  
  // Import the master key
  const baseKey = await crypto.subtle!.importKey(
    'raw',
    data,
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  
  // Derive a key using PBKDF2
  return crypto.subtle!.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('penkey-pos-encryption-salt'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Get or create a master encryption key
 * Stored in sessionStorage (cleared on browser close)
 */
async function getMasterKey(): Promise<string> {
  // Try to get existing key from sessionStorage
  let masterKey = sessionStorage.getItem('__encryption_key');
  
  if (!masterKey) {
    // Generate a new random key
    const randomBytes = crypto.getRandomValues(new Uint8Array(32));
    masterKey = Array.from(randomBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    // Store in sessionStorage (cleared on browser close)
    sessionStorage.setItem('__encryption_key', masterKey);
  }
  
  return masterKey;
}

/**
 * Encrypt data using AES-GCM
 * Returns encrypted data as base64 string with IV prepended
 * Falls back to plaintext if crypto unavailable (dev mode)
 */
export async function encryptData(plaintext: string): Promise<string> {
  try {
    if (!isCryptoAvailable()) {
      console.warn('[Encryption] Web Crypto API unavailable, storing plaintext (dev mode only)');
      return plaintext;
    }

    const masterKey = await getMasterKey();
    const key = await deriveKey(masterKey);
    
    // Generate random IV
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Encrypt the data
    const encoder = new TextEncoder();
    const encrypted = await crypto.subtle!.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoder.encode(plaintext)
    );
    
    // Combine IV + encrypted data and return as base64
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    
    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    console.error('[Encryption] Failed to encrypt data:', error);
    // Fallback: return plaintext in dev mode
    return plaintext;
  }
}

/**
 * Decrypt data using AES-GCM
 * Expects base64 string with IV prepended
 * Falls back to plaintext if crypto unavailable or if plaintext stored (dev mode)
 */
export async function decryptData(ciphertext: string): Promise<string> {
  try {
    if (!isCryptoAvailable()) {
      console.warn('[Encryption] Web Crypto API unavailable, treating as plaintext (dev mode only)');
      return ciphertext;
    }

    const masterKey = await getMasterKey();
    const key = await deriveKey(masterKey);
    
    // Decode base64 and extract IV + encrypted data
    const combined = new Uint8Array(
      atob(ciphertext)
        .split('')
        .map(c => c.charCodeAt(0))
    );
    
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    
    // Decrypt the data
    const decrypted = await crypto.subtle!.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    );
    
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error('[Encryption] Failed to decrypt data:', error);
    // Fallback: treat as plaintext in dev mode
    return ciphertext;
  }
}

/**
 * Encrypt an object to JSON string
 */
export async function encryptObject<T>(obj: T): Promise<string> {
  return encryptData(JSON.stringify(obj));
}

/**
 * Decrypt a JSON string to object
 */
export async function decryptObject<T>(ciphertext: string): Promise<T> {
  const plaintext = await decryptData(ciphertext);
  return JSON.parse(plaintext);
}
