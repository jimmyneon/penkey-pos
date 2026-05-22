"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button, Badge } from "@penkey/ui";
import { formatCurrency } from "@penkey/ui";
import { 
  Search, 
  Receipt, 
  CreditCard,
  Banknote,
  Clock,
  X,
  Eye,
  Printer,
  Mail,
  Loader2
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { getAllByIndexRange, putMany } from "@/lib/idb/db";
import { ConfirmDialog } from "@/components/confirm-dialog";

interface ReceiptData {
  id: string;
  receipt_number: string;
  created_at: string;
  dining_option: string;
  customer_name: string | null;
  table_number: string | null;
  subtotal: number;
  discount_total: number;
  tax_total: number;
  tip_total: number;
  total: number;
  paid_amount: number;
  change_amount: number;
  status: string;
  member: {
    first_name: string;
    last_name: string;
  };
  payments: Array<{
    id: string;
    method: string;
    amount: number;
    tip_amount: number;
  }>;
}

interface Session {
  employee: {
    id: string;
    name: string;
    role: string;
  };
  register: {
    id: string;
    name: string;
    store_name: string;
  };
  org_id: string;
}

export default function ReceiptsPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [receipts, setReceipts] = useState<ReceiptData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [activeQuickActionsId, setActiveQuickActionsId] = useState<string | null>(null);
  const [longPressTimer, setLongPressTimer] = useState<any>(null);
  const [suppressNextClick, setSuppressNextClick] = useState(false);
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [printingId, setPrintingId] = useState<string | null>(null);
  const fetchingRef = useRef(false);

  const handlePrint = async (receiptId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (printingId) return;
    setPrintingId(receiptId);
    try {
      const sessionData = sessionStorage.getItem("pos_session");
      const response = await fetch("/api/receipts/print", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(sessionData ? { "x-pos-session": sessionData } : {}) },
        body: JSON.stringify({ receipt_id: receiptId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to print");
      if (data.queued) {
        // success — printer will handle it
      } else if (data.receipt_text) {
        const win = window.open("", "_blank");
        if (win) {
          win.document.write(`<html><head><title>Receipt</title><style>body{font-family:monospace;font-size:12px;max-width:300px;margin:20px auto}pre{white-space:pre-wrap}</style></head><body><pre>${data.receipt_text}</pre><script>window.onload=function(){window.print()}<\/script></body></html>`);
          win.document.close();
        }
      }
    } catch (err: any) {
      alert(err.message || "Failed to print");
    } finally {
      setPrintingId(null);
    }
  };

  useEffect(() => {
    const sessionData = sessionStorage.getItem("pos_session");
    if (!sessionData) {
      router.replace("/lock"); // Use replace to avoid back button issues
      return;
    }

    try {
      const parsedSession = JSON.parse(sessionData);
      setSession(parsedSession);
      fetchReceipts(parsedSession.org_id);
    } catch (err) {
      console.error("Failed to parse session:", err);
      router.replace("/lock");
    }
  }, [router]);

  const fetchReceipts = async (orgId: string) => {
    // Prevent concurrent fetch calls
    if (fetchingRef.current) {
      console.log("[ReceiptsPage] Fetch already in progress, skipping");
      return;
    }
    
    try {
      fetchingRef.current = true;
      setLoading(true);
      let idbReceipts: ReceiptData[] = [];
      
      // IDB-first: last 7 days by created_at index, filtered by org
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sinceIso = sevenDaysAgo.toISOString();
      try {
        const recent = await getAllByIndexRange<ReceiptData>("receipts", "by_created_at", sinceIso as any);
        idbReceipts = recent.filter(r => (r as any).org_id === orgId) as any;
        console.log(`[ReceiptsPage] Loaded ${idbReceipts.length} receipts from IndexedDB`);

        // ✅ Cleanup stale orphan temp receipts (>5 min old). These are leftovers
        // from older builds where the outbox sync didn't include an id and so
        // never cleaned up the temp record after successful server sync.
        try {
          const { getDB } = await import("@/lib/idb/db");
          const db = await getDB();
          const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
          const stale = idbReceipts.filter((r: any) => {
            if (!r.id || typeof r.id !== "string" || !r.id.startsWith("temp_")) return false;
            const createdMs = new Date(r.created_at).getTime();
            return Number.isFinite(createdMs) && createdMs < fiveMinutesAgo;
          });
          if (stale.length > 0) {
            console.log(`[ReceiptsPage] Cleaning up ${stale.length} stale temp receipts`);
            await Promise.all(stale.map((r: any) => db.delete("receipts", r.id)));
            idbReceipts = idbReceipts.filter((r: any) => !stale.find((s: any) => s.id === r.id));
          }
        } catch (cleanupErr) {
          console.warn("[ReceiptsPage] Failed to clean stale temp receipts:", cleanupErr);
        }
      } catch (error) {
        console.error("[ReceiptsPage] Error loading from IndexedDB:", error);
      }

      // Always fetch from API to get latest data
      console.log(`[ReceiptsPage] Fetching receipts from API for org: ${orgId}`);
      let apiRecs: ReceiptData[] = [];
      try {
        const response = await fetch(`/api/receipts?org_id=${orgId}&limit=500`);
        if (response.ok) {
          const data = await response.json();
          apiRecs = data.receipts || [];
          console.log(`[ReceiptsPage] Fetched ${apiRecs.length} receipts from API`);
        } else {
          console.error(`[ReceiptsPage] API request failed with status: ${response.status}`);
        }
      } catch (error) {
        console.error("[ReceiptsPage] Error fetching from API:", error);
      }

      // Deduplicate: merge API data with IDB data, preferring API (fresher)
      const idMap = new Map<string, ReceiptData>();
      
      // Add IDB receipts first (fallback for offline)
      console.log(`[ReceiptsPage] Adding ${idbReceipts.length} IDB receipts to deduplication map`);
      idbReceipts.forEach(r => {
        if (r.id) {
          idMap.set(r.id, r);
        } else {
          console.warn("[ReceiptsPage] IDB receipt missing ID:", r);
        }
      });
      
      // Overwrite with API receipts (fresher data)
      console.log(`[ReceiptsPage] Adding ${apiRecs.length} API receipts to deduplication map`);
      apiRecs.forEach((r: ReceiptData) => {
        if (r.id) {
          idMap.set(r.id, r);
        } else {
          console.warn("[ReceiptsPage] API receipt missing ID:", r);
        }
      });
      
      // Convert back to array and sort by date
      const merged = Array.from(idMap.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      console.log(`[ReceiptsPage] After deduplication: ${merged.length} unique receipts (IDB: ${idbReceipts.length}, API: ${apiRecs.length})`);
      
      // Additional validation: Check for duplicates by receipt_number AND id
      const idCounts = new Map<string, number>();
      const numberCounts = new Map<string, number>();
      
      merged.forEach(r => {
        // Count by ID
        idCounts.set(r.id, (idCounts.get(r.id) || 0) + 1);
        // Count by receipt number
        if (r.receipt_number) {
          numberCounts.set(r.receipt_number, (numberCounts.get(r.receipt_number) || 0) + 1);
        }
      });
      
      // Log any duplicates found
      let hasDuplicates = false;
      idCounts.forEach((count, id) => {
        if (count > 1) {
          console.error(`[ReceiptsPage] DUPLICATE ID DETECTED: ${id} appears ${count} times`);
          hasDuplicates = true;
        }
      });
      
      numberCounts.forEach((count, num) => {
        if (count > 1) {
          console.warn(`[ReceiptsPage] Duplicate receipt number: ${num} appears ${count} times`);
        }
      });
      
      if (hasDuplicates) {
        // If we have duplicate IDs, something is seriously wrong - let's fix it
        const finalDeduped = Array.from(new Map(merged.map(r => [r.id, r])).values());
        console.log(`[ReceiptsPage] Fixed duplicates: ${merged.length} -> ${finalDeduped.length} receipts`);
        setReceipts(finalDeduped);
      } else {
        setReceipts(merged);
      }
      
      // Save API data to IndexedDB for offline use
      if (apiRecs.length > 0) {
        try {
          const withOrg = apiRecs.map((x: any) => ({ ...x, org_id: orgId }));
          await putMany("receipts", withOrg);
          console.log(`[ReceiptsPage] Saved ${withOrg.length} receipts to IndexedDB`);
        } catch (error) {
          console.error("[ReceiptsPage] Error saving to IndexedDB:", error);
        }
      }
    } catch (error) {
      console.error("Error fetching receipts:", error);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  };

  const { sortedDates, groupedReceipts, totalFilteredReceipts } = useMemo(() => {
    console.log("[ReceiptsPage] Memoizing and sorting receipts...");
    const filtered = receipts.filter((receipt) => {
      const searchLower = searchQuery.toLowerCase();
      if (!searchQuery) return true;
      return (
        receipt.receipt_number?.toLowerCase().includes(searchLower) ||
        receipt.customer_name?.toLowerCase().includes(searchLower) ||
        receipt.table_number?.toLowerCase().includes(searchLower) ||
        (receipt.member?.first_name &&
          receipt.member?.last_name &&
          `${receipt.member.first_name} ${receipt.member.last_name}`
            .toLowerCase()
            .includes(searchLower))
      );
    });

    // Sort all filtered receipts by date descending (most recent first)
    const sorted = filtered.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    const grouped = sorted.reduce((groups, receipt) => {
      const date = new Date(receipt.created_at);
      const dateKey = date.toDateString();
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(receipt);
      return groups;
    }, {} as Record<string, ReceiptData[]>);

    const dates = Object.keys(grouped).sort(
      (a, b) => new Date(b).getTime() - new Date(a).getTime()
    );

    return {
      sortedDates: dates,
      groupedReceipts: grouped,
      totalFilteredReceipts: sorted.length,
    };
  }, [receipts, searchQuery]);

  const formatDateHeader = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return { type: 'simple', text: 'Today' };
    } else if (date.toDateString() === yesterday.toDateString()) {
      return { type: 'simple', text: 'Yesterday' };
    } else {
      const weekday = date.toLocaleDateString('en-GB', { weekday: 'long' });
      const day = date.toLocaleDateString('en-GB', { day: 'numeric' });
      const month = date.toLocaleDateString('en-GB', { month: 'long' });
      const year = date.toLocaleDateString('en-GB', { year: 'numeric' });
      return { type: 'full', weekday, day, month, year };
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-500";
      case "partially_refunded":
        return "bg-yellow-500";
      case "fully_refunded":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getPrimaryPaymentMethod = (payments: Array<{ method: string }>) => {
    // Defensive check: If payments is null, undefined, or empty, default to 'card'.
    if (!payments || payments.length === 0) return "card";
    // If multiple payments, show the first one
    return payments[0].method;
  };

  const getPaymentIcon = (method: string) => {
    if (method === "cash") {
      return <Banknote className="h-6 w-6 text-penkey-orange" />;
    }
    return <CreditCard className="h-6 w-6 text-penkey-orange" />;
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-GB', { 
      hour: '2-digit', 
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#2d2d2d] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-penkey-orange mx-auto mb-4"></div>
          <p className="text-gray-400">Loading receipts...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="h-screen bg-[#2d2d2d] flex flex-col overflow-hidden">
      {/* Header with PageHeader component */}
      <PageHeader
        title="Receipts"
        showHome={true}
        showMenu={true}
        session={session}
        rightActions={
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (searchExpanded && searchQuery) {
                setSearchQuery("");
                setSearchExpanded(false);
              } else {
                setSearchExpanded(!searchExpanded);
              }
            }}
            className="text-white hover:bg-white/10"
          >
            {searchExpanded ? (
              <X className="h-5 w-5" />
            ) : (
              <Search className="h-5 w-5" />
            )}
          </Button>
        }
      />

      {/* Expandable Search Bar */}
      {searchExpanded && (
        <div className="bg-[#3d3d3d] px-3 sm:px-4 py-3 border-b border-gray-700 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by receipt #, customer, table, or employee..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#2d2d2d] text-white rounded-lg border border-gray-600 focus:border-penkey-orange focus:outline-none"
              autoFocus
            />
          </div>
        </div>
      )}

      {/* Receipts List */}
      <div className="flex-1 overflow-y-auto overscroll-behavior-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
        {totalFilteredReceipts === 0 ? (
          <div className="text-center py-12 px-4">
            <Receipt className="h-16 w-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">
              {searchQuery ? "No receipts found" : "No receipts yet"}
            </p>
            <p className="text-gray-500 text-sm mt-2">
              {searchQuery ? "Try a different search term" : "Receipts will appear here after sales"}
            </p>
          </div>
        ) : (
          <div>
            {sortedDates.map((dateKey) => (
              <div key={dateKey}>
                {/* Sticky Date Header */}
                <div className="sticky top-0 z-10 bg-[#2d2d2d] border-b border-gray-700 px-4 py-3">
                  <h2 className="text-white font-bold text-lg">
                    {(() => {
                      const dateHeader = formatDateHeader(dateKey);
                      if (dateHeader.type === 'simple') {
                        if (dateHeader.text === 'Today') {
                          return <>
                            To<span className="text-penkey-orange">d</span>ay
                          </>;
                        } else if (dateHeader.text === 'Yesterday') {
                          return <>
                            Yes<span className="text-penkey-orange">ter</span>day
                          </>;
                        }
                        return dateHeader.text;
                      } else {
                        return (
                          <>
                            {dateHeader.weekday}{' '}
                            <span className="text-penkey-orange">{dateHeader.day}</span>
                            {' '}
                            <span className="text-penkey-orange">{dateHeader.month}</span>
                            {' '}{dateHeader.year}
                          </>
                        );
                      }
                    })()}
                  </h2>
                </div>
                
                {/* Receipts for this day */}
                <div className="divide-y divide-gray-700">
                  {groupedReceipts[dateKey].map((receipt) => {
                    const paymentMethod = getPrimaryPaymentMethod(receipt.payments);
                    return (
                      <div
                        key={receipt.id}
                        className="bg-[#3d3d3d] hover:bg-[#4d4d4d] transition-colors cursor-pointer px-4 py-2 active:scale-[0.99] select-none"
                        onPointerDown={(e) => {
                          // Long press enters selection mode and selects this receipt (touch only)
                          if ((e as any).pointerType !== 'touch') return;
                          try { (e.currentTarget as any).setPointerCapture?.((e as any).pointerId); } catch {}
                          const t = setTimeout(() => {
                            setSelectionMode(true);
                            setSelectedIds((prev) => new Set(prev).add(receipt.id));
                            setSuppressNextClick(true);
                          }, 450);
                          setLongPressTimer(t);
                        }}
                        onPointerUp={() => {
                          if (longPressTimer) {
                            clearTimeout(longPressTimer);
                            setLongPressTimer(null);
                          }
                        }}
                        onPointerLeave={() => {
                          if (longPressTimer) {
                            clearTimeout(longPressTimer);
                            setLongPressTimer(null);
                          }
                        }}
                        onPointerCancel={() => {
                          if (longPressTimer) {
                            clearTimeout(longPressTimer);
                            setLongPressTimer(null);
                          }
                        }}
                        onContextMenu={(e) => e.preventDefault()}
                        onClick={() => {
                          if (suppressNextClick) {
                            // This click came right after a long-press; swallow it
                            setSuppressNextClick(false);
                            return;
                          }
                          if (selectionMode) {
                            const next = new Set(selectedIds);
                            if (next.has(receipt.id)) next.delete(receipt.id); else next.add(receipt.id);
                            setSelectedIds(next);
                            if (next.size === 0) setSelectionMode(false);
                          } else {
                            router.push(`/receipts/${receipt.id}`);
                          }
                        }}
                      >
                        <div className="flex items-center gap-4">
                          {/* Checkbox when selection mode */}
                          {selectionMode && (
                            <div
                              className={`w-6 h-6 rounded border-2 flex items-center justify-center flex-shrink-0 ${selectedIds.has(receipt.id) ? "bg-penkey-orange border-penkey-orange" : "border-gray-500"}`}
                            >
                              {selectedIds.has(receipt.id) && (
                                <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                              )}
                            </div>
                          )}
                          {/* Payment Icon */}
                          <div className="flex-shrink-0">
                            {getPaymentIcon(paymentMethod)}
                          </div>
                          
                          {/* Receipt Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2">
                              <span className="text-white font-semibold text-lg">
                                {formatCurrency(receipt.total)}
                              </span>
                              {receipt.status !== "completed" && (
                                <div className={`w-2 h-2 rounded-full ${getStatusColor(receipt.status)}`} />
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-400 mt-1">
                              <Clock className="h-3 w-3" />
                              <span>{formatTime(receipt.created_at)}</span>
                            </div>
                          </div>

                          {/* Receipt Number + Print - Right Side */}
                          <div className="flex-shrink-0 flex flex-col items-end gap-1">
                            <span className="text-xs text-gray-500">{receipt.receipt_number}</span>
                            {!selectionMode && (
                              <button
                                onClick={(e) => handlePrint(receipt.id, e)}
                                disabled={!!printingId}
                                className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-white/10 active:scale-95 disabled:opacity-50"
                                title="Print receipt"
                              >
                                {printingId === receipt.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Printer className="h-3.5 w-3.5" />
                                )}
                                <span>{printingId === receipt.id ? "Sending..." : "Print"}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Void confirmation dialog */}
      <ConfirmDialog
        open={!!voidingId}
        onClose={() => setVoidingId(null)}
        onConfirm={async () => {
          try {
            const idsToVoid = selectionMode && selectedIds.size > 0
              ? Array.from(selectedIds)
              : (voidingId ? [voidingId] : []);
            if (idsToVoid.length === 0) return;
            const sessionData = sessionStorage.getItem('pos_session');
            if (!sessionData) throw new Error('Session expired');
            for (const id of idsToVoid) {
              const detailResp = await fetch(`/api/receipts/${id}`);
              if (!detailResp.ok) continue;
              const { receipt } = await detailResp.json();
              const remaining = (receipt.total || 0) - (receipt.refunded_amount || 0);
              if (remaining <= 0) continue;
              const csrfToken = (() => {
                const m = document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith('csrf_token='));
                return m ? m.substring('csrf_token='.length) : '';
              })();
              await fetch(`/api/receipts/${id}/refund`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                  'Content-Type': 'application/json',
                  'x-pos-session': sessionData,
                  ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
                },
                body: JSON.stringify({ amount: remaining, reason: 'Void receipt', memberId: JSON.parse(sessionData).user_id, orgId: JSON.parse(sessionData).org_id }),
              });
            }
            if (session) fetchReceipts(session.org_id);
          } catch (e) {
            console.error(e);
            alert('Failed to void receipt');
          } finally {
            setVoidingId(null);
            setActiveQuickActionsId(null);
            setSelectionMode(false);
            setSelectedIds(new Set());
          }
        }}
        title="Void receipt?"
        message="This will fully refund the receipt and cannot be undone. Proceed?"
        confirmText="Void"
        cancelText="Cancel"
        variant="danger"
      />

      {/* Bulk actions bar */}
      {selectionMode && selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-[#3d3d3d] border-t border-gray-700 p-3 flex items-center gap-2 z-40">
          <span className="text-sm text-white mr-auto">{selectedIds.size} selected</span>
          <Button
            size="sm"
            className="bg-purple-600 hover:bg-purple-700 text-white"
            onClick={async () => {
              const sessionData = sessionStorage.getItem("pos_session");
              for (const id of Array.from(selectedIds)) {
                try {
                  const resp = await fetch("/api/receipts/print", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", ...(sessionData ? { "x-pos-session": sessionData } : {}) },
                    body: JSON.stringify({ receipt_id: id }),
                  });
                  const data = await resp.json();
                  if (data.receipt_text && !data.queued) {
                    const win = window.open("", "_blank");
                    if (win) {
                      win.document.write(`<html><head><title>Receipt</title><style>body{font-family:monospace;font-size:12px;max-width:300px;margin:20px auto}pre{white-space:pre-wrap}</style></head><body><pre>${data.receipt_text}</pre><script>window.onload=function(){window.print()}<\/script></body></html>`);
                      win.document.close();
                    }
                  }
                } catch {}
              }
            }}
          >
            Print
          </Button>
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white"
            onClick={async () => {
              const email = window.prompt('Send selected receipt(s) to email:');
              if (!email) return;
              const sessionData = sessionStorage.getItem('pos_session');
              if (!sessionData) return alert('Session expired.');
              for (const id of Array.from(selectedIds)) {
                try {
                  await fetch(`/api/receipts/${id}/email`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'x-pos-session': sessionData,
                    },
                    body: JSON.stringify({ email }),
                  });
                } catch (e) {
                  console.error(e);
                }
              }
            }}
          >
            Email
          </Button>
          <Button
            size="sm"
            className="bg-red-600 hover:bg-red-700 text-white"
            onClick={() => {
              // Confirm and void all selected receipts (full remaining)
              const first = Array.from(selectedIds)[0];
              setVoidingId(first); // Reuse dialog but we'll handle all inside confirm
            }}
          >
            Void
          </Button>
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => {
              const ids = Array.from(selectedIds);
              if (ids.length !== 1) {
                alert('Select exactly one receipt to Refund.');
                return;
              }
              router.push(`/receipts/${ids[0]}?action=refund`);
            }}
          >
            Refund
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-white hover:bg-white/10"
            onClick={() => {
              setSelectionMode(false);
              setSelectedIds(new Set());
            }}
          >
            Done
          </Button>
        </div>
      )}
    </div>
  );
}
