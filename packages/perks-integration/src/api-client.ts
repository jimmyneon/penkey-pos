// API client for communication between POS and Perks

import type {
  SharedCustomer,
  CheckinRequest,
  CheckinResponse,
  NearbyCustomersRequest,
  NearbyCustomersResponse,
  CustomerSearchRequest,
  CustomerSearchResponse,
  PurchaseHistoryResponse,
  ProximityDetectionRequest,
  ProximityDetectionResponse,
  ProfileQRRequest,
  ProfileQRResponse
} from './types';

export class PerksApiClient {
  private baseUrl: string;
  private apiKey?: string;

  constructor(baseUrl: string, apiKey?: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = apiKey;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers = new Headers(options.headers);
    headers.set('Content-Type', 'application/json');

    if (this.apiKey) {
      headers.set('Authorization', `Bearer ${this.apiKey}`);
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  // Customer lookup by QR code
  async getCustomerByCode(customerCode: string): Promise<SharedCustomer> {
    return this.request<SharedCustomer>(`/api/integration/customers/by-code/${customerCode}`);
  }

  // Get nearby checked-in customers
  async getNearbyCustomers(request: NearbyCustomersRequest): Promise<NearbyCustomersResponse> {
    const params = new URLSearchParams({
      store_id: request.store_id,
      ...(request.radius_meters && { radius: request.radius_meters.toString() })
    });
    
    return this.request<NearbyCustomersResponse>(`/api/integration/customers/nearby?${params}`);
  }

  // Search customers by text
  async searchCustomers(request: CustomerSearchRequest): Promise<CustomerSearchResponse> {
    const params = new URLSearchParams({
      q: request.query,
      ...(request.store_id && { store_id: request.store_id }),
      ...(request.limit && { limit: request.limit.toString() })
    });
    
    return this.request<CustomerSearchResponse>(`/api/integration/customers/search?${params}`);
  }

  // Customer check-in
  async checkinCustomer(request: CheckinRequest): Promise<CheckinResponse> {
    return this.request<CheckinResponse>('/api/integration/customers/checkin', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // Customer check-out
  async checkoutCustomer(customerId: string): Promise<CheckinResponse> {
    return this.request<CheckinResponse>(`/api/integration/customers/checkin?customer_id=${customerId}`, {
      method: 'DELETE',
    });
  }

  // Get customer purchase history
  async getCustomerPurchaseHistory(customerId: string, limit?: number): Promise<PurchaseHistoryResponse> {
    const params = new URLSearchParams({
      ...(limit && { limit: limit.toString() })
    });
    
    return this.request<PurchaseHistoryResponse>(`/api/integration/customers/${customerId}/purchases?${params}`);
  }

  // Get customer details
  async getCustomer(customerId: string): Promise<SharedCustomer> {
    return this.request<SharedCustomer>(`/api/integration/customers/${customerId}`);
  }

  // Award points for purchase
  async awardPoints(customerId: string, points: number, receiptId: string, reason?: string): Promise<void> {
    await this.request('/api/integration/customers/points/award', {
      method: 'POST',
      body: JSON.stringify({
        customer_id: customerId,
        points,
        receipt_id: receiptId,
        reason: reason || `Purchase points: Receipt ${receiptId}`
      }),
    });
  }

  // Proximity detection - find customers near a location
  async detectNearbyCustomers(request: ProximityDetectionRequest): Promise<ProximityDetectionResponse> {
    return this.request<ProximityDetectionResponse>('/api/integration/customers/proximity', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // Generate profile QR code
  async generateProfileQR(request: ProfileQRRequest): Promise<ProfileQRResponse> {
    return this.request<ProfileQRResponse>('/api/integration/customers/qr/generate', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // Get customer by profile QR data
  async getCustomerByProfileQR(qrData: string): Promise<SharedCustomer> {
    return this.request<SharedCustomer>(`/api/integration/customers/by-profile-qr/${encodeURIComponent(qrData)}`);
  }

  // Update customer proximity status
  async updateProximityStatus(customerId: string, storeId: string, isNearby: boolean): Promise<void> {
    await this.request('/api/integration/customers/proximity/update', {
      method: 'POST',
      body: JSON.stringify({
        customer_id: customerId,
        store_id: storeId,
        is_nearby: isNearby,
        detected_at: new Date().toISOString()
      }),
    });
  }
}

// Factory function for POS app
export function createPerksApiClient(): PerksApiClient {
  const perksBaseUrl = process.env.NEXT_PUBLIC_PERKS_API_URL;
  const apiKey = process.env.NEXT_PUBLIC_PERKS_API_KEY; // Must be NEXT_PUBLIC_ for browser access
  
  if (!perksBaseUrl) {
    throw new Error(
      '[PerksApiClient] NEXT_PUBLIC_PERKS_API_URL is not set! ' +
      'Add it to your .env.local file (e.g., https://your-perks-app.vercel.app)'
    );
  }
  
  if (!apiKey) {
    throw new Error(
      '[PerksApiClient] NEXT_PUBLIC_PERKS_API_KEY is not set! ' +
      'Add it to your .env.local file'
    );
  }
  
  console.log('[PerksApiClient] Creating client with:', {
    baseUrl: perksBaseUrl,
    hasApiKey: true,
    apiKeyPreview: `${apiKey.substring(0, 10)}...`
  });
  
  return new PerksApiClient(perksBaseUrl, apiKey);
}

// Lazy singleton - creates instance on first access
let _perksApiInstance: PerksApiClient | null = null;

export const perksApi = new Proxy({} as PerksApiClient, {
  get(target, prop) {
    if (!_perksApiInstance) {
      _perksApiInstance = createPerksApiClient();
    }
    return (_perksApiInstance as any)[prop];
  }
});
