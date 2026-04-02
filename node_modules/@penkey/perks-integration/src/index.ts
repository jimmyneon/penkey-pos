// Perks Integration Package - API bridge between POS and Perks apps

export * from './types';
export * from './api-client';

// Re-export commonly used items for convenience
export type {
  SharedCustomer,
  CheckinRequest,
  CheckinResponse,
  NearbyCustomersRequest,
  NearbyCustomersResponse,
  CustomerSearchRequest,
  CustomerSearchResponse,
  PurchaseHistoryResponse
} from './types';

export {
  PerksApiClient,
  createPerksApiClient,
  perksApi
} from './api-client';
