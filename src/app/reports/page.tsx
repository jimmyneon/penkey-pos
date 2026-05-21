"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@penkey/ui";
import { ArrowLeft, RefreshCw, Calendar, TrendingUp, TrendingDown, Minus, Users, DollarSign, MessageSquare, Trophy, Target, CheckCircle2, Circle, Sparkles, Clock, Flame, ChevronDown, ChevronUp, Receipt, TrendingUp as TrendUp, BarChart3, Package, CreditCard, User, Clock as ClockIcon } from "lucide-react";
import { useScrollLock } from "@/hooks/use-scroll-lock";
import { useSalesSummary } from "@/lib/hooks/use-sales-summary";
import { useSalesByItems } from "@/lib/hooks/use-sales-by-items";
import { useSalesByTransactionType } from "@/lib/hooks/use-sales-by-transaction-type";
import { useSalesByEmployee } from "@/lib/hooks/use-sales-by-employee";
import { useHourlySales } from "@/lib/hooks/use-hourly-sales";

export default function ReportsPage() {
  const router = useRouter();
  const [selectedPeriod, setSelectedPeriod] = useState<"today" | "week" | "month" | "year" | "alltime" | "custom">("today");
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [customDays, setCustomDays] = useState(30);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [showAllItems, setShowAllItems] = useState(false);
  const [showWorstSelling, setShowWorstSelling] = useState(false);
  
  // Manage scroll lock when any modal is open
  useScrollLock(activeModal !== null || showCustomDate);
  
  const openModal = (modal: string) => {
    setActiveModal(modal);
  };
  
  const closeModal = () => {
    setActiveModal(null);
  };
  
  const getDaysForPeriod = () => {
    switch (selectedPeriod) {
      case "today": return 1;
      case "week": return 7;
      case "month": return 30;
      case "year": return 365;
      case "alltime": return 9999; // Large number to fetch all historical data
      case "custom": return customDays;
      default: return 1;
    }
  };
  
  const { data, loading, error, refetch } = useSalesSummary(getDaysForPeriod());
  const { data: itemsData, loading: itemsLoading } = useSalesByItems(getDaysForPeriod());
  const { data: transactionTypeData, loading: transactionTypeLoading } = useSalesByTransactionType(getDaysForPeriod());
  const { data: employeeData, loading: employeeLoading } = useSalesByEmployee(getDaysForPeriod());
  const { data: hourlyData, loading: hourlyLoading } = useHourlySales(getDaysForPeriod());

  // Use all receipts from the selected period (already filtered by API)
  const periodReceipts = useMemo(() => {
    return data?.salesData.receipts || [];
  }, [data]);

  // Calculate period metrics
  const periodMetrics = useMemo(() => {
    const grossSales = periodReceipts.reduce((sum: number, r: any) => sum + parseFloat(r.total || "0"), 0);
    return {
      grossSales,
      receiptCount: periodReceipts.length,
      avgOrder: periodReceipts.length > 0 ? grossSales / periodReceipts.length : 0,
    };
  }, [periodReceipts]);

  // Calculate previous period metrics for comparison
  const previousPeriodMetrics = useMemo(() => {
    if (!periodReceipts.length) return { grossSales: 0, receiptCount: 0 };
    
    // Split receipts into two halves for comparison
    const halfPoint = Math.floor(periodReceipts.length / 2);
    const sortedReceipts = [...periodReceipts].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    
    const olderHalf = sortedReceipts.slice(0, halfPoint);
    const newerHalf = sortedReceipts.slice(halfPoint);
    
    const olderSales = olderHalf.reduce((sum: number, r: any) => sum + parseFloat(r.total || "0"), 0);
    const newerSales = newerHalf.reduce((sum: number, r: any) => sum + parseFloat(r.total || "0"), 0);
    
    return { 
      grossSales: olderSales,
      newerSales,
      diff: newerSales - olderSales
    };
  }, [periodReceipts]);

  // Calculate comparison
  const comparison = useMemo(() => {
    const diff = previousPeriodMetrics.diff || 0;
    const percentChange = previousPeriodMetrics.grossSales > 0
      ? ((diff / previousPeriodMetrics.grossSales) * 100).toFixed(0)
      : 0;
    return { diff, percentChange };
  }, [previousPeriodMetrics]);

  // Find busiest time
  const busiestTime = useMemo(() => {
    if (!periodReceipts.length) return null;
    
    const timeSlots = { morning: 0, lunch: 0, afternoon: 0, evening: 0 };

    periodReceipts.forEach((receipt: any) => {
      const hour = new Date(receipt.created_at).getHours();
      if (hour >= 6 && hour < 12) timeSlots.morning++;
      else if (hour >= 12 && hour < 15) timeSlots.lunch++;
      else if (hour >= 15 && hour < 18) timeSlots.afternoon++;
      else timeSlots.evening++;
    });

    const max = Math.max(...Object.values(timeSlots));
    const busiest = Object.entries(timeSlots).find(([_, count]) => count === max);

    return busiest ? { period: busiest[0], count: busiest[1] } : null;
  }, [periodReceipts]);

  // Generate insights
  const insights = useMemo(() => {
    const messages: string[] = [];
    
    const periodLabel = selectedPeriod === "today" ? "today" 
      : selectedPeriod === "week" ? "this week"
      : selectedPeriod === "month" ? "this month"
      : selectedPeriod === "year" ? "this year"
      : selectedPeriod === "alltime" ? "all time"
      : `in the last ${customDays} days`;
    
    const comparisonLabel = selectedPeriod === "today" ? "yesterday"
      : selectedPeriod === "week" ? "last week"
      : selectedPeriod === "month" ? "last month" 
      : selectedPeriod === "year" ? "last year"
      : selectedPeriod === "alltime" ? "the previous period"
      : "the previous period";

    if (comparison.diff > 0) {
      messages.push(`You're doing GREAT! You made £${periodMetrics.grossSales.toFixed(2)} ${periodLabel}, that's £${Math.abs(comparison.diff).toFixed(2)} MORE than ${comparisonLabel}!`);
    } else if (comparison.diff < 0) {
      messages.push(`${periodLabel.charAt(0).toUpperCase() + periodLabel.slice(1)} is a bit slower at £${periodMetrics.grossSales.toFixed(2)}, but that's okay! Keep going!`);
    } else {
      messages.push(`Steady performance! You made £${periodMetrics.grossSales.toFixed(2)} ${periodLabel}.`);
    }

    if (busiestTime && busiestTime.count > 0) {
      const timeLabel = busiestTime.period === "lunch" ? "lunch time (12pm-3pm)"
        : busiestTime.period === "morning" ? "morning (6am-12pm)"
        : busiestTime.period === "afternoon" ? "afternoon (3pm-6pm)"
        : "evening";
      messages.push(`Your busiest time was ${timeLabel} with ${busiestTime.count} tickets!`);
    }

    if (periodMetrics.receiptCount > 0) {
      messages.push(`You've served ${periodMetrics.receiptCount} ticket${periodMetrics.receiptCount !== 1 ? 's' : ''} ${periodLabel}!`);
    }
    
    // Add upsell insights if available
    if (itemsData?.summary) {
      const upsellRate = itemsData.summary.upsell_rate || 0;
      const modifierRevenue = itemsData.summary.modifier_revenue || 0;
      
      if (upsellRate >= 30) {
        messages.push(`🌟 Amazing upselling! ${upsellRate.toFixed(0)}% of items had add-ons, bringing in £${modifierRevenue.toFixed(2)} extra!`);
      } else if (upsellRate >= 20) {
        messages.push(`Great job on upsells! ${upsellRate.toFixed(0)}% of items had add-ons worth £${modifierRevenue.toFixed(2)}.`);
      } else if (upsellRate >= 10) {
        messages.push(`You added £${modifierRevenue.toFixed(2)} through modifiers. Try suggesting more add-ons!`);
      } else if (upsellRate > 0) {
        messages.push(`You had ${upsellRate.toFixed(0)}% upsells worth £${modifierRevenue.toFixed(2)}. Keep suggesting add-ons!`);
      } else if (periodMetrics.receiptCount > 0) {
        messages.push(`💡 Try suggesting add-ons like extra shots, syrups, or milk alternatives to increase sales!`);
      }
    }

    return messages;
  }, [periodMetrics, comparison, busiestTime, selectedPeriod, customDays, itemsData]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  // Scale target based on period with realistic daily targets
  const getTarget = () => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
    
    // Realistic daily targets: Mon-Wed £150, Thu-Fri £200, Sat-Sun £250
    const getDailyTarget = () => {
      if (dayOfWeek === 0 || dayOfWeek === 6) return 250; // Weekend
      if (dayOfWeek === 4 || dayOfWeek === 5) return 200; // Thu-Fri
      return 150; // Mon-Wed
    };
    
    switch (selectedPeriod) {
      case "today": return getDailyTarget();
      case "week": return 1000; // £1,000/week target
      case "month": return 4300; // ~£1,000/week * 4.3 weeks
      case "year": return 52000; // £1,000/week * 52 weeks
      case "alltime": return 50000; // £50,000 all-time target
      case "custom": {
        // Calculate based on mix of weekdays/weekends in period
        const avgDaily = 185; // Weighted average: (3*150 + 2*200 + 2*250) / 7 ≈ 185
        return customDays * avgDaily;
      }
      default: return getDailyTarget();
    }
  };
  
  const periodTarget = getTarget();
  const targetProgress = Math.min((periodMetrics.grossSales / periodTarget) * 100, 100);

  return (
    <div className="h-screen bg-[#2d2d2d] flex flex-col touch-manipulation overflow-hidden">
      {/* Header - Fixed for mobile */}
      <header className="sticky top-0 z-10 bg-[#3d3d3d] text-white px-4 py-4 flex items-center justify-between border-b border-gray-700 shadow-lg">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => router.push("/sell")}
          className="text-white hover:bg-white/10 min-w-[44px] min-h-[44px] -ml-2"
        >
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <h1 className="font-semibold text-xl">Reports</h1>
        <Button
          size="sm"
          variant="ghost"
          onClick={refetch}
          disabled={loading}
          className="text-white hover:bg-white/10 min-w-[44px] min-h-[44px] -mr-2"
        >
          <RefreshCw className={`h-6 w-6 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="h-8 w-8 text-penkey-orange animate-spin" />
          </div>
        ) : error ? (
          <div className="p-4">
            <div className="bg-red-500/10 border border-red-500 rounded-lg p-4 text-center">
              <p className="text-red-500 font-medium">Failed to load reports</p>
              <p className="text-red-400 text-sm mt-1">{error}</p>
              <Button onClick={refetch} className="mt-4 bg-penkey-orange hover:bg-penkey-orange/90">
                Try Again
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-5 pb-24 safe-bottom">
            {/* Greeting */}
            <div className="bg-gradient-to-r from-penkey-orange to-orange-400 rounded-xl p-6 text-white shadow-lg">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="h-6 w-6" />
                <h2 className="text-2xl font-bold">{getGreeting()}, {data?.userName}!</h2>
              </div>
              <p className="text-white/90 text-base">
                {selectedPeriod === "today" && "Today's sales"}
                {selectedPeriod === "week" && "Last 7 days"}
                {selectedPeriod === "month" && "Last 30 days"}
                {selectedPeriod === "year" && "Last 365 days"}
                {selectedPeriod === "alltime" && "All time"}
                {selectedPeriod === "custom" && `Last ${customDays} days`}
                {" • "}
                {data?.salesData.receipts.length || 0} receipt{data?.salesData.receipts.length !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Period Selector - Mobile Optimized */}
            <div className="space-y-3">
              {/* Primary Periods - Grid */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setSelectedPeriod("today")}
                  className={`py-4 px-4 rounded-xl font-semibold text-base transition-all min-h-[56px] active:scale-95 ${
                    selectedPeriod === "today"
                      ? "bg-penkey-orange text-white shadow-lg shadow-penkey-orange/30"
                      : "bg-[#3d3d3d] text-gray-300 hover:bg-[#4d4d4d]"
                  }`}
                >
                  Today
                </button>
                <button
                  onClick={() => setSelectedPeriod("week")}
                  className={`py-4 px-4 rounded-xl font-semibold text-base transition-all min-h-[56px] active:scale-95 ${
                    selectedPeriod === "week"
                      ? "bg-penkey-orange text-white shadow-lg shadow-penkey-orange/30"
                      : "bg-[#3d3d3d] text-gray-300 hover:bg-[#4d4d4d]"
                  }`}
                >
                  Week
                </button>
                <button
                  onClick={() => setSelectedPeriod("month")}
                  className={`py-4 px-4 rounded-xl font-semibold text-base transition-all min-h-[56px] active:scale-95 ${
                    selectedPeriod === "month"
                      ? "bg-penkey-orange text-white shadow-lg shadow-penkey-orange/30"
                      : "bg-[#3d3d3d] text-gray-300 hover:bg-[#4d4d4d]"
                  }`}
                >
                  Month
                </button>
                <button
                  onClick={() => setSelectedPeriod("year")}
                  className={`py-4 px-4 rounded-xl font-semibold text-base transition-all min-h-[56px] active:scale-95 ${
                    selectedPeriod === "year"
                      ? "bg-penkey-orange text-white shadow-lg shadow-penkey-orange/30"
                      : "bg-[#3d3d3d] text-gray-300 hover:bg-[#4d4d4d]"
                  }`}
                >
                  Year
                </button>
              </div>
              
              {/* All Time - Full Width */}
              <button
                onClick={() => setSelectedPeriod("alltime")}
                className={`w-full py-4 px-4 rounded-xl font-semibold text-base transition-all min-h-[56px] flex items-center justify-center gap-2 active:scale-95 ${
                  selectedPeriod === "alltime"
                    ? "bg-penkey-orange text-white shadow-lg shadow-penkey-orange/30"
                    : "bg-[#3d3d3d] text-gray-300 hover:bg-[#4d4d4d]"
                }`}
              >
                <Trophy className="h-5 w-5" />
                All Time
              </button>
              
              {/* Custom Period - Full Width */}
              <button
                onClick={() => {
                  setSelectedPeriod("custom");
                  setShowCustomDate(true);
                }}
                className={`w-full py-4 px-4 rounded-xl font-semibold text-base transition-all min-h-[56px] flex items-center justify-center gap-2 active:scale-95 ${
                  selectedPeriod === "custom"
                    ? "bg-penkey-orange text-white shadow-lg shadow-penkey-orange/30"
                    : "bg-[#3d3d3d] text-gray-300 hover:bg-[#4d4d4d]"
                }`}
              >
                <Calendar className="h-5 w-5" />
                Custom Period
              </button>
            </div>

            {/* Main Story Card */}
            <button 
              onClick={() => openModal('sales')}
              className="w-full bg-[#3d3d3d] rounded-xl p-6 border border-penkey-orange/30 animate-pulse-border shadow-lg hover:bg-[#404040] transition-colors text-left active:scale-[0.98]"
            >
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  {comparison.diff > 0 ? (
                    <Sparkles className="h-6 w-6 text-green-400" />
                  ) : comparison.diff < 0 ? (
                    <TrendingDown className="h-6 w-6 text-orange-400" />
                  ) : (
                    <Minus className="h-6 w-6 text-gray-400" />
                  )}
                  <h3 className="text-lg font-semibold text-white">
                    {comparison.diff > 0 
                      ? (selectedPeriod === "today" ? "Great Day!" 
                        : selectedPeriod === "week" ? "Great Week!"
                        : selectedPeriod === "month" ? "Great Month!"
                        : selectedPeriod === "year" ? "Amazing Year!"
                        : selectedPeriod === "alltime" ? "Incredible Performance!"
                        : "Great Period!")
                      : comparison.diff < 0 ? "Keep Going!" : "Steady Performance"}
                  </h3>
                </div>

                <p className="text-4xl font-bold text-white">£{periodMetrics.grossSales.toFixed(2)}</p>

                <p className="text-gray-300 text-base">
                  {periodMetrics.receiptCount > 0 ? (
                    <>You served {periodMetrics.receiptCount} customer{periodMetrics.receiptCount !== 1 ? 's' : ''} 
                    {selectedPeriod === "today" ? "today" 
                      : selectedPeriod === "week" ? "this week"
                      : selectedPeriod === "month" ? "this month"
                      : selectedPeriod === "year" ? "this year"
                      : selectedPeriod === "alltime" ? "all time"
                      : `in ${customDays} days`}
                    </>
                  ) : (
                    <>No sales in this period yet - time to get started!</>
                  )}
                </p>

                {comparison.diff !== 0 && (
                  <p className={`text-sm font-medium flex items-center gap-1 ${
                    comparison.diff > 0 ? "text-green-400" : "text-red-400"
                  }`}>
                    {comparison.diff > 0 ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : (
                      <TrendingDown className="h-4 w-4" />
                    )}
                    £{Math.abs(comparison.diff).toFixed(2)} {comparison.diff >= 0 ? 'more' : 'less'} than 
                    {selectedPeriod === "today" ? "yesterday"
                      : selectedPeriod === "week" ? "last week"
                      : selectedPeriod === "month" ? "last month"
                      : selectedPeriod === "year" ? "last year"
                      : selectedPeriod === "alltime" ? "the beginning"
                      : "previous period"}
                  </p>
                )}

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-penkey-orange h-full rounded-full transition-all duration-500"
                      style={{ width: `${targetProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400">
                    {targetProgress.toFixed(0)}% to your £{periodTarget.toLocaleString()} goal
                  </p>
                </div>

                {/* Tip */}
                {targetProgress < 100 && (periodTarget - periodMetrics.grossSales) > 0 && (
                  <div className="bg-penkey-orange/10 rounded-lg p-3 mt-3">
                    <p className="text-sm text-penkey-orange flex items-start gap-2">
                      <Target className="h-4 w-4 mt-0.5" />
                      <span>Just £{(periodTarget - periodMetrics.grossSales).toLocaleString()} to reach your goal!</span>
                    </p>
                  </div>
                )}
                {targetProgress >= 100 && (
                  <div className="bg-green-500/10 rounded-lg p-3 mt-3">
                    <p className="text-sm text-green-400 flex items-start gap-2">
                      <Trophy className="h-4 w-4 mt-0.5" />
                      <span>Target smashed! You're {targetProgress.toFixed(0)}% of your goal!</span>
                    </p>
                  </div>
                )}
              </div>
            </button>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => openModal('customers')}
                className="bg-[#3d3d3d] rounded-xl p-5 shadow-md min-h-[120px] flex flex-col justify-between hover:bg-[#404040] transition-colors text-left active:scale-[0.98]"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-400">Customers</p>
                  <Users className="h-5 w-5 text-penkey-orange" />
                </div>
                <p className="text-3xl font-bold text-white">{periodMetrics.receiptCount}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {selectedPeriod === "today" ? "people today"
                    : selectedPeriod === "week" ? "this week"
                    : selectedPeriod === "month" ? "this month"
                    : selectedPeriod === "year" ? "this year"
                    : selectedPeriod === "alltime" ? "all time"
                    : `in ${customDays} days`}
                </p>
              </button>

              <button
                onClick={() => openModal('avgorder')}
                className="bg-[#3d3d3d] rounded-xl p-5 shadow-md min-h-[120px] flex flex-col justify-between hover:bg-[#404040] transition-colors text-left active:scale-[0.98]"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-400">Avg Order</p>
                  <DollarSign className="h-5 w-5 text-penkey-orange" />
                </div>
                <p className="text-3xl font-bold text-white">£{periodMetrics.avgOrder.toFixed(2)}</p>
                <p className="text-xs text-gray-400 mt-1">per customer</p>
              </button>
            </div>

            {/* New Report Types - Sales breakdown by items, transaction type, employee, and hourly */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-white">Detailed Reports</h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => openModal('sales-by-items')}
                  className="bg-[#3d3d3d] rounded-xl p-4 shadow-md min-h-[100px] flex flex-col justify-between hover:bg-[#404040] transition-colors text-left active:scale-[0.98]"
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-gray-400">Sales by Items</p>
                    <Package className="h-5 w-5 text-penkey-orange" />
                  </div>
                  <p className="text-xl font-bold text-white">{itemsData?.summary?.total_items || 0}</p>
                  <p className="text-xs text-gray-400 mt-1">items sold</p>
                </button>

                <button
                  onClick={() => openModal('sales-by-transaction-type')}
                  className="bg-[#3d3d3d] rounded-xl p-4 shadow-md min-h-[100px] flex flex-col justify-between hover:bg-[#404040] transition-colors text-left active:scale-[0.98]"
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-gray-400">Transaction Types</p>
                    <CreditCard className="h-5 w-5 text-penkey-orange" />
                  </div>
                  <p className="text-xl font-bold text-white">{transactionTypeData?.transaction_types?.length || 0}</p>
                  <p className="text-xs text-gray-400 mt-1">payment types</p>
                </button>

                <button
                  onClick={() => openModal('sales-by-employee')}
                  className="bg-[#3d3d3d] rounded-xl p-4 shadow-md min-h-[100px] flex flex-col justify-between hover:bg-[#404040] transition-colors text-left active:scale-[0.98]"
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-gray-400">Sales by Employee</p>
                    <User className="h-5 w-5 text-penkey-orange" />
                  </div>
                  <p className="text-xl font-bold text-white">{employeeData?.summary?.total_employees || 0}</p>
                  <p className="text-xs text-gray-400 mt-1">staff members</p>
                </button>

                <button
                  onClick={() => openModal('hourly-sales')}
                  className="bg-[#3d3d3d] rounded-xl p-4 shadow-md min-h-[100px] flex flex-col justify-between hover:bg-[#404040] transition-colors text-left active:scale-[0.98]"
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-gray-400">Hourly Sales</p>
                    <ClockIcon className="h-5 w-5 text-penkey-orange" />
                  </div>
                  <p className="text-xl font-bold text-white">{hourlyData?.summary?.busiest_hour !== null && hourlyData?.summary?.busiest_hour !== undefined ? `${hourlyData.summary.busiest_hour}:00` : 'N/A'}</p>
                  <p className="text-xs text-gray-400 mt-1">busiest hour</p>
                </button>
              </div>
            </div>

            {/* Period Story - Clickable */}
            <button
              onClick={() => openModal('story')}
              className="w-full bg-[#3d3d3d] rounded-xl p-6 shadow-lg hover:bg-[#404040] transition-colors text-left active:scale-[0.98]"
            >
              <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-3">
                <MessageSquare className="h-5 w-5 text-penkey-orange" />
                {selectedPeriod === "today" ? "Today's Story"
                  : selectedPeriod === "week" ? "This Week's Story"
                  : selectedPeriod === "month" ? "This Month's Story"
                  : selectedPeriod === "year" ? "This Year's Story"
                  : selectedPeriod === "alltime" ? "Your Complete Story"
                  : "Period Story"}
              </h3>
              <p className="text-sm text-gray-400">Tap to see full insights</p>
            </button>

            {/* Achievements - Clickable */}
            <button
              onClick={() => openModal('goals')}
              className="w-full bg-[#3d3d3d] rounded-xl p-6 shadow-lg hover:bg-[#404040] transition-colors text-left active:scale-[0.98]"
            >
              <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-3">
                <Trophy className="h-5 w-5 text-penkey-orange" />
                {selectedPeriod === "today" ? "Today's Goals"
                  : selectedPeriod === "week" ? "This Week's Goals"
                  : selectedPeriod === "month" ? "This Month's Goals"
                  : selectedPeriod === "year" ? "This Year's Goals"
                  : selectedPeriod === "alltime" ? "All-Time Goals"
                  : "Period Goals"}
              </h3>
              <div className="flex items-center gap-2">
                <div className="flex -space-x-1">
                  {periodMetrics.receiptCount >= 50 && (
                    <CheckCircle2 className="h-5 w-5 text-green-400" />
                  )}
                  {comparison.diff > 0 && (
                    <CheckCircle2 className="h-5 w-5 text-green-400" />
                  )}
                  {periodMetrics.grossSales >= periodTarget && (
                    <CheckCircle2 className="h-5 w-5 text-green-400" />
                  )}
                </div>
                <p className="text-sm text-gray-400">
                  {[periodMetrics.receiptCount >= 50, comparison.diff > 0, periodMetrics.grossSales >= periodTarget].filter(Boolean).length} of 3 goals achieved
                </p>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* Sales Details Modal */}
      {activeModal === 'sales' && (
        <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={closeModal}>
          <div className="bg-[#3d3d3d] rounded-t-3xl sm:rounded-xl p-6 w-full sm:max-w-md max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                <BarChart3 className="h-6 w-6 text-penkey-orange" />
                Sales Breakdown
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-white text-2xl min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b border-gray-700">
                <span className="text-gray-400">Gross Sales:</span>
                <span className="text-white font-bold text-lg">£{periodMetrics.grossSales.toFixed(2)}</span>
              </div>
              {data?.salesData?.refunds > 0 && (
                <div className="flex justify-between items-center py-3 border-b border-gray-700">
                  <span className="text-gray-400">Refunds:</span>
                  <span className="text-red-400 font-semibold">-£{data.salesData.refunds.toFixed(2)}</span>
                </div>
              )}
              {data?.salesData?.discounts > 0 && (
                <div className="flex justify-between items-center py-3 border-b border-gray-700">
                  <span className="text-gray-400">Discounts:</span>
                  <span className="text-yellow-400 font-semibold">-£{data.salesData.discounts.toFixed(2)}</span>
                </div>
              )}
              {(data?.salesData?.refunds > 0 || data?.salesData?.discounts > 0) && (
                <div className="flex justify-between items-center py-3 border-b border-gray-700 bg-[#2d2d2d] -mx-4 px-4">
                  <span className="text-gray-300 font-semibold">Net Sales:</span>
                  <span className="text-green-400 font-bold">£{data?.salesData?.netSales.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between items-center py-3 border-b border-gray-700">
                <span className="text-gray-400">Total Tickets:</span>
                <span className="text-white font-semibold">{periodMetrics.receiptCount}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-gray-700">
                <span className="text-gray-400">Average Ticket:</span>
                <span className="text-white font-semibold">£{periodMetrics.avgOrder.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-gray-700">
                <span className="text-gray-400">Highest Ticket:</span>
                <span className="text-white font-semibold">
                  £{periodReceipts.length > 0 ? Math.max(...periodReceipts.map((r: any) => parseFloat(r.total || "0"))).toFixed(2) : "0.00"}
                </span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-gray-700">
                <span className="text-gray-400">Lowest Ticket:</span>
                <span className="text-white font-semibold">
                  £{periodReceipts.length > 0 ? Math.min(...periodReceipts.map((r: any) => parseFloat(r.total || "0"))).toFixed(2) : "0.00"}
                </span>
              </div>
            </div>
            
            <Button
              onClick={closeModal}
              className="w-full mt-6 bg-penkey-orange hover:bg-penkey-orange/90 text-white min-h-[48px]"
            >
              Close
            </Button>
          </div>
        </div>
      )}

      {/* Customers Modal */}
      {activeModal === 'customers' && (
        <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={closeModal}>
          <div className="bg-[#3d3d3d] rounded-t-3xl sm:rounded-xl p-6 w-full sm:max-w-md max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                <Users className="h-6 w-6 text-penkey-orange" />
                Ticket Breakdown
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-white text-2xl min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b border-gray-700">
                <span className="text-gray-400">Total Tickets:</span>
                <span className="text-white font-bold text-lg">{periodMetrics.receiptCount}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-gray-700">
                <span className="text-gray-400">Daily Average:</span>
                <span className="text-white font-semibold">
                  {(periodMetrics.receiptCount / getDaysForPeriod()).toFixed(1)} tickets/day
                </span>
              </div>
              {busiestTime && (
                <div className="flex justify-between items-center py-3 border-b border-gray-700">
                  <span className="text-gray-400">Busiest Time:</span>
                  <span className="text-white font-semibold capitalize">
                    {busiestTime.period === "lunch" ? "Lunch (12pm-3pm)"
                      : busiestTime.period === "morning" ? "Morning (6am-12pm)"
                      : busiestTime.period === "afternoon" ? "Afternoon (3pm-6pm)"
                      : "Evening"} - {busiestTime.count} tickets
                  </span>
                </div>
              )}
            </div>
            
            <Button
              onClick={closeModal}
              className="w-full mt-6 bg-penkey-orange hover:bg-penkey-orange/90 text-white min-h-[48px]"
            >
              Close
            </Button>
          </div>
        </div>
      )}

      {/* Average Order Modal */}
      {activeModal === 'avgorder' && (
        <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={closeModal}>
          <div className="bg-[#3d3d3d] rounded-t-3xl sm:rounded-xl p-6 w-full sm:max-w-md max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                <DollarSign className="h-6 w-6 text-penkey-orange" />
                Order Value Analysis
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-white text-2xl min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b border-gray-700">
                <span className="text-gray-400">Average Order:</span>
                <span className="text-white font-bold text-lg">£{periodMetrics.avgOrder.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-gray-700">
                <span className="text-gray-400">Highest Order:</span>
                <span className="text-white font-semibold">
                  £{periodReceipts.length > 0 ? Math.max(...periodReceipts.map((r: any) => parseFloat(r.total || "0"))).toFixed(2) : "0.00"}
                </span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-gray-700">
                <span className="text-gray-400">Lowest Order:</span>
                <span className="text-white font-semibold">
                  £{periodReceipts.length > 0 ? Math.min(...periodReceipts.map((r: any) => parseFloat(r.total || "0"))).toFixed(2) : "0.00"}
                </span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-gray-700">
                <span className="text-gray-400">Total Orders:</span>
                <span className="text-white font-semibold">{periodMetrics.receiptCount}</span>
              </div>
            </div>
            
            <Button
              onClick={closeModal}
              className="w-full mt-6 bg-penkey-orange hover:bg-penkey-orange/90 text-white min-h-[48px]"
            >
              Close
            </Button>
          </div>
        </div>
      )}

      {/* Story Modal */}
      {activeModal === 'story' && (
        <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={closeModal}>
          <div className="bg-[#3d3d3d] rounded-t-3xl sm:rounded-xl p-6 w-full sm:max-w-md max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                <MessageSquare className="h-6 w-6 text-penkey-orange" />
                {selectedPeriod === "today" ? "Today's Story"
                  : selectedPeriod === "week" ? "This Week's Story"
                  : selectedPeriod === "month" ? "This Month's Story"
                  : selectedPeriod === "year" ? "This Year's Story"
                  : selectedPeriod === "alltime" ? "Your Complete Story"
                  : "Period Story"}
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-white text-2xl min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              {insights.map((insight, index) => (
                <div key={index} className="bg-[#2d2d2d] rounded-lg p-4 border border-penkey-orange/30 animate-pulse-border">
                  <p className="text-base text-gray-200 leading-relaxed">
                    {insight}
                  </p>
                </div>
              ))}
              
              {insights.length === 0 && (
                <div className="bg-[#2d2d2d] rounded-lg p-6 text-center">
                  <p className="text-gray-400">No insights available for this period yet.</p>
                </div>
              )}
            </div>
            
            <Button
              onClick={closeModal}
              className="w-full mt-6 bg-penkey-orange hover:bg-penkey-orange/90 text-white min-h-[48px]"
            >
              Close
            </Button>
          </div>
        </div>
      )}

      {/* Goals Modal */}
      {activeModal === 'goals' && (
        <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={closeModal}>
          <div className="bg-[#3d3d3d] rounded-t-3xl sm:rounded-xl p-6 w-full sm:max-w-md max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                <Trophy className="h-6 w-6 text-penkey-orange" />
                {selectedPeriod === "today" ? "Today's Goals"
                  : selectedPeriod === "week" ? "This Week's Goals"
                  : selectedPeriod === "month" ? "This Month's Goals"
                  : selectedPeriod === "year" ? "This Year's Goals"
                  : selectedPeriod === "alltime" ? "All-Time Goals"
                  : "Period Goals"}
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-white text-2xl min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-3">
              {/* Goal 1: Serve tickets based on period */}
              {(() => {
                const ticketGoal = selectedPeriod === "today" ? 20
                  : selectedPeriod === "week" ? 140  // 20/day * 7
                  : selectedPeriod === "month" ? 600  // 20/day * 30
                  : selectedPeriod === "year" ? 7300  // 20/day * 365
                  : selectedPeriod === "alltime" ? 10000
                  : customDays * 20;
                
                return (
                  <div className={`p-4 rounded-xl border-2 transition-all ${
                    periodMetrics.receiptCount >= ticketGoal 
                      ? 'bg-green-500/10 border-green-500/50' 
                      : 'bg-[#2d2d2d] border-gray-700'
                  }`}>
                    <div className="flex items-start gap-3">
                      {periodMetrics.receiptCount >= ticketGoal ? (
                        <CheckCircle2 className="h-6 w-6 text-green-400 flex-shrink-0 mt-0.5" />
                      ) : (
                        <Circle className="h-6 w-6 text-gray-600 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <p className={`font-semibold mb-1 ${
                          periodMetrics.receiptCount >= ticketGoal ? 'text-white' : 'text-gray-400'
                        }`}>
                          Serve {ticketGoal}+ tickets
                        </p>
                        <p className="text-sm text-gray-400">
                          Progress: {periodMetrics.receiptCount} / {ticketGoal} tickets
                        </p>
                        {periodMetrics.receiptCount >= ticketGoal && (
                          <p className="text-sm text-green-400 mt-1">✓ Goal achieved!</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Goal 2: Beat previous period */}
              <div className={`p-4 rounded-xl border-2 transition-all ${
                comparison.diff > 0 
                  ? 'bg-green-500/10 border-green-500/50' 
                  : 'bg-[#2d2d2d] border-gray-700'
              }`}>
                <div className="flex items-start gap-3">
                  {comparison.diff > 0 ? (
                    <CheckCircle2 className="h-6 w-6 text-green-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="h-6 w-6 text-gray-600 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className={`font-semibold mb-1 ${
                      comparison.diff > 0 ? 'text-white' : 'text-gray-400'
                    }`}>
                      Beat {selectedPeriod === "today" ? "yesterday's"
                        : selectedPeriod === "week" ? "last week's"
                        : selectedPeriod === "month" ? "last month's"
                        : selectedPeriod === "year" ? "last year's"
                        : selectedPeriod === "alltime" ? "all previous"
                        : "previous period's"} sales
                    </p>
                    <p className="text-sm text-gray-400">
                      {comparison.diff > 0 
                        ? `£${Math.abs(comparison.diff).toFixed(2)} more than before`
                        : comparison.diff < 0
                        ? `£${Math.abs(comparison.diff).toFixed(2)} less than before`
                        : 'Same as before'}
                    </p>
                    {comparison.diff > 0 && (
                      <p className="text-sm text-green-400 mt-1">✓ Goal achieved!</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Goal 3: Reach target */}
              <div className={`p-4 rounded-xl border-2 transition-all ${
                periodMetrics.grossSales >= periodTarget 
                  ? 'bg-green-500/10 border-green-500/50' 
                  : 'bg-[#2d2d2d] border-gray-700'
              }`}>
                <div className="flex items-start gap-3">
                  {periodMetrics.grossSales >= periodTarget ? (
                    <CheckCircle2 className="h-6 w-6 text-green-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="h-6 w-6 text-gray-600 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className={`font-semibold mb-1 ${
                      periodMetrics.grossSales >= periodTarget ? 'text-white' : 'text-gray-400'
                    }`}>
                      Reach £{periodTarget.toLocaleString()} target
                    </p>
                    <p className="text-sm text-gray-400">
                      Progress: £{periodMetrics.grossSales.toFixed(2)} / £{periodTarget.toLocaleString()}
                    </p>
                    {periodMetrics.grossSales >= periodTarget ? (
                      <p className="text-sm text-green-400 mt-1">✓ Goal achieved!</p>
                    ) : (
                      <p className="text-sm text-gray-400 mt-1">
                        £{(periodTarget - periodMetrics.grossSales).toFixed(2)} to go
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="mt-6 p-4 bg-penkey-orange/10 rounded-xl border border-penkey-orange/30">
              <p className="text-center text-white font-semibold">
                {[periodMetrics.receiptCount >= 50, comparison.diff > 0, periodMetrics.grossSales >= periodTarget].filter(Boolean).length} of 3 Goals Achieved
              </p>
            </div>
            
            <Button
              onClick={closeModal}
              className="w-full mt-6 bg-penkey-orange hover:bg-penkey-orange/90 text-white min-h-[48px]"
            >
              Close
            </Button>
          </div>
        </div>
      )}

      {/* Sales by Items Modal */}
      {activeModal === 'sales-by-items' && (
        <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={closeModal}>
          <div className="bg-[#3d3d3d] rounded-t-3xl sm:rounded-xl p-6 w-full sm:max-w-md max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                <Package className="h-6 w-6 text-penkey-orange" />
                Sales by Items
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-white text-2xl min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                ✕
              </button>
            </div>
            
            {itemsLoading ? (
              <div className="flex items-center justify-center h-32">
                <RefreshCw className="h-6 w-6 text-penkey-orange animate-spin" />
              </div>
            ) : itemsData ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-[#2d2d2d] rounded-lg p-3">
                    <p className="text-xs text-gray-400">Total Items</p>
                    <p className="text-xl font-bold text-white">{itemsData.summary.total_items}</p>
                  </div>
                  <div className="bg-[#2d2d2d] rounded-lg p-3">
                    <p className="text-xs text-gray-400">Total Quantity</p>
                    <p className="text-xl font-bold text-white">{itemsData.summary.total_quantity_sold}</p>
                  </div>
                </div>
                
                {/* Upsell Metrics */}
                {itemsData.summary.upsell_rate > 0 && (
                  <div className="bg-gradient-to-r from-green-600/20 to-green-500/20 border border-green-500/30 rounded-lg p-4 mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="h-5 w-5 text-green-400" />
                      <h4 className="text-sm font-semibold text-white">Upsell Performance</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-gray-400">Upsell Rate</p>
                        <p className="text-lg font-bold text-green-400">{itemsData.summary.upsell_rate.toFixed(1)}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Modifier Revenue</p>
                        <p className="text-lg font-bold text-green-400">£{itemsData.summary.modifier_revenue.toFixed(2)}</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-300 mt-2">
                      {itemsData.summary.items_with_modifiers} items sold with add-ons
                    </p>
                  </div>
                )}
                
                {/* Toggle buttons */}
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => setShowWorstSelling(false)}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                      !showWorstSelling
                        ? "bg-penkey-orange text-white"
                        : "bg-[#2d2d2d] text-gray-400 hover:bg-[#3d3d3d]"
                    }`}
                  >
                    Top Selling
                  </button>
                  <button
                    onClick={() => setShowWorstSelling(true)}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                      showWorstSelling
                        ? "bg-penkey-orange text-white"
                        : "bg-[#2d2d2d] text-gray-400 hover:bg-[#3d3d3d]"
                    }`}
                  >
                    Worst Selling
                  </button>
                </div>
                
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {(showWorstSelling 
                    ? [...itemsData.items].reverse().slice(0, showAllItems ? itemsData.items.length : 10)
                    : itemsData.items.slice(0, showAllItems ? itemsData.items.length : 10)
                  ).map((item, index) => (
                    <div key={index} className="bg-[#2d2d2d] rounded-lg p-3 flex justify-between items-center">
                      <div>
                        <p className="text-white font-medium">{item.name}</p>
                        <p className="text-xs text-gray-400">{item.quantity_sold} sold</p>
                      </div>
                      <p className="text-penkey-orange font-bold">£{item.total_revenue.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
                
                {/* Show More/Less button */}
                {itemsData.items.length > 10 && (
                  <button
                    onClick={() => setShowAllItems(!showAllItems)}
                    className="w-full mt-3 py-2 px-4 bg-[#2d2d2d] text-gray-300 rounded-lg text-sm font-medium hover:bg-[#3d3d3d] transition-all flex items-center justify-center gap-2"
                  >
                    {showAllItems ? (
                      <>
                        <ChevronUp className="h-4 w-4" />
                        Show Less
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4" />
                        Show All ({itemsData.items.length} items)
                      </>
                    )}
                  </button>
                )}
              </div>
            ) : (
              <p className="text-gray-400">No data available</p>
            )}
            
            <Button
              onClick={closeModal}
              className="w-full mt-6 bg-penkey-orange hover:bg-penkey-orange/90 text-white min-h-[48px]"
            >
              Close
            </Button>
          </div>
        </div>
      )}

      {/* Sales by Transaction Type Modal */}
      {activeModal === 'sales-by-transaction-type' && (
        <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={closeModal}>
          <div className="bg-[#3d3d3d] rounded-t-3xl sm:rounded-xl p-6 w-full sm:max-w-md max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                <CreditCard className="h-6 w-6 text-penkey-orange" />
                Sales by Transaction Type
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-white text-2xl min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                ✕
              </button>
            </div>
            
            {transactionTypeLoading ? (
              <div className="flex items-center justify-center h-32">
                <RefreshCw className="h-6 w-6 text-penkey-orange animate-spin" />
              </div>
            ) : transactionTypeData ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-[#2d2d2d] rounded-lg p-3">
                    <p className="text-xs text-gray-400">Total Revenue</p>
                    <p className="text-xl font-bold text-white">£{transactionTypeData.summary.total_revenue.toFixed(2)}</p>
                  </div>
                  <div className="bg-[#2d2d2d] rounded-lg p-3">
                    <p className="text-xs text-gray-400">Transactions</p>
                    <p className="text-xl font-bold text-white">{transactionTypeData.summary.total_transactions}</p>
                  </div>
                </div>
                
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {transactionTypeData.transaction_types.map((type, index) => (
                    <div key={index} className="bg-[#2d2d2d] rounded-lg p-3 flex justify-between items-center">
                      <div>
                        <p className="text-white font-medium capitalize">{type.method}</p>
                        <p className="text-xs text-gray-400">{type.transaction_count} transactions</p>
                      </div>
                      <p className="text-penkey-orange font-bold">£{type.total_amount.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-gray-400">No data available</p>
            )}
            
            <Button
              onClick={closeModal}
              className="w-full mt-6 bg-penkey-orange hover:bg-penkey-orange/90 text-white min-h-[48px]"
            >
              Close
            </Button>
          </div>
        </div>
      )}

      {/* Sales by Employee Modal */}
      {activeModal === 'sales-by-employee' && (
        <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={closeModal}>
          <div className="bg-[#3d3d3d] rounded-t-3xl sm:rounded-xl p-6 w-full sm:max-w-md max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                <User className="h-6 w-6 text-penkey-orange" />
                Sales by Employee
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-white text-2xl min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                ✕
              </button>
            </div>
            
            {employeeLoading ? (
              <div className="flex items-center justify-center h-32">
                <RefreshCw className="h-6 w-6 text-penkey-orange animate-spin" />
              </div>
            ) : employeeData ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-[#2d2d2d] rounded-lg p-3">
                    <p className="text-xs text-gray-400">Total Employees</p>
                    <p className="text-xl font-bold text-white">{employeeData.summary.total_employees}</p>
                  </div>
                  <div className="bg-[#2d2d2d] rounded-lg p-3">
                    <p className="text-xs text-gray-400">Total Sales</p>
                    <p className="text-xl font-bold text-white">£{employeeData.summary.total_sales.toFixed(2)}</p>
                  </div>
                </div>
                
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {employeeData.employees.map((employee, index) => (
                    <div key={index} className="bg-[#2d2d2d] rounded-lg p-3 flex justify-between items-center">
                      <div>
                        <p className="text-white font-medium">{employee.employee_name}</p>
                        <p className="text-xs text-gray-400">{employee.transaction_count} transactions</p>
                      </div>
                      <p className="text-penkey-orange font-bold">£{employee.total_sales.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-gray-400">No data available</p>
            )}
            
            <Button
              onClick={closeModal}
              className="w-full mt-6 bg-penkey-orange hover:bg-penkey-orange/90 text-white min-h-[48px]"
            >
              Close
            </Button>
          </div>
        </div>
      )}

      {/* Hourly Sales Modal */}
      {activeModal === 'hourly-sales' && (
        <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={closeModal}>
          <div className="bg-[#3d3d3d] rounded-t-3xl sm:rounded-xl p-6 w-full sm:max-w-md max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                <ClockIcon className="h-6 w-6 text-penkey-orange" />
                Hourly Sales
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-white text-2xl min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                ✕
              </button>
            </div>
            
            {hourlyLoading ? (
              <div className="flex items-center justify-center h-32">
                <RefreshCw className="h-6 w-6 text-penkey-orange animate-spin" />
              </div>
            ) : hourlyData ? (
              <div className="space-y-4">
                <div className="bg-[#2d2d2d] rounded-lg p-4 mb-4">
                  <p className="text-xs text-gray-400 mb-1">Busiest Hour</p>
                  <p className="text-2xl font-bold text-white">{hourlyData.summary.busiest_hour !== null ? `${hourlyData.summary.busiest_hour}:00` : 'N/A'}</p>
                </div>
                
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {hourlyData.hourly_data.filter(h => h.transaction_count > 0).map((hour, index) => (
                    <div key={index} className="bg-[#2d2d2d] rounded-lg p-3 flex justify-between items-center">
                      <div>
                        <p className="text-white font-medium">{hour.hour}:00</p>
                        <p className="text-xs text-gray-400">{hour.transaction_count} transactions</p>
                      </div>
                      <p className="text-penkey-orange font-bold">£{hour.total_sales.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-gray-400">No data available</p>
            )}
            
            <Button
              onClick={closeModal}
              className="w-full mt-6 bg-penkey-orange hover:bg-penkey-orange/90 text-white min-h-[48px]"
            >
              Close
            </Button>
          </div>
        </div>
      )}

      {/* Custom Date Picker Modal */}
      {showCustomDate && (
        <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={() => setShowCustomDate(false)}>
          <div className="bg-[#3d3d3d] rounded-t-3xl sm:rounded-xl p-6 w-full sm:max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                <Calendar className="h-6 w-6 text-penkey-orange" />
                Custom Date Range
              </h3>
              <button
                onClick={() => setShowCustomDate(false)}
                className="text-gray-400 hover:text-white text-2xl min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Number of days</label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={customDays}
                  onChange={(e) => setCustomDays(parseInt(e.target.value) || 1)}
                  className="w-full bg-[#2d2d2d] text-white rounded-lg px-4 py-3 border border-gray-600 focus:border-penkey-orange focus:outline-none"
                />
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => setCustomDays(7)}
                  className="flex-1 py-2 px-3 bg-[#2d2d2d] text-gray-300 rounded-lg text-sm hover:bg-[#4d4d4d]"
                >
                  7 days
                </button>
                <button
                  onClick={() => setCustomDays(14)}
                  className="flex-1 py-2 px-3 bg-[#2d2d2d] text-gray-300 rounded-lg text-sm hover:bg-[#4d4d4d]"
                >
                  14 days
                </button>
                <button
                  onClick={() => setCustomDays(90)}
                  className="flex-1 py-2 px-3 bg-[#2d2d2d] text-gray-300 rounded-lg text-sm hover:bg-[#4d4d4d]"
                >
                  90 days
                </button>
              </div>
              
              <Button
                onClick={() => {
                  setShowCustomDate(false);
                  refetch();
                }}
                className="w-full bg-penkey-orange hover:bg-penkey-orange/90 text-white"
              >
                Apply
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
