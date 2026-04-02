export interface SumUpConfig {
  // OAuth 2.0 Configuration
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  environment: "production" | "sandbox";
  
  // API Key Configuration
  apiKey?: string;
  merchantCode?: string;
  affiliateKey?: string;
  appId?: string;
  
  // Runtime OAuth data
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
}

export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  description?: string;
  foreignTransactionId: string; // Our receipt ID
  tip?: number;
  readerId?: string; // For Cloud API card reader payments
}

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  transactionCode?: string;
  cardType?: string;
  cardLast4?: string;
  authCode?: string;
  amount: number;
  tip?: number;
  timestamp: string;
  error?: {
    code: string;
    message: string;
  };
}

export interface RefundRequest {
  transactionId: string;
  amount?: number; // Omit for full refund
  reason?: string;
}

export interface RefundResult {
  success: boolean;
  refundId?: string;
  amount: number;
  timestamp: string;
  error?: {
    code: string;
    message: string;
  };
}

export interface WebhookPayload {
  id: string;
  event_type: "PAYMENT_SUCCESSFUL" | "PAYMENT_FAILED" | "REFUND_SUCCESSFUL" | "REFUND_FAILED";
  timestamp: string;
  resource_type: "payment" | "refund";
  resource_id: string;
  data: {
    transaction_id: string;
    transaction_code: string;
    amount: number;
    currency: string;
    status: "SUCCESSFUL" | "FAILED" | "PENDING";
    card?: {
      type: string;
      last_4_digits: string;
    };
    merchant_code: string;
    foreign_transaction_id?: string;
    reader_id?: string; // For card reader transactions
  };
}

export interface ReaderInfo {
  id: string;
  name: string;
  model: string;
  status: "online" | "offline" | "busy";
  battery_level?: number;
}

export interface CheckoutRequest {
  total_amount: {
    currency: string;
    minor_unit: number;
    value: number;
  };
  description?: string;
  tip_rates?: number[];
  tip_timeout?: number;
}

export interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

export interface OAuthState {
  state: string;
  timestamp: number;
}
