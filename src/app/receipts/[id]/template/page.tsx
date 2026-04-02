"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { Button, Badge } from "@penkey/ui";
import { formatCurrency } from "@penkey/ui";
import { 
  ArrowLeft, 
  Printer,
  Receipt, 
  MapPin,
  Phone,
  CreditCard
} from "lucide-react";

interface ReceiptLine {
  id: string;
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
    receipt_header: string | null;
    receipt_footer: string | null;
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
  }>;
  lines: ReceiptLine[];
}

export default function ReceiptTemplatePage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [receipt, setReceipt] = useState<ReceiptDetail | null>(null);
  const [showFullPreview, setShowFullPreview] = useState(false);

  useEffect(() => {
    const sessionData = sessionStorage.getItem("pos_session");
    if (!sessionData) {
      router.push("/lock");
      return;
    }

    if (params.id) {
      fetchReceiptDetail(params.id as string);
    }
  }, [params.id, router]);

  const fetchReceiptDetail = async (receiptId: string) => {
    try {
      setLoading(true);
      
      // Check IndexedDB first (for temp receipts and offline access)
      try {
        const { getDB } = await import("@/lib/idb/db");
        const db = await getDB();
        const localReceipt = await db.get("receipts", receiptId);
        
        if (localReceipt) {
          console.log("[ReceiptTemplate] Found receipt in IndexedDB:", receiptId);
          
          // Fetch receipt lines from IndexedDB too
          const tx = db.transaction('receipt_lines', 'readonly');
          const linesStore = tx.objectStore('receipt_lines');
          const linesIndex = linesStore.index('by_receipt');
          const lines = await linesIndex.getAll(receiptId);
          
          // Combine receipt with lines
          const receiptWithLines = {
            ...localReceipt,
            lines: lines || []
          };
          
          console.log("[ReceiptTemplate] Loaded receipt with", lines?.length || 0, "lines from IndexedDB");
          setReceipt(receiptWithLines as any);
          setLoading(false);
          return; // Use local data, don't fetch from API
        }
      } catch (idbError) {
        console.warn("[ReceiptTemplate] IndexedDB lookup failed:", idbError);
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
        console.warn("[ReceiptTemplate] Failed to save to IndexedDB:", idbError);
      }
    } catch (error) {
      console.error("Error fetching receipt:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Auto-print support via query param
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const shouldPrint = searchParams?.get('print') === '1';
    if (shouldPrint) {
      // Give a tick for layout to render
      setTimeout(() => {
        window.print();
      }, 250);
    }
  }, [searchParams]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#2d2d2d] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-penkey-orange mx-auto mb-4"></div>
          <p className="text-gray-400">Loading receipt...</p>
        </div>
      </div>
    );
  }

  if (!receipt) {
    return (
      <div className="min-h-screen bg-[#2d2d2d] flex items-center justify-center">
        <div className="text-center">
          <Receipt className="h-16 w-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">Receipt not found</p>
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
    <div className="h-screen bg-[#2d2d2d] flex flex-col overflow-hidden">
      {/* Header - Hidden on print */}
      <header className="bg-[#3d3d3d] text-white px-3 sm:px-4 py-3 flex items-center justify-between border-b border-gray-700 print:hidden flex-shrink-0">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <Button
            size="sm"
            variant="ghost"
            className="text-white hover:bg-white/10 flex-shrink-0"
            onClick={() => router.push(`/receipts/${params.id}`)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="font-semibold text-base sm:text-lg truncate">Receipt Preview</h1>
            <p className="text-xs sm:text-sm text-gray-400 truncate">{receipt.receipt_number}</p>
          </div>
        </div>
      </header>

      {/* Action Buttons */}
      <div className="bg-[#3d3d3d] px-3 sm:px-4 py-3 border-b border-gray-700 print:hidden flex-shrink-0">
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={handlePrint}
            className="bg-purple-600 hover:bg-purple-700 text-white h-12"
          >
            <Printer className="h-5 w-5 mr-2" />
            Print Receipt
          </Button>
          <Button
            onClick={() => setShowFullPreview(!showFullPreview)}
            className="bg-blue-600 hover:bg-blue-700 text-white h-12"
          >
            {showFullPreview ? 'Small Preview' : 'Full Preview'}
          </Button>
        </div>
      </div>

      {/* Receipt Content */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 print:p-0 flex items-start justify-center">
        <div className={`transition-all duration-300 ${
          showFullPreview ? 'max-w-2xl w-full' : 'max-w-sm w-full cursor-pointer'
        }`}
          onClick={() => !showFullPreview && setShowFullPreview(true)}
        >
          {/* Receipt Card */}
          <div className={`bg-white rounded-lg shadow-lg print:shadow-none print:rounded-none print:p-6 transition-all ${
            showFullPreview ? 'p-4 sm:p-6' : 'p-3 scale-75 hover:scale-80'
          }`}>
            {/* Tap to expand hint */}
            {!showFullPreview && (
              <div className="text-center mb-3 py-2 bg-blue-50 rounded text-blue-600 text-sm font-medium">
                Tap to view full size
              </div>
            )}

            {/* Store Header */}
            {receipt.store.receipt_header && (
              <div className="text-center mb-4 pb-4 border-b border-gray-200">
                <pre className={`whitespace-pre-wrap font-mono ${
                  showFullPreview ? 'text-sm' : 'text-xs'
                }`}>
                  {receipt.store.receipt_header}
                </pre>
              </div>
            )}

            {/* Store Info */}
            <div className="text-center mb-6">
              <h2 className={`font-bold mb-2 ${
                showFullPreview ? 'text-xl' : 'text-base'
              }`}>{receipt.store.name}</h2>
              {receipt.store.address && (
                <p className="text-sm text-gray-600 flex items-center justify-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {receipt.store.address}
                </p>
              )}
              {receipt.store.phone && (
                <p className="text-sm text-gray-600 flex items-center justify-center gap-1">
                  <Phone className="h-4 w-4" />
                  {receipt.store.phone}
                </p>
              )}
            </div>

            {/* Receipt Info */}
            <div className="mb-6 pb-4 border-b border-gray-200">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-600">Receipt:</span>
                  <span className="font-bold ml-2">{receipt.receipt_number}</span>
                </div>
                <div>
                  <span className="text-gray-600">Register:</span>
                  <span className="ml-2">{receipt.register.name}</span>
                </div>
                <div>
                  <span className="text-gray-600">Date:</span>
                  <span className="ml-2">
                    {new Date(receipt.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Time:</span>
                  <span className="ml-2">
                    {new Date(receipt.created_at).toLocaleTimeString()}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Server:</span>
                  <span className="ml-2">
                    {receipt.member.first_name} {receipt.member.last_name}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Type:</span>
                  <Badge
                    variant={receipt.dining_option === "eat-in" ? "default" : "secondary"}
                    className="ml-2"
                  >
                    {receipt.dining_option === "eat-in" ? "Eat In" : "Takeaway"}
                  </Badge>
                </div>
                {receipt.customer_name && (
                  <div className="col-span-2">
                    <span className="text-gray-600">Customer:</span>
                    <span className="ml-2">{receipt.customer_name}</span>
                  </div>
                )}
                {receipt.table_number && (
                  <div className="col-span-2">
                    <span className="text-gray-600">Table:</span>
                    <span className="ml-2">{receipt.table_number}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Items */}
            <div className="mb-6">
              <h3 className={`font-bold mb-3 ${
                showFullPreview ? 'text-base' : 'text-sm'
              }`}>Items</h3>
              <div className="space-y-3">
                {receipt.lines.map((line) => (
                  <div key={line.id} className="border-b border-gray-100 pb-2">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className={`font-medium ${
                          showFullPreview ? 'text-base' : 'text-xs'
                        }`}>{line.name}</div>
                        {line.modifiers && Array.isArray(line.modifiers) && line.modifiers.length > 0 && (
                          <div className="text-sm text-gray-600 ml-4">
                            {line.modifiers.map((mod: any, idx: number) => (
                              <div key={idx}>
                                + {mod.name}
                                {mod.price > 0 && ` (${formatCurrency(mod.price)})`}
                              </div>
                            ))}
                          </div>
                        )}
                        {line.notes && (
                          <div className="text-sm text-gray-500 italic ml-4">
                            Note: {line.notes}
                          </div>
                        )}
                        <div className={`text-gray-600 ${
                          showFullPreview ? 'text-sm' : 'text-xs'
                        }`}>
                          {line.quantity} × {formatCurrency(line.unit_price)}
                        </div>
                      </div>
                      <div className={`font-medium ${
                        showFullPreview ? 'text-base' : 'text-xs'
                      }`}>
                        {formatCurrency(line.line_total)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="space-y-2 mb-6 pb-4 border-b border-gray-200">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal:</span>
                <span>{formatCurrency(receipt.subtotal)}</span>
              </div>
              {receipt.discount_total > 0 && (
                <div className="flex justify-between text-sm text-red-600">
                  <span>Discount:</span>
                  <span>-{formatCurrency(receipt.discount_total)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Tax:</span>
                <span>{formatCurrency(receipt.tax_total)}</span>
              </div>
              {receipt.tip_total > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Tip:</span>
                  <span>{formatCurrency(receipt.tip_total)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200">
                <span>Total:</span>
                <span>{formatCurrency(receipt.total)}</span>
              </div>
            </div>

            {/* Payments */}
            <div className="mb-6">
              <h3 className="font-bold mb-3">Payments</h3>
              <div className="space-y-2">
                {receipt.payments.map((payment) => (
                  <div key={payment.id} className="flex justify-between text-sm">
                    <span className="capitalize flex items-center gap-2">
                      {payment.method === "card" ? (
                        <CreditCard className="h-4 w-4" />
                      ) : (
                        <span className="font-bold">£</span>
                      )}
                      {payment.method}
                      {payment.reference && (
                        <span className="text-gray-500 text-xs">
                          ({payment.reference})
                        </span>
                      )}
                    </span>
                    <span>{formatCurrency(payment.amount)}</span>
                  </div>
                ))}
              </div>
              {receipt.change_amount > 0 && (
                <div className="flex justify-between text-sm mt-2 pt-2 border-t border-gray-200">
                  <span className="text-gray-600">Change:</span>
                  <span>{formatCurrency(receipt.change_amount)}</span>
                </div>
              )}
            </div>

            {/* Store Footer */}
            {receipt.store.receipt_footer && (
              <div className="text-center pt-4 border-t border-gray-200">
                <pre className="text-sm whitespace-pre-wrap font-mono text-gray-600">
                  {receipt.store.receipt_footer}
                </pre>
              </div>
            )}

            {/* Status Badge */}
            {receipt.status !== "completed" && (
              <div className="text-center mt-4">
                <Badge
                  variant={receipt.status === "fully_refunded" ? "destructive" : "secondary"}
                  className="text-sm"
                >
                  {receipt.status.replace("_", " ").toUpperCase()}
                </Badge>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
