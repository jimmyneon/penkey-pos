"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, Button } from "@penkey/ui";
import { useScrollLock } from "@/hooks/use-scroll-lock";

interface SaveTicketDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (name: string, comment: string) => void;
  ticketAssignment?: { type: 'customer' | 'table'; name: string } | null;
}

export function SaveTicketDialog({ open, onClose, onSave, ticketAssignment }: SaveTicketDialogProps) {
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");

  // Use scroll lock hook to manage scroll state
  useScrollLock(open);

  // Auto-fill ticket name when dialog opens
  useEffect(() => {
    if (open) {
      // Use customer/table name if assigned, otherwise random number
      if (ticketAssignment) {
        setName(ticketAssignment.name);
      } else if (!name) {
        const randomNumber = Math.floor(Math.random() * 10000);
        setName(`Penkey ${randomNumber}`);
      }
    }
  }, [open, ticketAssignment]);

  const handleSave = () => {
    if (!name.trim()) {
      alert("Please enter a ticket name");
      return;
    }
    onSave(name, comment);
    setName("");
    setComment("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-[#3d3d3d] text-white border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white">Save Ticket</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Ticket Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Table 5, John's Order"
              className="w-full px-4 py-2 bg-[#2d2d2d] border border-gray-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-penkey-orange placeholder-gray-500"
              autoFocus
            />
            <p className="text-xs text-gray-400 mt-1">
              Suggestions: Table numbers, customer names, order references
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Comment (Optional)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add notes about this order..."
              rows={3}
              className="w-full px-4 py-2 bg-[#2d2d2d] border border-gray-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-penkey-orange resize-none placeholder-gray-500"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              size="lg"
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              size="lg"
              className="flex-1 bg-penkey-orange hover:bg-penkey-orange/90"
              onClick={handleSave}
            >
              Save Ticket
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
