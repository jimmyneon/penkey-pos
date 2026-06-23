"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@penkey/ui";
import { QrCode, Copy, Star } from "lucide-react";
import { useToast } from "@/lib/hooks/use-toast";
import { SettingsSection, SettingRow, SettingsHeader, SettingsLoading } from "@/components/settings/settings-shared";
import { ToastContainer } from "@/components/toast-container";
import { hapticSuccess } from "@/lib/utils/haptics";

export default function QrCodesSettingsPage() {
  const router = useRouter();
  const { toasts, showToast, dismissToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [qrCodes, setQrCodes] = useState<any[]>([]);
  const [googleReviewUrl, setGoogleReviewUrl] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [totalScans, setTotalScans] = useState(0);
  const [loadingQr, setLoadingQr] = useState(false);
  const [creatingQr, setCreatingQr] = useState(false);
  const [newGoogleReviewUrl, setNewGoogleReviewUrl] = useState("");

  useEffect(() => {
    const sessionData = sessionStorage.getItem("pos_session") || localStorage.getItem("pos_session");
    if (!sessionData) {
      router.push("/lock");
      return;
    }
    setLoading(false);
    loadQRCodes();
  }, []);

  const loadQRCodes = async () => {
    setLoadingQr(true);
    try {
      const sessionData = sessionStorage.getItem("pos_session") || localStorage.getItem("pos_session");
      if (!sessionData) return;

      const session = JSON.parse(sessionData);
      const orgId = session.org_id;

      const response = await fetch(`/api/qr-codes?org_id=${orgId}`);
      const data = await response.json();

      if (data.qr_codes) {
        setQrCodes(data.qr_codes);

        const googleQR = data.qr_codes.find((qr: any) => qr.code_type === 'google_review');
        if (googleQR) {
          setGoogleReviewUrl(googleQR.target_url);
          const baseUrl = window.location.origin;
          setTrackingUrl(`${baseUrl}/qr/${googleQR.unique_code}`);

          const statsResponse = await fetch(`/api/qr-codes/${googleQR.id}/stats`);
          const statsData = await statsResponse.json();
          if (statsData.stats) {
            setTotalScans(statsData.stats.total_scans || 0);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load QR codes:', error);
    } finally {
      setLoadingQr(false);
    }
  };

  const copyTrackingUrl = async () => {
    try {
      await navigator.clipboard.writeText(trackingUrl);
      showToast("Tracking URL copied to clipboard", "success");
      hapticSuccess();
    } catch (error) {
      showToast("Failed to copy URL", "error");
    }
  };

  const updateGoogleReviewUrl = async () => {
    try {
      const googleQR = qrCodes.find((qr: any) => qr.code_type === 'google_review');
      if (!googleQR) {
        showToast("Google Review QR code not found", "error");
        return;
      }

      const response = await fetch(`/api/qr-codes/${googleQR.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_url: googleReviewUrl }),
      });

      if (!response.ok) throw new Error('Failed to update URL');

      showToast("Google Review URL updated", "success");
      hapticSuccess();
      loadQRCodes();
    } catch (error) {
      showToast("Failed to update URL", "error");
    }
  };

  const createGoogleReviewQR = async () => {
    if (!newGoogleReviewUrl) {
      showToast("Please enter a Google Review URL", "error");
      return;
    }

    setCreatingQr(true);
    try {
      const sessionData = sessionStorage.getItem("pos_session") || localStorage.getItem("pos_session");
      if (!sessionData) {
        showToast("Session expired", "error");
        return;
      }

      const session = JSON.parse(sessionData);
      const orgId = session.org_id;

      const response = await fetch('/api/qr-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          code_type: 'google_review',
          name: 'Google Reviews',
          target_url: newGoogleReviewUrl,
        }),
      });

      if (!response.ok) throw new Error('Failed to create QR code');

      showToast("Google Review QR code created", "success");
      hapticSuccess();
      setNewGoogleReviewUrl("");
      loadQRCodes();
    } catch (error) {
      showToast("Failed to create QR code", "error");
    } finally {
      setCreatingQr(false);
    }
  };

  if (loading) return <SettingsLoading />;

  return (
    <div className="h-screen bg-[#2d2d2d] flex flex-col overflow-hidden">
      <SettingsHeader title="QR Codes" onBack={() => router.push("/settings")} />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="p-3 sm:p-4 md:p-8 pb-8">
          <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">

            <SettingsSection title="QR Codes" icon={QrCode}>
              {loadingQr ? (
                <SettingRow label="Loading..." description="Loading QR code settings">
                  <div className="animate-spin w-4 h-4 border-2 border-penkey-orange border-t-transparent rounded-full"></div>
                </SettingRow>
              ) : trackingUrl ? (
                <>
                  <SettingRow label="Tracking URL" description="Copy this URL to use in QR codes">
                    <div className="flex gap-2 items-center">
                      <div className="bg-[#3d3d3d] text-white px-3 py-2 rounded border border-gray-600 min-h-[44px] text-sm sm:text-base max-w-[300px] truncate">
                        {trackingUrl}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={copyTrackingUrl}
                        className="min-h-[44px] min-w-[80px] border-gray-600 text-black"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </SettingRow>

                  <SettingRow label="Google Review URL" description="Where customers are redirected after scanning">
                    <div className="flex gap-2 flex-col sm:flex-row">
                      <input
                        type="text"
                        value={googleReviewUrl}
                        onChange={(e) => setGoogleReviewUrl(e.target.value)}
                        placeholder="https://g.page/r/..."
                        className="flex-1 bg-[#3d3d3d] text-white px-3 py-2 rounded border border-gray-600 focus:border-penkey-orange focus:outline-none min-h-[44px] text-sm sm:text-base"
                      />
                      <Button
                        size="sm"
                        onClick={updateGoogleReviewUrl}
                        className="min-h-[44px] min-w-[100px] bg-penkey-orange hover:bg-orange-600"
                      >
                        Update
                      </Button>
                    </div>
                  </SettingRow>

                  <SettingRow label="Total Scans" description="Number of times QR code has been scanned">
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-yellow-400" />
                      <span className="text-white text-lg font-semibold">{totalScans}</span>
                    </div>
                  </SettingRow>

                  <SettingRow label="View Metrics" description="Detailed scan statistics and goals">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => router.push("/qr-metrics")}
                      className="min-h-[44px] min-w-[140px] border-gray-600 text-black"
                    >
                      <QrCode className="h-4 w-4 mr-2" />
                      View Metrics
                    </Button>
                  </SettingRow>
                </>
              ) : (
                <>
                  <SettingRow label="Create Google Review QR Code" description="Enter your Google Business Profile review link">
                    <div className="flex gap-2 flex-col sm:flex-row w-full">
                      <input
                        type="text"
                        value={newGoogleReviewUrl}
                        onChange={(e) => setNewGoogleReviewUrl(e.target.value)}
                        placeholder="https://g.page/r/YOUR_BUSINESS_ID/review"
                        className="flex-1 bg-[#3d3d3d] text-white px-3 py-2 rounded border border-gray-600 focus:border-penkey-orange focus:outline-none min-h-[44px] text-sm sm:text-base"
                      />
                      <Button
                        size="sm"
                        onClick={createGoogleReviewQR}
                        disabled={creatingQr || !newGoogleReviewUrl}
                        className="min-h-[44px] min-w-[100px] bg-penkey-orange hover:bg-orange-600"
                      >
                        {creatingQr ? (
                          <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                        ) : (
                          "Create"
                        )}
                      </Button>
                    </div>
                  </SettingRow>

                  <div className="mt-4 p-4 bg-[#2d2d2d] rounded-lg border border-gray-600">
                    <h4 className="font-semibold text-white mb-2">How to get your Google Review link:</h4>
                    <ol className="text-gray-300 text-sm space-y-1 list-decimal list-inside">
                      <li>Go to your <a href="https://business.google.com" target="_blank" className="text-penkey-orange hover:underline">Google Business Profile</a></li>
                      <li>Click "Ask for reviews"</li>
                      <li>Copy the review link</li>
                      <li>Paste it above and click Create</li>
                    </ol>
                  </div>
                </>
              )}
            </SettingsSection>

          </div>
        </div>
      </div>
    </div>
  );
}
