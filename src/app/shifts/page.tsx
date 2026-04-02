"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@penkey/ui";
import { Clock } from "lucide-react";
import { useToast } from "@/lib/hooks/use-toast";
import { ToastContainer } from "@/components/toast-container";
import { PageHeader } from "@/components/page-header";
import { ShiftHeader } from "@/components/shifts/shift-header";
import { ShiftActions } from "@/components/shifts/shift-actions";
import { CashMovementsList } from "@/components/shifts/cash-movements-list";
import { CashReconciliation } from "@/components/shifts/cash-reconciliation";
import { ShiftSalesSummary } from "@/components/shifts/shift-sales-summary";
import { ShiftPaymentBreakdown } from "@/components/shifts/shift-payment-breakdown";
import { ShiftHourlyBreakdown } from "@/components/shifts/shift-hourly-breakdown";

interface ShiftData {
  id: string;
  status: "open" | "closed";
  opened_at: string;
  closed_at: string | null;
  opening_cash: number;
  closing_cash: number | null;
  expected_cash: number | null;
  variance: number | null;
  float_amount: number;
  notes: string | null;
}

export default function ShiftsPage() {
  // Using useSearchParams forces this page to be dynamic (not static)
  const searchParams = useSearchParams();
  const { toasts, showToast, dismissToast } = useToast();
  const [currentShift, setCurrentShift] = useState<ShiftData | null>(null);
  const [previousShift, setPreviousShift] = useState<ShiftData | null>(null);
  const [closedShifts, setClosedShifts] = useState<ShiftData[]>([]);
  const [showClosedShifts, setShowClosedShifts] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [registerId, setRegisterId] = useState<string | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    setMounted(true);
    loadShiftData();
  }, []);

  const loadShiftData = async () => {
    // Don't run on server-side
    if (typeof window === 'undefined') {
      console.log("[Shifts] Skipping loadShiftData - running on server");
      return;
    }
    
    try {
      const sessionData = sessionStorage.getItem("pos_session") || localStorage.getItem("pos_session");
      if (!sessionData) {
        console.log("[Shifts] No session found");
        setLoading(false);
        // Don't redirect, just show a message
        return;
      }

      const parsedSession = JSON.parse(sessionData);
      const regId = parsedSession.register?.id;
      const memId = parsedSession.employee?.id;

      if (!regId || !memId) {
        console.log("[Shifts] Missing register or employee info");
        setLoading(false);
        // Don't redirect, just show a message
        return;
      }

      console.log("Setting session:", parsedSession);
      setSession(parsedSession);
      setRegisterId(regId);
      setMemberId(memId);

      // Fetch current shift
      const response = await fetch(`/api/shifts/current?registerId=${regId}`);
      if (response.ok) {
        const data = await response.json();
        // Ensure float_amount has a default value
        if (data && !data.float_amount) {
          data.float_amount = 0;
        }
        setCurrentShift(data);
      } else {
        console.error("Failed to fetch current shift:", response.status);
      }

      // Fetch previous shift (for opening cash suggestion)
      console.log("Fetching previous shift for register:", regId);
      const prevResponse = await fetch(`/api/shifts/previous?registerId=${regId}`);
      console.log("Previous shift response status:", prevResponse.status);
      if (prevResponse.ok) {
        const prevData = await prevResponse.json();
        console.log("Previous shift data:", prevData);
        // Ensure float_amount has a default value
        if (prevData && !prevData.float_amount) {
          prevData.float_amount = 0;
        }
        setPreviousShift(prevData);
      } else {
        console.log("Previous shift fetch failed:", prevResponse.status);
        const errorData = await prevResponse.json();
        console.log("Error:", errorData);
      }
    } catch (error) {
      console.error("Failed to load shift data:", error);
      showToast("Failed to load shift data", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenShift = async (openingCash: number, floatAmount: number) => {
    if (!registerId || !memberId) return;

    try {
      const response = await fetch("/api/shifts/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registerId,
          memberId,
          openingCash,
          floatAmount,
        }),
      });

      if (!response.ok) throw new Error("Failed to open shift");

      const data = await response.json();
      setCurrentShift(data);
      showToast("Shift opened successfully", "success");
    } catch (error) {
      console.error("Failed to open shift:", error);
      showToast("Failed to open shift", "error");
    }
  };

  const handleCloseShift = async (closingCash: number, notes: string, nextFloatAmount: number, cashRemoved: boolean = true) => {
    if (!currentShift) return;

    try {
      const response = await fetch("/api/shifts/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shiftId: currentShift.id,
          closingCash,
          notes,
          nextFloatAmount,
          cashRemoved, // Track if cash was removed to safe
        }),
      });

      if (!response.ok) throw new Error("Failed to close shift");

      const data = await response.json();
      setCurrentShift(null); // Clear current shift
      setPreviousShift(data); // Set as previous
      showToast("Shift closed successfully", "success");
      
      // Reload to show no active shift
      loadShiftData();
    } catch (error) {
      console.error("Failed to close shift:", error);
      showToast("Failed to close shift", "error");
    }
  };

  const loadClosedShifts = async () => {
    if (!registerId) return;
    
    try {
      const response = await fetch(`/api/shifts/history?registerId=${registerId}&limit=10`);
      if (response.ok) {
        const data = await response.json();
        setClosedShifts(data);
      }
    } catch (error) {
      console.error("Failed to load closed shifts:", error);
    }
  };

  // Don't render until mounted (prevents SSR issues)
  if (!mounted) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#2d2d2d] text-white flex flex-col">
      <PageHeader 
        title="Shift Management" 
        showBack={false}
        showHome
        showMenu
        session={session}
      />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Content - Scrollable */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-6" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="max-w-2xl mx-auto space-y-4">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin">
                <Clock className="h-8 w-8 text-penkey-orange" />
              </div>
              <p className="mt-4 text-gray-400">Loading shift data...</p>
            </div>
          ) : !session ? (
            <div className="bg-[#3d3d3d] rounded-lg p-6 sm:p-8 text-center border border-gray-700">
              <Clock className="h-12 w-12 mx-auto mb-4 text-gray-500" />
              <h2 className="text-lg sm:text-xl font-semibold mb-2">Session Required</h2>
              <p className="text-gray-400 mb-6">Please log in to access shift management</p>
              <Button
                onClick={() => window.location.href = "/lock"}
                className="bg-penkey-orange hover:bg-penkey-orange/90 text-white px-6 py-3"
              >
                Go to Login
              </Button>
            </div>
          ) : currentShift?.status === "open" ? (
            <>
              <ShiftHeader shift={currentShift} />
              {/* Phase 2 components disabled - database schema issues */}
              {/* <ShiftSalesSummary shiftId={currentShift.id} /> */}
              {/* <ShiftPaymentBreakdown shiftId={currentShift.id} /> */}
              {/* <ShiftHourlyBreakdown shiftId={currentShift.id} /> */}
              <CashReconciliation 
                shiftId={currentShift.id} 
                openingCash={currentShift.opening_cash}
                floatAmount={currentShift.float_amount}
              />
              <ShiftActions 
                shiftId={currentShift.id} 
                currentShift={currentShift} 
                onCloseShift={handleCloseShift}
                onMovementAdded={() => {
                  window.dispatchEvent(new CustomEvent('reloadCashMovements', { detail: { shiftId: currentShift.id } }));
                }}
              />
              <CashMovementsList shiftId={currentShift.id} />
            </>
          ) : (
            <>
              <div className="bg-[#3d3d3d] rounded-lg p-6 sm:p-8 text-center border border-gray-700">
                <Clock className="h-12 w-12 mx-auto mb-4 text-gray-500" />
                <h2 className="text-lg sm:text-xl font-semibold mb-2">No Active Shift</h2>
                <p className="text-gray-400 mb-6">Open a shift to start selling</p>
                <ShiftActions 
                  onOpenShift={handleOpenShift} 
                  previousShift={previousShift}
                />
              </div>
              
              {/* Previous Shift Reconciliation */}
              {previousShift && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Last Closed Shift</h3>
                    <Button
                      onClick={() => {
                        loadClosedShifts();
                        setShowClosedShifts(!showClosedShifts);
                      }}
                      className="bg-gray-600 hover:bg-gray-700 text-white text-sm px-4 py-2"
                    >
                      {showClosedShifts ? "Hide History" : "View History"}
                    </Button>
                  </div>
                  <CashReconciliation 
                    shiftId={previousShift.id}
                    openingCash={previousShift.opening_cash}
                    floatAmount={previousShift.float_amount}
                    closingCash={previousShift.closing_cash || 0}
                    isOpen={false}
                    closedAt={previousShift.closed_at || undefined}
                  />
                </div>
              )}
              
              {/* Closed Shifts History */}
              {showClosedShifts && closedShifts.length > 0 && (
                <div className="mt-6 space-y-4">
                  <h3 className="text-lg font-semibold">Shift History</h3>
                  {closedShifts.map((shift) => (
                    <div key={shift.id} className="bg-[#3d3d3d] rounded-lg p-4 border border-gray-700">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-sm font-semibold">
                            {new Date(shift.opened_at).toLocaleDateString('en-GB', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </p>
                          <p className="text-xs text-gray-400">
                            {new Date(shift.opened_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                            {' - '}
                            {shift.closed_at && new Date(shift.closed_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-penkey-orange">£{shift.closing_cash?.toFixed(2)}</p>
                          <p className="text-xs text-gray-400">
                            Variance: {shift.variance && shift.variance > 0 ? '+' : ''}£{shift.variance?.toFixed(2)}
                          </p>
                        </div>
                      </div>
                      <CashReconciliation 
                        shiftId={shift.id}
                        openingCash={shift.opening_cash}
                        floatAmount={shift.float_amount}
                        closingCash={shift.closing_cash || 0}
                        isOpen={false}
                        closedAt={shift.closed_at || undefined}
                      />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
