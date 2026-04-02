import type {
  SumUpConfig,
  PaymentIntent,
  PaymentResult,
  ReaderInfo,
} from "./types";

/**
 * Development/Offline SumUp client for testing
 * Simulates OAuth flow and payment processing
 */
export class DevSumUpClient {
  private config: SumUpConfig;
  private mockReaders: ReaderInfo[] = [
    {
      id: "mock_reader_001",
      name: "SumUp Solo 1",
      model: "SUMUP_SOLO",
      status: "online",
      battery_level: 85,
    },
    {
      id: "mock_reader_002", 
      name: "SumUp Air 1",
      model: "SUMUP_AIR",
      status: "offline",
      battery_level: 45,
    },
  ];

  constructor(config: SumUpConfig) {
    this.config = config;
  }

  /**
   * Simulate OAuth authorization URL
   */
  getAuthorizationUrl(scopes: string[] = ["payments", "payment_instruments"]): string {
    // In development, simulate the OAuth flow
    const params = new URLSearchParams({
      response_type: "code",
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: scopes.join(" "),
      state: this.generateState(),
    });

    // For development, return a mock URL that will trigger success
    return `${this.config.redirectUri}?code=mock_code&state=${params.get('state')}`;
  }

  /**
   * Simulate token exchange
   */
  async exchangeCodeForToken(code: string, state: string): Promise<any> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    return {
      access_token: "mock_access_token_" + Date.now(),
      token_type: "Bearer",
      expires_in: 3600,
      refresh_token: "mock_refresh_token_" + Date.now(),
      scope: "payments payment_instruments",
    };
  }

  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    return !!this.config.accessToken || !!localStorage.getItem("sumup_dev_tokens");
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
      online: true, // Always online in dev mode
      authenticated: this.isAuthenticated(),
      method: this.config.accessToken ? "oauth" : "api_key",
    };
  }

  /**
   * Get mock readers
   */
  async getReaders(): Promise<ReaderInfo[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return this.mockReaders;
  }

  /**
   * Simulate checkout creation
   */
  async createReaderCheckout(intent: PaymentIntent): Promise<PaymentResult> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    return {
      success: true,
      transactionId: "mock_transaction_" + Date.now(),
      transactionCode: "MOCK" + Math.random().toString(36).substr(2, 8).toUpperCase(),
      amount: intent.amount,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Simulate payment status check
   */
  async getCheckoutStatus(checkoutId: string): Promise<PaymentResult> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Simulate successful payment
    return {
      success: true,
      transactionId: checkoutId,
      transactionCode: "MOCK" + Math.random().toString(36).substr(2, 8).toUpperCase(),
      cardType: "visa",
      cardLast4: "4242",
      amount: 10.00, // Mock amount
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Generate mock state
   */
  private generateState(): string {
    return "mock_state_" + Math.random().toString(36).substr(2, 15);
  }

  /**
   * Save mock tokens
   */
  saveTokens(): void {
    if (this.config.accessToken) {
      const tokenData = {
        accessToken: this.config.accessToken,
        refreshToken: this.config.refreshToken,
        merchantCode: "MOCK_MERCHANT_001",
        expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      };
      localStorage.setItem("sumup_dev_tokens", JSON.stringify(tokenData));
    }
  }

  /**
   * Load mock tokens
   */
  loadTokens(): boolean {
    const stored = localStorage.getItem("sumup_dev_tokens");
    if (stored) {
      try {
        const tokenData = JSON.parse(stored);
        this.config.accessToken = tokenData.accessToken;
        this.config.refreshToken = tokenData.refreshToken;
        this.config.merchantCode = tokenData.merchantCode;
        this.config.expiresAt = tokenData.expiresAt;
        return true;
      } catch (error) {
        console.error("Failed to load dev tokens:", error);
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
    localStorage.removeItem("sumup_dev_tokens");
  }
}
