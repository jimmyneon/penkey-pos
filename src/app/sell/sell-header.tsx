"use client";

import { Menu, UserPlus, RefreshCw, Scan, Bell } from "lucide-react";
import { usePendingOrders } from "@/lib/hooks/use-pending-orders";
import { useRouter } from "next/navigation";
import { Button } from "@penkey/ui";
import { Badge } from "@penkey/ui";
import { formatCurrency } from "@penkey/ui";
import { SyncStatusIndicator } from "@/components/sync-status-indicator";

interface SellHeaderProps {
  linesCount: number;
  savedTicketsCount: number;
  total: number;
  syncing?: boolean;
  onMenuClick: () => void;
  onTicketClick: () => void;
  onAssignCustomerClick: () => void;
  onSaveTicketClick: () => void;
  onOpenTicketsClick: () => void;
  onChargeClick: () => void;
  onSyncClick?: () => void;
  onQRScanClick?: () => void;
}

export function SellHeader({
  linesCount,
  savedTicketsCount,
  total,
  syncing = false,
  onMenuClick,
  onTicketClick,
  onAssignCustomerClick,
  onSaveTicketClick,
  onOpenTicketsClick,
  onChargeClick,
  onSyncClick,
  onQRScanClick,
}: SellHeaderProps) {
  const router = useRouter();
  const pendingOrders = usePendingOrders();
  return (
    <>
      {/* Header - Responsive */}
      <header className="bg-[#3d3d3d] text-white px-2 py-2 sm:px-4 sm:py-3 flex items-center justify-between border-b border-gray-700">
        <div className="flex items-center gap-2 sm:gap-4">
          <Button 
            size="sm" 
            variant="ghost" 
            className="text-white hover:bg-white/10 p-2"
            onClick={onMenuClick}
          >
            <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
          <button 
            id="ticket-indicator"
            data-ticket-indicator
            onClick={onTicketClick}
            className="flex items-center gap-1.5 sm:gap-2 active:bg-white/10 px-2 py-1 sm:px-3 rounded transition-colors"
          >
            <h1 className="font-semibold text-base sm:text-lg">Ticket</h1>
            <Badge variant="outline" className="text-white border-white/30 text-xs sm:text-sm">
              {linesCount}
            </Badge>
          </button>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Minimal sync status indicator */}
          <SyncStatusIndicator />

          {/* Orders notification */}
          <button
            onClick={() => router.push('/orders')}
            className="relative text-white hover:bg-white/10 p-2 rounded-lg transition-colors"
            title="Orders"
          >
            <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
            {pendingOrders > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-0.5">
                {pendingOrders}
              </span>
            )}
          </button>
          
          {onQRScanClick && (
            <Button 
              size="sm" 
              variant="ghost" 
              className="text-white hover:bg-white/10 flex items-center gap-1.5 sm:gap-2 p-2 sm:px-3"
              onClick={onQRScanClick}
            >
              <Scan className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden sm:inline text-xs sm:text-sm">Scan</span>
            </Button>
          )}
          
          <Button 
            size="sm" 
            variant="ghost" 
            className="text-white hover:bg-white/10 flex items-center gap-1.5 sm:gap-2 p-2 sm:px-3"
            onClick={onAssignCustomerClick}
          >
            <UserPlus className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="hidden sm:inline text-xs sm:text-sm">Customer</span>
          </Button>
        </div>
      </header>

      {/* Orange Action Bar - Responsive */}
      <div className="bg-penkey-orange text-white px-2 py-3 sm:px-4 sm:py-4 flex items-center justify-between">
        {linesCount > 0 ? (
          <button 
            data-save-ticket-button
            onClick={onSaveTicketClick}
            className="text-white font-semibold text-xs sm:text-sm uppercase tracking-wide hover:bg-white/10 px-3 py-1.5 sm:px-4 sm:py-2 rounded transition-colors"
          >
            SAVE TICKET
          </button>
        ) : (
          <button 
            data-open-tickets-button
            onClick={onOpenTicketsClick}
            className="text-white font-semibold text-xs sm:text-sm uppercase tracking-wide hover:bg-white/10 px-3 py-1.5 sm:px-4 sm:py-2 rounded transition-colors flex items-center gap-1.5 sm:gap-2"
          >
            <span className="hidden xs:inline">OPEN</span> TICKETS
            {savedTicketsCount > 0 && (
              <span className="bg-white text-penkey-orange text-xs font-bold rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center shadow-lg">
                {savedTicketsCount}
              </span>
            )}
          </button>
        )}
        <button 
          onClick={onChargeClick}
          disabled={linesCount === 0}
          className="text-right hover:bg-white/10 px-3 py-1.5 sm:px-4 sm:py-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="text-[10px] sm:text-xs uppercase tracking-wide opacity-90">CHARGE</div>
          <div className="text-xl sm:text-2xl font-bold">{formatCurrency(total)}</div>
        </button>
      </div>
    </>
  );
}
