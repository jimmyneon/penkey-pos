"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { Button, Badge } from "@penkey/ui";
import { formatCurrency } from "@penkey/ui";
import { 
  ArrowLeft, 
  Printer, 
  Mail,
  Phone,
  RotateCcw,
  Receipt, 
  Calendar,
  User,
  CreditCard,
  Hash,
  Clock,
  Store,
  Monitor,
  ShoppingBag,
  Eye,
  ChevronDown,
  Info,
  CheckCircle,
  AlertCircle,
  XCircle,
  QrCode
} from "lucide-react";
import { RefundDialog } from "./refund-dialog";
import { EmailDialog } from "./email-dialog";
import { QRScanner } from "@/components/QRScanner";
import { PerksCustomerPanel } from "@/components/PerksCustomerPanel";
import { BottomSheet } from "@/components/bottom-sheet";
import { scanQRCode, recordVisit, redeemVoucher, BeanRules } from "@/lib/services/perks";
import { useToast } from "@/lib/hooks/use-toast";
import { ToastContainer } from "@/components/toast-container";
import { ConfirmDialog } from "@/components/confirm-dialog";

interface ReceiptLine {
  id: string;
  item_id?: string;
  variant_id?: string | null;
  name: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  tax_rate: number;
  tax_amount: number;
  line_total: number;
  modifiers: any;
  notes: string | null;
}

interface ReceiptDetail {
  id: string;
  receipt_number: string;
  created_at: string;
  dining_option: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_count: number | null;
  table_number: string | null;
  subtotal: number;
  discount_total: number;
  tax_total: number;
  tip_total: number;
  total: number;
  paid_amount: number;
  change_amount: number;
  refunded_amount: number;
  status: string;
  member: {
    first_name: string;
    last_name: string;
  };
  store: {
    name: string;
    address: string | null;
    phone: string | null;
  };
  register: {
    name: string;
  };
  payments: Array<{
    id: string;
    method: string;
    amount: number;
    tip_amount: number;
    reference: string | null;
    metadata: {
      payment_provider?: string;
      transaction_id?: string;
      checkout_id?: string;
    } | null;
  }>;
  lines: ReceiptLine[];
}

export default function TransactionDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { toasts, showToast, dismissToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [receipt, setReceipt] = useState<ReceiptDetail | null>(null);
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [showItemsSheet, setShowItemsSheet] = useState(false);
  const [showTransactionSheet, setShowTransactionSheet] = useState(false);
  const [showPaymentsSheet, setShowPaymentsSheet] = useState(false);
  const [voidConfirmOpen, setVoidConfirmOpen] = useState(false);
  // Guards against double-fire of the refund handler while a request is in flight
  const refundingRef = useRef(false);
  const [qrScannerOpen, setQrScannerOpen] = useState(false);
  const [perksCustomer, setPerksCustomer] = useState<any>(null);
  const [perksBeanRules, setPerksBeanRules] = useState<any>(null);
  const [scanningQR, setScanningQR] = useState(false);

  const [orgId, setOrgId] = useState<string | null>(null);

  useEffect(() => {
    const sessionData = sessionStorage.getItem("pos_session");
    if (!sessionData) {
      router.push("/lock");
      return;
    }

    if (params.id) {
      fetchReceiptDetail(params.id as string);
    }
    try {
      const parsed = JSON.parse(sessionData);
      setOrgId(parsed.org_id);
    } catch {}
  }, [params.id, router]);

  // Load Perks bean rules
  useEffect(() => {
    const loadPerksBeanRules = async () => {
      try {
        const response = await fetch("/api/settings/perks");
        if (response.ok) {
          const data = await response.json();
          setPerksBeanRules(data.beanRules);
        }
      } catch (error) {
        console.error("Failed to load Perks bean rules:", error);
      }
    };
    loadPerksBeanRules();
  }, []);

  // Check if receipt is within 24 hours
  const isWithin24Hours = () => {
    if (!receipt?.created_at) return false;
    const receiptDate = new Date(receipt.created_at);
    const now = new Date();
    const hoursDiff = (now.getTime() - receiptDate.getTime()) / (1000 * 60 * 60);
    return hoursDiff <= 24;
  };

  const handleQRScan = async (qrData: string) => {
    if (!orgId) {
      showToast("No session data", "error");
      return;
    }
    
    setScanningQR(true);
    
    try {
      const apiResponse = await scanQRCode(orgId, qrData);
      
      if (!apiResponse) {
        throw new Error("No customer data returned from API");
      }
      
      const customer = {
        id: apiResponse.customer?.id || '',
        name: apiResponse.customer?.name || '',
        email: apiResponse.customer?.email || '',
        phone: apiResponse.customer?.phone || '',
        beanBalance: apiResponse.bean_balance?.current_beans || 0,
        activeVouchers: apiResponse.vouchers || [],
        canAwardBeanToday: apiResponse.can_award_bean || false,
      };
      
      setPerksCustomer(customer);
      setQrScannerOpen(false);
      
      // Update receipt with customer data
      await updateReceiptCustomer(customer);
      
      showToast(`Customer ${customer.name} linked to receipt`, 'success');
    } catch (error: any) {
      console.error("[Receipt QR Scan] Error:", error);
      showToast(error.message || "Failed to scan QR code", 'error');
    } finally {
      setScanningQR(false);
    }
  };

  const updateReceiptCustomer = async (customer: any) => {
    if (!receipt || !orgId) return;
    
    try {
      const response = await fetch(`/api/receipts/${receipt.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customer.id,
          customer_name: customer.name,
          customer_email: customer.email,
          customer_phone: customer.phone,
        }),
      });
      
      if (response.ok) {
        // Update local receipt state
        setReceipt({
          ...receipt,
          customer_name: customer.name,
        });
      }
    } catch (error) {
      console.error("Failed to update receipt customer:", error);
    }
  };

  const handleAwardBean = async (rules: BeanRules) => {
    if (!orgId || !perksCustomer) return { beansAwarded: 0, newBalance: perksCustomer?.beanBalance || 0 };

    try {
      const result = await recordVisit(orgId, {
        userId: perksCustomer.id,
        beanRules: rules,
        menuItems: receipt?.lines?.map((line: any) => ({ name: line.name, price: line.unit_price })) || [],
        staffId: receipt?.member?.first_name || '',
        locationId: receipt?.store?.name || '',
      });

      if (result) {
        showToast(`Awarded ${result.beansAwarded} bean(s)! New balance: ${result.newBalance}`, "success");
        setPerksCustomer({
          ...perksCustomer,
          beanBalance: result.newBalance,
          canAwardBeanToday: false,
        });
        return result;
      }
      return { beansAwarded: 0, newBalance: perksCustomer?.beanBalance || 0 };
    } catch (error: any) {
      console.error("Award bean error:", error);
      showToast(error.message || "Failed to award beans", "error");
      return { beansAwarded: 0, newBalance: perksCustomer?.beanBalance || 0 };
    }
  };

  const handleRedeemVoucher = async (voucherId: string) => {
    if (!orgId) return;

    try {
      const result = await redeemVoucher(orgId, {
        voucher_id: voucherId,
        staff_id: receipt?.member?.first_name || '',
      });

      if (result) {
        showToast("Voucher redeemed successfully!", "success");
        setPerksCustomer({
          ...perksCustomer,
          activeVouchers: perksCustomer.activeVouchers.filter((v: any) => v.id !== voucherId),
        });
      }
    } catch (error: any) {
      console.error("Redeem voucher error:", error);
      showToast(error.message || "Failed to redeem voucher", "error");
    }
  };

  // Auto-open refund dialog if requested
  useEffect(() => {
    const action = searchParams?.get("action");
    if (action === "refund") {
      setRefundDialogOpen(true);
    }
  }, [searchParams]);

  const fetchReceiptDetail = async (receiptId: string) => {
    try {
      setLoading(true);
      
      // Check IndexedDB first (for temp receipts and offline access)
      let localReceipt: any = null;
      try {
        const { getDB } = await import("@/lib/idb/db");
        const db = await getDB();
        localReceipt = await db.get("receipts", receiptId);
        
        if (localReceipt) {
          console.log("[ReceiptDetail] Found receipt in IndexedDB:", receiptId);
          
          // Try to fetch receipt lines from IndexedDB (may not exist)
          let lines: any[] = [];
          try {
            const tx = db.transaction('receipt_lines', 'readonly');
            const linesStore = tx.objectStore('receipt_lines');
            const linesIndex = linesStore.index('by_receipt');
            lines = await linesIndex.getAll(receiptId);
          } catch {
            // receipt_lines store may not exist - use embedded lines from receipt data
            lines = (localReceipt as any).lines || [];
          }
          
          // Combine receipt with lines
          const receiptWithLines = {
            ...localReceipt,
            lines: lines.length > 0 ? lines : ((localReceipt as any).lines || [])
          };
          
          console.log("[ReceiptDetail] Loaded receipt with", (receiptWithLines as any).lines?.length || 0, "lines from IndexedDB");
          
          // For temp receipts, don't bother falling through to API - it won't find them
          if (receiptId.startsWith('temp_')) {
            setReceipt(receiptWithLines as any);
            setLoading(false);
            return;
          }
          
          // For real receipts, still try API for freshest data
          setReceipt(receiptWithLines as any);
        }
      } catch (idbError) {
        console.warn("[ReceiptDetail] IndexedDB lookup failed:", idbError);
        // Continue to API fetch
      }
      
      // If not in IndexedDB, fetch from API
      const response = await fetch(`/api/receipts/${receiptId}`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch receipt");
      }

      const data = await response.json();
      setReceipt(data.receipt);
      
      // Save to IndexedDB for future offline access
      try {
        const { getDB } = await import("@/lib/idb/db");
        const db = await getDB();
        await db.put("receipts", data.receipt);
      } catch (idbError) {
        console.warn("[ReceiptDetail] Failed to save to IndexedDB:", idbError);
      }
    } catch (error) {
      console.error("Error fetching receipt:", error);
      showToast("Failed to load transaction details", "error");
    } finally {
      setLoading(false);
    }
  };

  const [printing, setPrinting] = useState(false);

  const handlePrint = async () => {
    if (printing) return;
    setPrinting(true);
    try {
      const sessionData = sessionStorage.getItem("pos_session");
      if (!sessionData) {
        showToast("Session expired. Please log in again.", "error");
        return;
      }

      const response = await fetch("/api/receipts/print", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-pos-session": sessionData,
        },
        body: JSON.stringify({ receipt_id: params.id }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to print");

      if (data.queued) {
        showToast(data.message || "Receipt sent to printer", "success");
      } else if (data.receipt_text) {
        // Fallback: no printer configured — open browser print dialog
        router.push(`/receipts/${params.id}/template?print=1`);
      }
    } catch (e: any) {
      console.error(e);
      showToast(e.message || "Failed to print receipt", "error");
    } finally {
      setPrinting(false);
    }
  };

  const handleEmail = async (email: string) => {
    try {
      const sessionData = sessionStorage.getItem("pos_session");
      if (!sessionData) {
        showToast("Session expired. Please log in again.", "error");
        return;
      }
      const resp = await fetch(`/api/receipts/${params.id}/email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-pos-session": sessionData,
        },
        body: JSON.stringify({ email }),
      });
      if (!resp.ok) {
        const data = await resp.json();
        throw new Error(data.error || "Failed to send email");
      }
      showToast(`Receipt sent to ${email}`, "success");
    } catch (e: any) {
      console.error(e);
      showToast(e.message || "Failed to send email", "error");
    }
  };

  const handleRefund = async (amount: number, reason: string, selectedItems?: string[]) => {
    if (!receipt) return;
    // Guard: prevent double-fire from rapid re-clicks while request is in flight
    if (refundingRef.current) {
      console.warn("[Refund] Refund already in flight, ignoring duplicate trigger");
      return;
    }
    refundingRef.current = true;

    try {
      const sessionData = sessionStorage.getItem("pos_session");
      if (!sessionData) {
        showToast("Session expired. Please log in again.", "error");
        return;
      }

      const session = JSON.parse(sessionData);

      // Read CSRF token from cookie so server-side validateCSRF passes
      const csrfToken = (() => {
        const m = document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith('csrf_token='));
        return m ? m.substring('csrf_token='.length) : '';
      })();

      const response = await fetch(`/api/receipts/${params.id}/refund`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
        },
        body: JSON.stringify({
          amount,
          reason,
          selectedItems,
          memberId: session.employee.id,
          orgId: session.org_id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to process refund");
      }

      const refundType = selectedItems ? "partial" : "full";
      const sumupConfirmed = data.sumup_confirmed;
      const sumupVerified = data.sumup_verified;
      let message = `${refundType} refund of ${formatCurrency(amount)} processed`;
      if (sumupConfirmed) {
        if (sumupVerified) {
          message += " and verified via SumUp";
        } else {
          message += " via SumUp";
        }
      }
      showToast(message, "success");
      
      // Refresh receipt data
      fetchReceiptDetail(params.id as string);
    } catch (error) {
      console.error("Error processing refund:", error);
      showToast(error instanceof Error ? error.message : "Failed to process refund", "error");
    } finally {
      refundingRef.current = false;
    }
  };

  const handleViewReceipt = () => {
    router.push(`/receipts/${params.id}/template`);
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-6 w-6 text-green-500" />;
      case "partially_refunded":
        return <AlertCircle className="h-6 w-6 text-yellow-500" />;
      case "fully_refunded":
        return <XCircle className="h-6 w-6 text-red-500" />;
      default:
        return <CheckCircle className="h-6 w-6 text-green-500" />;
    }
  };

  const canRefund = receipt && receipt.status !== "fully_refunded" && (receipt.total - receipt.refunded_amount) > 0;
  const refundableAmount = receipt ? receipt.total - receipt.refunded_amount : 0;

  // Guardrail: Check if card payment has transaction_id in metadata
  const primaryPayment = receipt?.payments?.[0];
  const hasTransactionId = primaryPayment?.method === 'card' 
    ? primaryPayment?.metadata?.transaction_id 
    : true; // Allow refund for non-card payments
  const refundDisabled = !canRefund || !hasTransactionId;

  

  const handleVoid = async () => {
    if (!receipt) return;
    await handleRefund(refundableAmount, "Void receipt", undefined);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#2d2d2d] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-penkey-orange mx-auto mb-4"></div>
          <p className="text-gray-400">Loading transaction...</p>
        </div>
      </div>
    );
  }

  if (!receipt) {
    return (
      <div className="min-h-screen bg-[#2d2d2d] flex items-center justify-center">
        <div className="text-center">
          <Receipt className="h-16 w-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">Transaction not found</p>
          <Button
            onClick={() => router.push("/receipts")}
            className="mt-4 bg-penkey-orange hover:bg-penkey-orange/90"
          >
            Back to Receipts
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#2d2d2d] flex flex-col">
      {/* Header */}
      <header className="bg-[#3d3d3d] text-white px-3 sm:px-4 py-3 flex items-center justify-between border-b border-gray-700">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <Button
            size="sm"
            variant="ghost"
            className="text-white hover:bg-white/10 flex-shrink-0"
            onClick={() => router.push("/receipts")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="font-semibold text-base sm:text-lg truncate">Transaction Details</h1>
            <p className="text-xs sm:text-sm text-gray-400 truncate">{receipt.receipt_number}</p>
          </div>
        </div>
        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${getStatusColor(receipt.status)}`} />
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-32">
        <div className="p-3 sm:p-4 max-w-4xl mx-auto space-y-3">
          {/* Total Amount - Large and Prominent */}
          <div className="bg-[#3d3d3d] rounded-lg p-6 border border-gray-700 text-center">
            <div className="flex items-center justify-center gap-3 mb-2">
              <h2 className="text-4xl sm:text-5xl font-bold text-white">
                {formatCurrency(receipt.total)}
              </h2>
              {getStatusIcon(receipt.status)}
            </div>
            <p className="text-gray-400 text-sm">
              {new Date(receipt.created_at).toLocaleString('en-GB', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2">
            {!hasTransactionId && primaryPayment?.method === 'card' && (
              <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-3">
                <p className="text-yellow-400 text-sm">
                  <strong>Warning:</strong> Cannot refund this card payment because transaction information is missing. Please ensure the receipt has been synced to the server.
                </p>
              </div>
            )}
          <div className="grid grid-cols-4 gap-2">
            <Button
              onClick={handleViewReceipt}
              className="bg-blue-600 hover:bg-blue-700 text-white border-0 text-xs sm:text-sm h-12 active:scale-95"
            >
              <Eye className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">View</span>
            </Button>
            <Button
              onClick={handlePrint}
              className="bg-purple-600 hover:bg-purple-700 text-white border-0 text-xs sm:text-sm h-12 active:scale-95"
            >
              <Printer className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Print</span>
            </Button>
            <Button
              onClick={() => setEmailDialogOpen(true)}
              className="bg-green-600 hover:bg-green-700 text-white border-0 text-xs sm:text-sm h-12 active:scale-95"
            >
              <Mail className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Email</span>
            </Button>
            <Button
              onClick={() => setVoidConfirmOpen(true)}
              disabled={refundDisabled}
              className="bg-red-600 hover:bg-red-700 text-white border-0 text-xs sm:text-sm h-12 disabled:opacity-50 active:scale-95"
              title={!hasTransactionId && primaryPayment?.method === 'card' ? 'Cannot refund: transaction information missing. Please ensure the receipt has been synced to the server.' : undefined}
            >
              Void
            </Button>
          </div>
          <Button
            onClick={() => setQrScannerOpen(true)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white border-0 text-xs sm:text-sm h-12 active:scale-95"
            title={isWithin24Hours() ? "Assign customer to receipt (beans can be awarded within 24 hours)" : "Assign customer to receipt (no bean awarding - outside 24-hour window)"}
          >
            <QrCode className="h-4 w-4 sm:mr-2" />
            <span>Assign Perks Customer</span>
          </Button>
          </div>

          {/* Summary Card */}
          <div className="bg-[#3d3d3d] rounded-lg p-4 border border-gray-700">
            {receipt.refunded_amount > 0 && (
              <div className="bg-red-900/20 border border-red-700 rounded-lg p-3 mb-3">
                <p className="text-red-400 text-sm">
                  <strong>Refunded:</strong> {formatCurrency(receipt.refunded_amount)}
                </p>
                {canRefund && (
                  <p className="text-red-400 text-sm mt-1">
                    <strong>Remaining:</strong> {formatCurrency(refundableAmount)}
                  </p>
                )}
              </div>
            )}

            {/* Breakdown */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Subtotal</span>
                <span className="text-white">{formatCurrency(receipt.subtotal)}</span>
              </div>
              {receipt.discount_total > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Discount</span>
                  <span className="text-red-400">-{formatCurrency(receipt.discount_total)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-400">Tax</span>
                <span className="text-white">{formatCurrency(receipt.tax_total)}</span>
              </div>
              {receipt.tip_total > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Tip</span>
                  <span className="text-green-400">{formatCurrency(receipt.tip_total)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Info - Key details visible on page */}
          <div className="bg-[#3d3d3d] rounded-lg border border-gray-700 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <ShoppingBag className="h-4 w-4 text-gray-400" />
              <span className="text-gray-400">Type:</span>
              <Badge variant={receipt.dining_option === "eat-in" ? "default" : "secondary"} className="text-xs">
                {receipt.dining_option === "eat-in" ? "Eat In" : "Takeaway"}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-gray-400" />
              <span className="text-gray-400">Covers:</span>
              <span className="text-white">{receipt.customer_count || 1} {receipt.customer_count === 1 ? "person" : "people"}</span>
            </div>
            {receipt.table_number && (
              <div className="flex items-center gap-2 text-sm">
                <Hash className="h-4 w-4 text-gray-400" />
                <span className="text-gray-400">Table:</span>
                <span className="text-white">{receipt.table_number}</span>
              </div>
            )}
            {receipt.customer_name && (
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-gray-400" />
                <span className="text-gray-400">Customer:</span>
                <span className="text-white">{receipt.customer_name}</span>
              </div>
            )}
            {receipt.customer_email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-gray-400" />
                <span className="text-gray-400">Email:</span>
                <span className="text-white text-xs break-all">{receipt.customer_email}</span>
              </div>
            )}
            {receipt.customer_phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-gray-400" />
                <span className="text-gray-400">Phone:</span>
                <span className="text-white">{receipt.customer_phone}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-gray-400" />
              <span className="text-gray-400">Served by:</span>
              <span className="text-white">{receipt.member?.first_name} {receipt.member?.last_name}</span>
            </div>
          </div>

          {/* Items - Tappable card opens slide-up sheet */}
          <button
            onClick={() => setShowItemsSheet(true)}
            className="w-full bg-[#3d3d3d] rounded-lg border border-gray-700 p-4 flex items-center justify-between hover:bg-white/5 transition-colors active:scale-[0.99]"
          >
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-gray-400" />
              <h3 className="text-base font-bold text-white">Items ({receipt.lines.length})</h3>
            </div>
            <ChevronDown className="h-5 w-5 text-gray-400" />
          </button>

          {/* Transaction Info - Tappable card opens slide-up sheet */}
          <button
            onClick={() => setShowTransactionSheet(true)}
            className="w-full bg-[#3d3d3d] rounded-lg border border-gray-700 p-4 flex items-center justify-between hover:bg-white/5 transition-colors active:scale-[0.99]"
          >
            <div className="flex items-center gap-2">
              <Info className="h-5 w-5 text-gray-400" />
              <h3 className="text-base font-bold text-white">Transaction Info</h3>
            </div>
            <ChevronDown className="h-5 w-5 text-gray-400" />
          </button>

          {/* Payments - Tappable card opens slide-up sheet */}
          <button
            onClick={() => setShowPaymentsSheet(true)}
            className="w-full bg-[#3d3d3d] rounded-lg border border-gray-700 p-4 flex items-center justify-between hover:bg-white/5 transition-colors active:scale-[0.99]"
          >
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-gray-400" />
              <h3 className="text-base font-bold text-white">Payments ({receipt.payments.length})</h3>
            </div>
            <ChevronDown className="h-5 w-5 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Fixed Refund Button at Bottom */}
      {canRefund && (
        <div className="fixed bottom-0 left-0 right-0 bg-[#3d3d3d] border-t border-gray-700 p-4 z-20">
          <Button
            onClick={() => setRefundDialogOpen(true)}
            className="w-full bg-red-600 hover:bg-red-700 text-white text-base sm:text-lg h-14 font-bold"
          >
            <RotateCcw className="h-5 w-5 mr-2" />
            Refund {formatCurrency(refundableAmount)}
          </Button>
        </div>
      )}

      {/* Items Bottom Sheet */}
      <BottomSheet
        open={showItemsSheet}
        onClose={() => setShowItemsSheet(false)}
        title={`Items (${receipt.lines.length})`}
        icon={<ShoppingBag className="h-5 w-5 text-gray-400" />}
      >
        <div className="space-y-3">
          {receipt.lines.map((line) => (
            <div key={line.id} className="flex justify-between items-start pb-3 border-b border-gray-700 last:border-0">
              <div className="flex-1">
                <p className="text-white font-medium">{line.name}</p>
                {line.modifiers && Array.isArray(line.modifiers) && line.modifiers.length > 0 && (
                  <div className="text-sm text-gray-400 ml-4 mt-1">
                    {line.modifiers.map((mod: any, idx: number) => (
                      <div key={idx}>
                        + {mod.name}
                        {mod.price > 0 && ` (${formatCurrency(mod.price)})`}
                      </div>
                    ))}
                  </div>
                )}
                {line.notes && (
                  <p className="text-sm text-gray-500 italic mt-1">
                    Note: {line.notes}
                  </p>
                )}
                <p className="text-sm text-gray-400 mt-1">
                  {line.quantity} × {formatCurrency(line.unit_price)}
                </p>
              </div>
              <p className="text-white font-medium ml-4">
                {formatCurrency(line.line_total)}
              </p>
            </div>
          ))}
        </div>
      </BottomSheet>

      {/* Transaction Info Bottom Sheet */}
      <BottomSheet
        open={showTransactionSheet}
        onClose={() => setShowTransactionSheet(false)}
        title="Transaction Info"
        icon={<Info className="h-5 w-5 text-gray-400" />}
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm">
            <Store className="h-4 w-4 text-gray-400" />
            <span className="text-gray-400">Store:</span>
            <span className="text-white">{receipt.store.name}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Monitor className="h-4 w-4 text-gray-400" />
            <span className="text-gray-400">Register:</span>
            <span className="text-white">{receipt.register.name}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <ShoppingBag className="h-4 w-4 text-gray-400" />
            <span className="text-gray-400">Type:</span>
            <Badge variant={receipt.dining_option === "eat-in" ? "default" : "secondary"} className="text-xs">
              {receipt.dining_option === "eat-in" ? "Eat In" : "Takeaway"}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-gray-400" />
            <span className="text-gray-400">Covers:</span>
            <span className="text-white">{receipt.customer_count || 1} {receipt.customer_count === 1 ? "person" : "people"}</span>
          </div>
          {receipt.customer_name && (
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-gray-400" />
              <span className="text-gray-400">Customer:</span>
              <span className="text-white">{receipt.customer_name}</span>
            </div>
          )}
          {receipt.customer_email && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-gray-400" />
              <span className="text-gray-400">Email:</span>
              <span className="text-white text-xs break-all">{receipt.customer_email}</span>
            </div>
          )}
          {receipt.customer_phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-gray-400" />
              <span className="text-gray-400">Phone:</span>
              <span className="text-white">{receipt.customer_phone}</span>
            </div>
          )}
          {receipt.table_number && (
            <div className="flex items-center gap-2 text-sm">
              <Hash className="h-4 w-4 text-gray-400" />
              <span className="text-gray-400">Table:</span>
              <span className="text-white">{receipt.table_number}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-gray-400" />
            <span className="text-gray-400">Date:</span>
            <span className="text-white">
              {new Date(receipt.created_at).toLocaleString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-gray-400" />
            <span className="text-gray-400">Served by:</span>
            <span className="text-white">
              {receipt.member?.first_name} {receipt.member?.last_name}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Receipt className="h-4 w-4 text-gray-400" />
            <span className="text-gray-400">Status:</span>
            <Badge variant={receipt.status === "completed" ? "default" : receipt.status === "voided" ? "destructive" : "secondary"} className="text-xs capitalize">
              {receipt.status}
            </Badge>
          </div>
        </div>
      </BottomSheet>

      {/* Payments Bottom Sheet */}
      <BottomSheet
        open={showPaymentsSheet}
        onClose={() => setShowPaymentsSheet(false)}
        title={`Payments (${receipt.payments.length})`}
        icon={<CreditCard className="h-5 w-5 text-gray-400" />}
      >
        <div className="space-y-3">
          {receipt.payments.map((payment) => (
            <div key={payment.id} className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-2">
                {payment.method === "card" ? (
                  <CreditCard className="h-4 w-4 text-gray-400" />
                ) : (
                  <div className="w-4 h-4 flex items-center justify-center text-gray-400 font-bold text-xs">
                    £
                  </div>
                )}
                <span className="text-white capitalize">{payment.method}</span>
                {payment.reference && (
                  <span className="text-xs text-gray-500">({payment.reference})</span>
                )}
              </div>
              <span className="text-white font-medium">
                {formatCurrency(payment.amount)}
              </span>
            </div>
          ))}
          {receipt.change_amount > 0 && (
            <div className="flex justify-between items-center pt-2 border-t border-gray-700 text-sm">
              <span className="text-gray-400">Change Given</span>
              <span className="text-white font-medium">
                {formatCurrency(receipt.change_amount)}
              </span>
            </div>
          )}
        </div>
      </BottomSheet>

      {/* Dialogs */}
      <RefundDialog
        open={refundDialogOpen}
        onClose={() => setRefundDialogOpen(false)}
        onRefund={handleRefund}
        maxAmount={refundableAmount}
        receiptNumber={receipt.receipt_number}
        items={receipt.lines}
      />

      <EmailDialog
        open={emailDialogOpen}
        onClose={() => setEmailDialogOpen(false)}
        onSend={handleEmail}
        receiptNumber={receipt.receipt_number}
        defaultEmail={(receipt as any).customer_email || undefined}
      />

      {/* QR Scanner */}
      {qrScannerOpen && (
        <QRScanner
          onScan={handleQRScan}
          onClose={() => setQrScannerOpen(false)}
        />
      )}

      {/* Perks Customer Panel */}
      {perksCustomer && (
        <PerksCustomerPanel
          customer={perksCustomer}
          onClose={() => setPerksCustomer(null)}
          onAwardBean={handleAwardBean}
          onRedeemVoucher={handleRedeemVoucher}
          staffId={receipt?.member?.first_name || ''}
          locationId={receipt?.store?.name || ''}
          currentCartItems={receipt?.lines?.map((line: any) => ({ name: line.name, price: line.unit_price })) || []}
          beanRules={perksBeanRules}
          showBeanWarning={!isWithin24Hours()}
        />
      )}

      

      {/* Void Confirmation */}
      <ConfirmDialog
        open={voidConfirmOpen}
        onClose={() => setVoidConfirmOpen(false)}
        onConfirm={handleVoid}
        title="Void receipt?"
        message="This will fully refund the receipt and cannot be undone. Are you sure you want to proceed?"
        confirmText={`Void for ${formatCurrency(refundableAmount)}`}
        cancelText="Cancel"
        variant="danger"
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
