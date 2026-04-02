"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription, Button } from "@penkey/ui";
import { Merge, ShoppingCart, Calendar } from "lucide-react";
import { formatCurrency } from "@penkey/ui";
import { ConfirmDialog } from "@/components/confirm-dialog";

interface SavedTicket {
  id: string;
  name: string;
  comment: string;
  lines: any[];
  subtotal: number;
  tax: number;
  total: number;
  timestamp: number;
}

interface MergeTicketsDialogProps {
  open: boolean;
  onClose: () => void;
  tickets: SavedTicket[];
  onMerge: (ticketId: string) => void;
}

export function MergeTicketsDialog({ open, onClose, tickets, onMerge }: MergeTicketsDialogProps) {
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleMergeClick = () => {
    if (!selectedTicketId) return;
    setConfirmOpen(true);
  };

  const handleConfirmMerge = () => {
    if (!selectedTicketId) return;
    onMerge(selectedTicketId);
    setSelectedTicketId(null);
    setConfirmOpen(false);
    onClose();
  };

  const handleClose = () => {
    setSelectedTicketId(null);
    setConfirmOpen(false);
    onClose();
  };

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedTicketId(null);
      setConfirmOpen(false);
      
      // Force unlock scroll in case it's stuck
      document.body.style.overflow = '';
      document.body.style.pointerEvents = '';
    }
  }, [open]);

  const selectedTicket = tickets.find(t => t.id === selectedTicketId);

  return (
    <>
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg bg-[#3d3d3d] text-white border-gray-700 max-h-[80vh] overflow-hidden flex flex-col">
        <DialogTitle className="text-xl font-bold text-white">Merge Tickets</DialogTitle>
        <DialogDescription className="text-gray-300">
          Select a saved ticket to merge with the current ticket
        </DialogDescription>

        <div className="flex-1 overflow-y-auto mt-4 space-y-2">
          {tickets.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No saved tickets available</p>
            </div>
          ) : (
            tickets.map((ticket) => (
              <button
                key={ticket.id}
                onClick={() => setSelectedTicketId(ticket.id)}
                className={`w-full p-4 rounded-lg border-2 transition-colors text-left ${
                  selectedTicketId === ticket.id
                    ? 'border-penkey-orange bg-penkey-orange/10'
                    : 'border-gray-700 hover:border-gray-600 bg-[#2d2d2d]'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-bold text-white">{ticket.name}</h4>
                    {ticket.comment && (
                      <p className="text-sm text-gray-400 mt-1">{ticket.comment}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <ShoppingCart className="h-4 w-4" />
                        {ticket.lines.length} items
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {new Date(ticket.timestamp).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <div className="font-bold text-lg text-penkey-orange">
                      {formatCurrency(ticket.total)}
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4 border-t border-gray-700">
          <Button
            onClick={handleClose}
            className="flex-1 bg-gray-600 hover:bg-gray-700 text-white"
          >
            Cancel
          </Button>
          <Button
            onClick={handleMergeClick}
            disabled={!selectedTicketId}
            className="flex-1 bg-penkey-orange hover:bg-penkey-orange/90 text-white disabled:opacity-50"
          >
            <Merge className="h-4 w-4 mr-2" />
            Merge Tickets
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    {/* Confirm Merge Dialog */}
    {confirmOpen && (
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirmMerge}
        title="Merge Tickets"
        message={selectedTicket ? `Merge "${selectedTicket.name}" (${selectedTicket.lines.length} items) into the current ticket? The saved ticket will be deleted.` : ""}
        confirmText="Merge"
        cancelText="Cancel"
        variant="warning"
      />
    )}
    </>
  );
}
