import type {
  SumUpConfig,
  PaymentIntent,
  PaymentResult,
  ReaderInfo,
} from "./types";

/**
 * Offline-capable SumUp client
 * Works with cached OAuth tokens or API keys
 */
export class OfflineSumUpClient {
  private config: SumUpConfig;
  private baseUrl: string;
  private isOnline: boolean = navigator.onLine;

  constructor(config: SumUpConfig) {
    this.config = config;
    this.baseUrl =
      config.environment === "production"
        ? "https://api.sumup.com/v0.1"
        : "https://api.sumup.com/v0.1";

    // Listen for online/offline events
    window.addEventListener("online", () => {
      this.isOnline = true;
    });
    window.addEventListener("offline", () => {
      this.isOnline = false;
    });
  }

  /**
   * Check if we can make API calls
   */
  private canMakeApiCall(): boolean {
    return this.isOnline && !!((this.config.accessToken || this.config.apiKey));
  }

  /**
   * Get auth headers based on available credentials
   */
  private getAuthHeaders(): Record<string, string> {
    if (this.config.accessToken) {
      return {
        "Authorization": `Bearer ${this.config.accessToken}`,
        "Content-Type": "application/json",
      };
    } else if (this.config.apiKey) {
      return {
        "Authorization": `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
      };
    }
    throw new Error("No authentication credentials available");
  }

  /**
   * Validate API credentials
   */
  async validateCredentials(): Promise<boolean> {
    if (!this.config.apiKey || !this.config.merchantCode) {
      return false;
    }

    if (!this.isOnline) {
      return false; // Can't validate offline
    }

    try {
      // Test API call to get readers
      const response = await fetch(
        `${this.baseUrl}/merchants/${this.config.merchantCode}/readers`,
        {
          headers: this.getAuthHeaders(),
        }
      );

      return response.ok;
    } catch (error) {
      console.error("Failed to validate SumUp credentials:", error);
      return false;
    }
  }

  /**
   * Check authentication status
   */
  isAuthenticated(): boolean {
    return !!(this.config.accessToken || this.config.apiKey);
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): {
    online: boolean;
    authenticated: boolean;
    method: "oauth" | "api_key" | "none";
  } {
    return {
      online: this.isOnline,
      authenticated: this.isAuthenticated(),
      method: this.config.accessToken ? "oauth" : 
               this.config.apiKey ? "api_key" : "none",
    };
  }

  /**
   * Get available readers (with offline fallback)
   */
  async getReaders(): Promise<ReaderInfo[]> {
    if (!this.canMakeApiCall()) {
      // Return cached readers or empty array
      return this.getCachedReaders();
    }

    try {
      const merchantCode = this.config.merchantCode;
      if (!merchantCode) {
        throw new Error("No merchant code available");
      }

      const response = await fetch(
        `${this.baseUrl}/merchants/${merchantCode}/readers`,
        {
          headers: this.getAuthHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get readers: ${response.statusText}`);
      }

      const data = await response.json();
      const readers = data.readers || [];
      
      // Cache readers for offline use
      this.cacheReaders(readers);
      
      return readers;
    } catch (error) {
      console.error("Failed to fetch readers:", error);
      return this.getCachedReaders();
    }
  }

  /**
   * Create checkout (online only)
   */
  async createReaderCheckout(intent: PaymentIntent): Promise<PaymentResult> {
    if (!this.canMakeApiCall()) {
      return {
        success: false,
        amount: intent.amount,
        timestamp: new Date().toISOString(),
        error: {
          code: "OFFLINE",
          message: "Cannot process card payments while offline. Please check internet connection.",
        },
      };
    }

    if (!intent.readerId) {
      throw new Error("Reader ID is required for card reader payments");
    }

    if (!this.config.merchantCode) {
      throw new Error("No merchant code available");
    }

    try {
      const checkoutRequest = {
        total_amount: {
          currency: intent.currency,
          minor_unit: 2,
          value: Math.round(intent.amount * 100),
        },
        description: intent.description || "Penkey POS Purchase",
      };

      const response = await fetch(
        `${this.baseUrl}/merchants/${this.config.merchantCode}/readers/${intent.readerId}/checkout`,
        {
          method: "POST",
          headers: this.getAuthHeaders(),
          body: JSON.stringify(checkoutRequest),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to create checkout: ${error.message || response.statusText}`);
      }

      const data = await response.json();

      return {
        success: true,
        transactionId: data.id,
        transactionCode: data.transaction_code,
        amount: intent.amount,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        amount: intent.amount,
        timestamp: new Date().toISOString(),
        error: {
          code: "CHECKOUT_ERROR",
          message: String(error),
        },
      };
    }
  }

  /**
   * Check checkout status (online only)
   */
  async getCheckoutStatus(checkoutId: string): Promise<PaymentResult> {
    if (!this.canMakeApiCall()) {
      return {
        success: false,
        amount: 0,
        timestamp: new Date().toISOString(),
        error: {
          code: "OFFLINE",
          message: "Cannot check payment status while offline",
        },
      };
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/checkouts/${checkoutId}`,
        {
          headers: this.getAuthHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get checkout status: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        success: data.status === "PAID",
        transactionId: data.id,
        transactionCode: data.transaction_code,
        cardType: data.payment_type?.card?.type,
        cardLast4: data.payment_type?.card?.last_4_digits,
        amount: data.amount / 100,
        timestamp: data.date,
      };
    } catch (error) {
      return {
        success: false,
        amount: 0,
        timestamp: new Date().toISOString(),
        error: {
          code: "FETCH_ERROR",
          message: String(error),
        },
      };
    }
  }

  /**
   * Cache readers for offline use
   */
  private cacheReaders(readers: ReaderInfo[]): void {
    try {
      localStorage.setItem("sumup_cached_readers", JSON.stringify({
        readers,
        timestamp: Date.now(),
        expires: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
      }));
    } catch (error) {
      console.warn("Failed to cache readers:", error);
    }
  }

  /**
   * Get cached readers
   */
  private getCachedReaders(): ReaderInfo[] {
    try {
      const cached = localStorage.getItem("sumup_cached_readers");
      if (cached) {
        const data = JSON.parse(cached);
        if (data.expires > Date.now()) {
          return data.readers || [];
        }
      }
    } catch (error) {
      console.warn("Failed to load cached readers:", error);
    }
    return [];
  }

  /**
   * Save OAuth tokens (for offline use)
   */
  saveTokens(): void {
    if (this.config.accessToken) {
      const tokenData = {
        accessToken: this.config.accessToken,
        refreshToken: this.config.refreshToken,
        merchantCode: this.config.merchantCode,
        expiresAt: this.config.expiresAt,
      };
      localStorage.setItem("sumup_oauth_tokens", JSON.stringify(tokenData));
    }
  }

  /**
   * Load OAuth tokens (for offline use)
   */
  loadTokens(): boolean {
    const stored = localStorage.getItem("sumup_oauth_tokens");
    if (stored) {
      try {
        const tokenData = JSON.parse(stored);
        this.config.accessToken = tokenData.accessToken;
        this.config.refreshToken = tokenData.refreshToken;
        this.config.merchantCode = tokenData.merchantCode;
        this.config.expiresAt = tokenData.expiresAt;
        return true;
      } catch (error) {
        console.error("Failed to load OAuth tokens:", error);
        return false;
      }
    }
    return false;
  }

  /**
   * Clear tokens
   */
  clearTokens(): void {
    this.config.accessToken = undefined;
    this.config.refreshToken = undefined;
    this.config.merchantCode = undefined;
    this.config.expiresAt = undefined;
    localStorage.removeItem("sumup_oauth_tokens");
    localStorage.removeItem("sumup_cached_readers");
  }
}
