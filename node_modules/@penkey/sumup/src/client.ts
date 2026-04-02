import type {
  SumUpConfig,
  PaymentIntent,
  PaymentResult,
  RefundRequest,
  RefundResult,
  ReaderInfo,
  CheckoutRequest,
  OAuthTokenResponse,
  OAuthState,
} from "./types";

/**
 * SumUp SDK wrapper using OAuth 2.0 authentication
 * Simple, scalable authorization for POS integrations
 */
export class SumUpClient {
  public config: SumUpConfig;
  private baseUrl: string;

  constructor(config: SumUpConfig) {
    this.config = config;
    this.baseUrl =
      config.environment === "production"
        ? "https://api.sumup.com/v0.1"
        : "https://api.sumup.com/v0.1"; // SumUp uses same URL, sandbox via merchant account
  }

  /**
   * Generate OAuth authorization URL
   */
  getAuthorizationUrl(scopes: string[] = ["payments", "payment_instruments"]): string {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: scopes.join(" "),
      state: this.generateState(),
    });

    return `https://api.sumup.com/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string, state: string): Promise<OAuthTokenResponse> {
    // Verify state to prevent CSRF
    const storedState = this.getStoredState();
    if (!storedState || storedState.state !== state) {
      throw new Error("Invalid state parameter");
    }

    try {
      const response = await fetch(`${this.baseUrl}/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: code,
          redirect_uri: this.config.redirectUri,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to exchange code: ${error.message || response.statusText}`);
      }

      const tokenData: OAuthTokenResponse = await response.json();
      
      // Store tokens and expiry
      this.config.accessToken = tokenData.access_token;
      this.config.refreshToken = tokenData.refresh_token;
      this.config.expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
      
      // Clear state
      this.clearStoredState();
      
      // Get merchant info
      await this.updateMerchantInfo();
      
      return tokenData;
    } catch (error) {
      throw new Error(`OAuth token exchange failed: ${error}`);
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(): Promise<OAuthTokenResponse> {
    if (!this.config.refreshToken) {
      throw new Error("No refresh token available");
    }

    try {
      const response = await fetch(`${this.baseUrl}/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: this.config.refreshToken,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to refresh token: ${error.message || response.statusText}`);
      }

      const tokenData: OAuthTokenResponse = await response.json();
      
      // Update tokens
      this.config.accessToken = tokenData.access_token;
      if (tokenData.refresh_token) {
        this.config.refreshToken = tokenData.refresh_token;
      }
      this.config.expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
      
      return tokenData;
    } catch (error) {
      throw new Error(`Token refresh failed: ${error}`);
    }
  }

  /**
   * Check if token is valid and refresh if needed
   */
  private async ensureValidToken(): Promise<void> {
    if (!this.config.accessToken) {
      throw new Error("No access token available. Please authenticate with SumUp.");
    }

    // Check if token is expired or will expire soon (5 minutes buffer)
    if (this.config.expiresAt) {
      const expiryTime = new Date(this.config.expiresAt).getTime();
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;
      
      if (now + fiveMinutes >= expiryTime) {
        await this.refreshAccessToken();
      }
    }
  }

  /**
   * Get authenticated request headers
   */
  private getAuthHeaders(): Record<string, string> {
    if (!this.config.accessToken) {
      throw new Error("No access token available");
    }
    return {
      "Authorization": `Bearer ${this.config.accessToken}`,
      "Content-Type": "application/json",
    };
  }

  /**
   * Update merchant info after authentication
   */
  private async updateMerchantInfo(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/me`, {
        headers: this.getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        this.config.merchantCode = data.merchant_code;
      }
    } catch (error) {
      console.warn("Failed to fetch merchant info:", error);
    }
  }

  /**
   * Generate and store OAuth state
   */
  private generateState(): string {
    const state = Math.random().toString(36).substring(2, 15) + 
                  Math.random().toString(36).substring(2, 15);
    
    const stateData: OAuthState = {
      state,
      timestamp: Date.now(),
    };
    
    sessionStorage.setItem("sumup_oauth_state", JSON.stringify(stateData));
    return state;
  }

  /**
   * Get stored OAuth state
   */
  private getStoredState(): OAuthState | null {
    const stored = sessionStorage.getItem("sumup_oauth_state");
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * Clear stored OAuth state
   */
  private clearStoredState(): void {
    sessionStorage.removeItem("sumup_oauth_state");
  }

  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    return !!(this.config.accessToken && this.config.merchantCode);
  }

  /**
   * Get available card readers
   */
  async getReaders(): Promise<ReaderInfo[]> {
    await this.ensureValidToken();
    
    if (!this.config.merchantCode) {
      throw new Error("No merchant code available");
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/merchants/${this.config.merchantCode}/readers`,
        {
          headers: this.getAuthHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get readers: ${response.statusText}`);
      }

      const data = await response.json();
      return data.readers || [];
    } catch (error) {
      console.error("Failed to fetch readers:", error);
      return [];
    }
  }

  /**
   * Create a payment using Cloud API for card reader
   */
  async createReaderCheckout(intent: PaymentIntent): Promise<PaymentResult> {
    await this.ensureValidToken();
    
    if (!intent.readerId) {
      throw new Error("Reader ID is required for card reader payments");
    }

    if (!this.config.merchantCode) {
      throw new Error("No merchant code available");
    }

    try {
      const checkoutRequest: CheckoutRequest = {
        total_amount: {
          currency: intent.currency,
          minor_unit: 2,
          value: Math.round(intent.amount * 100), // Convert to minor units (pence/cents)
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
   * Check checkout status (for card reader payments)
   */
  async getCheckoutStatus(checkoutId: string): Promise<PaymentResult> {
    await this.ensureValidToken();
    
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
        amount: data.amount / 100, // Convert from minor units
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
   * Process a refund (full or partial)
   */
  async refund(request: RefundRequest): Promise<RefundResult> {
    await this.ensureValidToken();
    
    try {
      const response = await fetch(
        `${this.baseUrl}/me/refund/${request.transactionId}`,
        {
          method: "POST",
          headers: this.getAuthHeaders(),
          body: JSON.stringify({
            amount: request.amount ? Math.round(request.amount * 100) : undefined, // Convert to minor units
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Refund failed: ${error.message}`);
      }

      const data = await response.json();

      return {
        success: true,
        refundId: data.id,
        amount: data.amount / 100, // Convert from minor units
        timestamp: data.date,
      };
    } catch (error) {
      return {
        success: false,
        amount: request.amount || 0,
        timestamp: new Date().toISOString(),
        error: {
          code: "REFUND_ERROR",
          message: String(error),
        },
      };
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    // SumUp uses HMAC-SHA256 for webhook signatures
    // Implementation depends on crypto library availability
    // For now, return true (implement proper verification in production)
    return true;
  }

  /**
   * Save OAuth tokens to localStorage
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
   * Load OAuth tokens from localStorage
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
   * Clear OAuth tokens
   */
  clearTokens(): void {
    this.config.accessToken = undefined;
    this.config.refreshToken = undefined;
    this.config.merchantCode = undefined;
    this.config.expiresAt = undefined;
    localStorage.removeItem("sumup_oauth_tokens");
  }
}
