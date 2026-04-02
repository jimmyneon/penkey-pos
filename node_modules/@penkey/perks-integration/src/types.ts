// Shared types between POS and Perks apps

export interface SharedCustomer {
  id: string;
  email?: string;
  phone?: string;
  first_name: string;
  last_name: string;
  customer_code: string; // QR code identifier for check-in
  profile_qr_code?: string; // QR code for profile link
  points_balance?: number;
  membership_tier?: 'bronze' | 'silver' | 'gold' | 'platinum';
  is_checked_in?: boolean;
  is_nearby?: boolean; // GPS proximity detected
  last_checkin_at?: string;
  last_nearby_at?: string; // When proximity was detected
  last_location_update?: string; // Most recent of last_checkin_at or last_nearby_at
  checkin_store_id?: string;
  current_location?: {
    latitude: number;
    longitude: number;
  };
  distance_meters?: number;
  total_spent?: number;
  visit_count?: number;
  proximity_status?: 'checked_in' | 'nearby' | 'unknown';
}

export interface CheckinRequest {
  customer_id: string;
  store_id: string;
  latitude: number;
  longitude: number;
  method?: 'gps' | 'qr_scan' | 'manual';
}

export interface CheckinResponse {
  success: boolean;
  checkin_id?: string;
  message: string;
  error?: string;
}

export interface NearbyCustomersRequest {
  store_id: string;
  radius_meters?: number;
}

export interface NearbyCustomersResponse {
  customers: SharedCustomer[];
  store_location?: {
    latitude: number;
    longitude: number;
  };
  search_radius: number;
}

export interface CustomerSearchRequest {
  query: string;
  store_id?: string;
  limit?: number;
}

export interface CustomerSearchResponse {
  customers: SharedCustomer[];
  query: string;
  total: number;
}

export interface PointsTransaction {
  id: string;
  customer_id: string;
  receipt_id?: string;
  type: 'earned' | 'redeemed' | 'expired' | 'bonus' | 'adjustment';
  points: number;
  reason?: string;
  created_at: string;
}

export interface PurchaseHistoryItem {
  receipt_id: string;
  receipt_number: string;
  date: string;
  total: number;
  items_count: number;
  points_earned: number;
  store_name?: string;
}

export interface PurchaseHistoryResponse {
  purchases: PurchaseHistoryItem[];
  total_spent: number;
  total_visits: number;
  total_points_earned: number;
}

export interface ProximityDetectionRequest {
  store_id: string;
  latitude: number;
  longitude: number;
  radius_meters?: number;
  include_checked_in?: boolean;
  time_window_minutes?: number; // Only show customers who checked in within this time window
}

export interface ProximityDetectionResponse {
  customers: SharedCustomer[];
  checked_in_count: number;
  nearby_count: number;
  total_detected: number;
  detection_radius: number;
  store_location: {
    latitude: number;
    longitude: number;
  };
}

export interface ProfileQRRequest {
  customer_id: string;
  qr_type: 'checkin' | 'profile';
}

export interface ProfileQRResponse {
  qr_code: string;
  qr_data: string; // The actual data encoded in QR
  expires_at?: string;
}

export interface NearbyCustomerCache {
  customer_id: string;
  store_id: string;
  detected_at: string;
  expires_at: string;
  distance_meters: number;
  last_location: {
    latitude: number;
    longitude: number;
  };
}
