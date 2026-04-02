/**
 * Client-side CSRF Token Management
 * Automatically adds CSRF tokens to requests
 */

/**
 * Get CSRF token from cookie
 */
export function getCSRFToken(): string | null {
  if (typeof document === 'undefined') return null;

  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'csrf_token') {
      return decodeURIComponent(value);
    }
  }

  return null;
}

/**
 * Add CSRF token to fetch request
 * Usage: await fetch(url, addCSRFToken({ method: 'POST', ... }))
 */
export function addCSRFToken(options: RequestInit): RequestInit {
  const token = getCSRFToken();
  if (!token) {
    console.warn('[CSRF] No CSRF token found in cookies');
    return options;
  }

  return {
    ...options,
    headers: {
      ...options.headers,
      'X-CSRF-Token': token,
    },
  };
}

/**
 * Fetch wrapper that automatically adds CSRF token
 */
export async function fetchWithCSRF(
  url: string,
  options?: RequestInit
): Promise<Response> {
  const optionsWithCSRF = addCSRFToken(options || {});
  return fetch(url, optionsWithCSRF);
}
