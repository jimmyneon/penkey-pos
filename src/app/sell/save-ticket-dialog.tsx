"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, Button, Input } from "@penkey/ui";
import { useScrollLock } from "@/hooks/use-scroll-lock";
import { User, Hash } from "lucide-react";

interface SaveTicketDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (name: string, comment: string, assignment?: { type: 'customer' | 'table'; name: string }) => void;
  ticketAssignment?: { type: 'customer' | 'table'; name: string } | null;
  mode?: 'save' | 'assign';
}

export function SaveTicketDialog({ open, onClose, onSave, ticketAssignment, mode = 'save' }: SaveTicketDialogProps) {
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [assignType, setAssignType] = useState<'customer' | 'table' | null>(null);
  const [assignName, setAssignName] = useState('');

  // Use scroll lock hook to manage scroll state
  useScrollLock(open);

  // Auto-fill ticket name when dialog opens
  useEffect(() => {
    if (open) {
      // Use customer/table name if assigned, otherwise random number
      if (ticketAssignment) {
        setName(ticketAssignment.name);
        setAssignType(ticketAssignment.type);
        setAssignName(ticketAssignment.name);
      } else if (!name) {
        const randomNumber = Math.floor(Math.random() * 10000);
        setName(`Penkey ${randomNumber}`);
      }
    } else {
      // Reset when dialog closes
      setAssignType(null);
      setAssignName('');
    }
  }, [open, ticketAssignment]);

  const handleSave = () => {
    if (!name.trim()) {
      alert("Please enter a ticket name");
      return;
    }
    
    // Only include assignment if type is selected and name is provided
    const assignment = assignType && assignName.trim() 
      ? { type: assignType, name: assignName.trim() }
      : undefined;
    
    onSave(name, comment, assignment);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-[#3d3d3d] text-white border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white">
            {mode === 'assign' ? 'Assign Ticket' : 'Save Ticket'}
          </DialogTitle>
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

          {/* Assignment Section - Optional */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-300">
              Assign to (Optional)
            </label>
            
            {/* Assignment Type Selection */}
            <div className="flex gap-2">
              <button
                onClick={() => setAssignType(assignType === 'customer' ? null : 'customer')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors ${
                  assignType === 'customer'
                    ? 'border-penkey-orange bg-penkey-orange/10 text-penkey-orange'
                    : 'border-gray-700 text-gray-300 hover:border-gray-600 bg-[#2d2d2d]'
                }`}
              >
                <User className="h-5 w-5" />
                <span className="font-medium">Customer</span>
              </button>
              <button
                onClick={() => setAssignType(assignType === 'table' ? null : 'table')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors ${
                  assignType === 'table'
                    ? 'border-penkey-orange bg-penkey-orange/10 text-penkey-orange'
                    : 'border-gray-700 text-gray-300 hover:border-gray-600 bg-[#2d2d2d]'
                }`}
              >
                <Hash className="h-5 w-5" />
                <span className="font-medium">Table</span>
              </button>
            </div>

            {/* Assignment Name Input */}
            {assignType && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {assignType === 'customer' ? 'Customer Name' : 'Table Number'}
                </label>
                <Input
                  value={assignName}
                  onChange={(e) => setAssignName(e.target.value)}
                  placeholder={assignType === 'customer' ? 'Enter customer name' : 'Enter table number'}
                  className="w-full bg-[#2d2d2d] border-gray-700 text-white placeholder:text-gray-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && name.trim()) {
                      handleSave();
                    }
                  }}
                />
              </div>
            )}
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

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-[#4d4d4d] hover:bg-[#5d5d5d] text-white font-medium rounded-lg transition-colors border border-gray-600"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex-1 px-4 py-3 bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-medium rounded-lg transition-all shadow-lg shadow-orange-500/25"
            >
              Save Ticket
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
