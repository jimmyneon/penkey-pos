"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@penkey/ui";
import { ArrowLeft, RefreshCw, QrCode, Star, TrendingUp, Target, Flame, Trophy, Calendar, Clock, ArrowUp, ArrowDown, CheckCircle2, XCircle, Zap, Award } from "lucide-react";

interface QRStats {
  total_scans: number;
  unique_scans: number;
  today_scans: number;
  week_scans: number;
  avg_per_day: number;
  scans_by_day: Record<string, number>;
  scans_by_store: Record<string, number>;
  recent_scans: any[];
}

export default function QRMetricsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<QRStats | null>(null);
  const [qrCodeId, setQrCodeId] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<"week" | "month" | "alltime">("week");

  // Targets
  const weeklyReviewTarget = 5; // 4-5 reviews per week
  const weeklyQRShowTarget = 20; // 10-20 QR shows per week
  const monthlyReviewTarget = 20; // ~5 per week
  const monthlyQRShowTarget = 80; // ~20 per week

  useEffect(() => {
    loadQRCode();
  }, []);

  useEffect(() => {
    if (qrCodeId) {
      loadStats();
    }
  }, [qrCodeId, selectedPeriod]);

  const loadQRCode = async () => {
    try {
      const sessionData = sessionStorage.getItem("pos_session") || localStorage.getItem("pos_session");
      if (!sessionData) return;
      
      const session = JSON.parse(sessionData);
      const orgId = session.org_id;
      
      const response = await fetch(`/api/qr-codes?org_id=${orgId}`);
      const data = await response.json();
      
      if (data.qr_codes && data.qr_codes.length > 0) {
        const googleQR = data.qr_codes.find((qr: any) => qr.code_type === 'google_review');
        if (googleQR) {
          setQrCodeId(googleQR.id);
        }
      }
    } catch (error) {
      console.error('Failed to load QR code:', error);
    }
  };

  const loadStats = async () => {
    if (!qrCodeId) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/qr-codes/${qrCodeId}/stats`);
      const data = await response.json();
      
      if (data.stats) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate period-specific metrics
  const periodMetrics = useMemo(() => {
    if (!stats) return { scans: 0, reviews: 0, qrShows: 0 };

    const now = new Date();
    const daysAgo = selectedPeriod === "week" ? 7 : selectedPeriod === "month" ? 30 : 365;
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - daysAgo);

    let periodScans = 0;
    Object.entries(stats.scans_by_day || {}).forEach(([date, count]) => {
      const scanDate = new Date(date);
      if (scanDate >= startDate) {
        periodScans += count;
      }
    });

    // Estimate reviews (assuming ~50% conversion from scans to actual reviews)
    const estimatedReviews = Math.round(periodScans * 0.5);
    
    // QR shows = scans (each scan is a QR code being shown)
    const qrShows = periodScans;

    return { scans: periodScans, reviews: estimatedReviews, qrShows };
  }, [stats, selectedPeriod]);

  const getTarget = () => {
    switch (selectedPeriod) {
      case "week":
        return { reviews: weeklyReviewTarget, qrShows: weeklyQRShowTarget };
      case "month":
        return { reviews: monthlyReviewTarget, qrShows: monthlyQRShowTarget };
      case "alltime":
        return { reviews: 100, qrShows: 400 };
      default:
        return { reviews: weeklyReviewTarget, qrShows: weeklyQRShowTarget };
    }
  };

  const target = getTarget();
  const reviewProgress = Math.min((periodMetrics.reviews / target.reviews) * 100, 100);
  const qrShowProgress = Math.min((periodMetrics.qrShows / target.qrShows) * 100, 100);

  // Generate encouragement messages
  const encouragementMessages = useMemo(() => {
    const messages: string[] = [];
    
    if (periodMetrics.reviews >= target.reviews) {
      messages.push("🎉 Amazing! You've hit your review target!");
    } else if (periodMetrics.reviews >= target.reviews * 0.75) {
      messages.push("🔥 So close! Just a few more reviews to hit your target!");
    } else if (periodMetrics.reviews >= target.reviews * 0.5) {
      messages.push("💪 Halfway there! Keep showing that QR code!");
    } else if (periodMetrics.reviews > 0) {
      messages.push("📈 Good start! Try showing the QR code to every customer.");
    } else {
      messages.push("🚀 Let's get those reviews! Show the QR code to every customer.");
    }

    if (periodMetrics.qrShows >= target.qrShows) {
      messages.push("⭐ Excellent QR code visibility!");
    } else if (periodMetrics.qrShows >= target.qrShows * 0.5) {
      messages.push("👀 Great visibility! Try to show it to a few more customers.");
    } else {
      messages.push("💡 Tip: Show the QR code on the payment success screen after every transaction.");
    }

    // Period-specific tips
    if (selectedPeriod === "week") {
      messages.push("📅 Weekly goal: 4-5 reviews by showing the QR code 10-20 times.");
    } else if (selectedPeriod === "month") {
      messages.push("📅 Monthly goal: ~20 reviews by showing the QR code ~80 times.");
    }

    return messages;
  }, [periodMetrics, target, selectedPeriod]);

  const getPeriodLabel = () => {
    switch (selectedPeriod) {
      case "week": return "This Week";
      case "month": return "This Month";
      case "alltime": return "All Time";
      default: return "This Week";
    }
  };

  return (
    <div className="h-screen bg-[#2d2d2d] flex flex-col touch-manipulation overflow-hidden">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#3d3d3d] text-white px-4 py-4 flex items-center justify-between border-b border-gray-700 shadow-lg">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => router.push("/settings")}
          className="text-white hover:bg-white/10 min-w-[44px] min-h-[44px] -ml-2"
        >
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <h1 className="font-semibold text-xl">QR Code Metrics</h1>
        <button
          onClick={loadStats}
          className="text-white hover:bg-white/10 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center"
        >
          <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 pb-20">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin w-8 h-8 border-4 border-penkey-orange border-t-transparent rounded-full"></div>
          </div>
        ) : !stats ? (
          <div className="text-center text-gray-400 py-12">
            <QrCode className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p>No QR code found. Create one in Settings.</p>
          </div>
        ) : (
          <>
            {/* Period Selector */}
            <div className="flex gap-2 mb-6">
              {(["week", "month", "alltime"] as const).map((period) => (
                <button
                  key={period}
                  onClick={() => setSelectedPeriod(period)}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                    selectedPeriod === period
                      ? "bg-penkey-orange text-white"
                      : "bg-[#3d3d3d] text-gray-300 hover:bg-[#4d4d4d]"
                  }`}
                >
                  {period === "week" ? "Week" : period === "month" ? "Month" : "All Time"}
                </button>
              ))}
            </div>

            {/* Encouragement Messages */}
            <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/50 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <Trophy className="h-5 w-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                <div className="space-y-2">
                  {encouragementMessages.map((msg, i) => (
                    <p key={i} className="text-white text-sm">{msg}</p>
                  ))}
                </div>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              {/* Reviews Card */}
              <div className="bg-[#3d3d3d] rounded-lg p-4 border border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <Star className="h-5 w-5 text-yellow-400" />
                  <span className="text-xs text-gray-400">{getPeriodLabel()}</span>
                </div>
                <div className="text-3xl font-bold text-white mb-1">{periodMetrics.reviews}</div>
                <div className="text-sm text-gray-400">Est. Reviews</div>
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Target: {target.reviews}</span>
                    <span>{reviewProgress.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-yellow-500 transition-all"
                      style={{ width: `${reviewProgress}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* QR Shows Card */}
              <div className="bg-[#3d3d3d] rounded-lg p-4 border border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <QrCode className="h-5 w-5 text-penkey-orange" />
                  <span className="text-xs text-gray-400">{getPeriodLabel()}</span>
                </div>
                <div className="text-3xl font-bold text-white mb-1">{periodMetrics.qrShows}</div>
                <div className="text-sm text-gray-400">QR Shows</div>
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Target: {target.qrShows}</span>
                    <span>{qrShowProgress.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-penkey-orange transition-all"
                      style={{ width: `${qrShowProgress}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Total Scans */}
            <div className="bg-[#3d3d3d] rounded-lg p-4 border border-gray-700 mb-6">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="h-5 w-5 text-green-400" />
                <span className="text-white font-semibold">Total Scans (All Time)</span>
              </div>
              <div className="text-4xl font-bold text-white">{stats.total_scans}</div>
              <div className="grid grid-cols-3 gap-3 mt-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">{stats.unique_scans ?? 0}</div>
                  <div className="text-xs text-gray-400">Unique Visitors</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">{stats.today_scans ?? 0}</div>
                  <div className="text-xs text-gray-400">Today</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">{stats.avg_per_day ?? 0}</div>
                  <div className="text-xs text-gray-400">Avg / Day</div>
                </div>
              </div>
            </div>

            {/* Recent Scans */}
            <div className="bg-[#3d3d3d] rounded-lg p-4 border border-gray-700">
              <div className="flex items-center gap-3 mb-4">
                <Clock className="h-5 w-5 text-blue-400" />
                <span className="text-white font-semibold">Recent Scans</span>
              </div>
              {stats.recent_scans && stats.recent_scans.length > 0 ? (
                <div className="space-y-3">
                  {stats.recent_scans.slice(0, 5).map((scan: any) => (
                    <div key={scan.id} className="flex items-center justify-between text-sm">
                      <div className="text-gray-300">
                        {new Date(scan.scanned_at).toLocaleString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                      {scan.receipt_id && (
                        <div className="text-gray-400 text-xs">
                          Receipt #{scan.receipt_id.slice(0, 8)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-sm">No scans yet</p>
              )}
            </div>

            {/* Tips Section */}
            <div className="mt-6 bg-[#2d2d2d] rounded-lg p-4 border border-gray-700">
              <div className="flex items-center gap-3 mb-3">
                <Zap className="h-5 w-5 text-yellow-400" />
                <span className="text-white font-semibold">Tips for More Reviews</span>
              </div>
              <ul className="space-y-2 text-sm text-gray-300">
                <li>• Show the QR code after every successful payment</li>
                <li>• Mention "We'd love your review!" when handing receipts</li>
                <li>• Print the QR code on receipts (coming soon)</li>
                <li>• Display QR code at counter for customers to scan</li>
                <li>• Offer a small discount for leaving a review</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
