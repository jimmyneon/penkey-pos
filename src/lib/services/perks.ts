export interface PerksSettings {
  domain: string;
  apiKey: string;
}

export interface PerksCustomer {
  id: string;
  name: string;
  email: string;
  phone: string;
  beanBalance: number;
  activeVouchers: PerksVoucher[];
  lastVisitDate?: string;
  canAwardBeanToday: boolean;
}

export interface PerksVoucher {
  id: string;
  name: string;
  description: string;
  discountType: 'percentage' | 'fixed' | 'free_item';
  discountValue: number;
  expiresAt: string;
  isRedeemed: boolean;
}

export interface BeanRules {
  reusableCup: boolean;
  foodDrinkCombo: boolean;
  penkeyCup: boolean;
  before9am: boolean;
  after230pm: boolean;
  monthlySpecial: boolean;
  broughtFriend: boolean;
}

export interface MenuItem {
  name: string;
  price: number;
}

export interface RecordVisitRequest {
  userId: string;
  beanRules: BeanRules;
  menuItems: MenuItem[];
  staffId: string;
  locationId: string;
}

export interface RedeemVoucherRequest {
  voucher_id?: string;
  qr_code?: string;
  staff_id: string;
}

/**
 * Get Perks settings from org_settings via API
 */
export async function getPerksSettings(orgId: string): Promise<PerksSettings | null> {
  try {
    const response = await fetch("/api/settings/perks");
    
    if (!response.ok) {
      console.error("[Perks] Failed to fetch settings:", response.status);
      return null;
    }

    const data = await response.json();
    
    if (!data.domain || !data.apiKey) {
      console.warn("[Perks] Perks settings not configured");
      return null;
    }

    return {
      domain: data.domain,
      apiKey: data.apiKey,
    };
  } catch (error) {
    console.error("[Perks] Error fetching settings:", error);
    return null;
  }
}

/**
 * Scan QR code via Perks API
 */
export async function scanQRCode(orgId: string, qrData: string): Promise<PerksCustomer | null> {
  console.log("[Perks] scanQRCode called with orgId:", orgId);
  console.log("[Perks] scanQRCode called with qrData:", qrData);
  
  const settings = await getPerksSettings(orgId);
  console.log("[Perks] Settings retrieved:", settings);
  
  if (!settings) {
    console.error("[Perks] Perks settings not configured");
    throw new Error("Perks settings not configured");
  }

  console.log("[Perks] Attempting to scan QR code:", qrData.substring(0, 100) + "...");

  // Basic validation - check if it's not empty
  if (!qrData || qrData.trim().length === 0) {
    console.error("[Perks] QR code is empty");
    throw new Error("QR code is empty");
  }

  try {
    // Remove trailing slash from domain to avoid double slashes
    const domain = settings.domain.replace(/\/$/, "");
    const requestBody = { qr_data: qrData };
    
    console.log("[Perks] Request body:", JSON.stringify(requestBody));
    console.log("[Perks] Request URL:", `${domain}/api/pos/scan`);
    console.log("[Perks] Authorization header:", `Bearer ${settings.apiKey.substring(0, 10)}...`);
    
    console.log("[Perks] Fetching...");
    const response = await fetch(`${domain}/api/pos/scan`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${settings.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });
    
    console.log("[Perks] Response status:", response.status);
    console.log("[Perks] Response ok:", response.ok);

    if (!response.ok) {
      const error = await response.text();
      console.error(`[Perks] Scan failed (${response.status}):`, error);
      console.error("[Perks] Request that failed:", JSON.stringify(requestBody));
      throw new Error(`Scan failed: ${error}`);
    }

    console.log("[Perks] Parsing JSON response...");
    const data = await response.json();
    console.log("[Perks] Response data:", data);
    console.log("[Perks] Returning customer data");
    return data;
  } catch (error) {
    console.error("[Perks] Scan error:", error);
    console.error("[Perks] Error stack:", error instanceof Error ? error.stack : 'No stack');
    throw error;
  }
}

/**
 * Record visit and award beans
 */
export async function recordVisit(
  orgId: string,
  request: RecordVisitRequest
): Promise<{ success: boolean; beansAwarded: number; newBalance: number } | null> {
  const settings = await getPerksSettings(orgId);
  if (!settings) {
    throw new Error("Perks settings not configured");
  }

  try {
    const domain = settings.domain.replace(/\/$/, "");
    const response = await fetch(`${domain}/api/pos/record-visit`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${settings.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[Perks] Record visit failed (${response.status}):`, error);
      throw new Error(`Record visit failed: ${error}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("[Perks] Record visit error:", error);
    throw error;
  }
}

/**
 * Redeem voucher
 */
export async function redeemVoucher(
  orgId: string,
  request: RedeemVoucherRequest
): Promise<{ success: boolean; message: string } | null> {
  const settings = await getPerksSettings(orgId);
  if (!settings) {
    throw new Error("Perks settings not configured");
  }

  try {
    const domain = settings.domain.replace(/\/$/, "");
    const response = await fetch(`${domain}/api/pos/redeem-voucher`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${settings.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[Perks] Redeem voucher failed (${response.status}):`, error);
      throw new Error(`Redeem voucher failed: ${error}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("[Perks] Redeem voucher error:", error);
    throw error;
  }
}
