"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription, Button, Input } from "@penkey/ui";
import { User, Users, Hash } from "lucide-react";

interface AssignTicketDialogProps {
  open: boolean;
  onClose: () => void;
  onAssign: (assignee: { type: 'customer' | 'table'; name: string }) => void;
}

export function AssignTicketDialog({ open, onClose, onAssign }: AssignTicketDialogProps) {
  const [assignType, setAssignType] = useState<'customer' | 'table'>('customer');
  const [assignName, setAssignName] = useState('');

  // Force unlock scroll when dialog closes
  useEffect(() => {
    if (open) {
      return () => {
        document.body.style.overflow = '';
        document.body.style.pointerEvents = '';
      };
    } else {
      document.body.style.overflow = '';
      document.body.style.pointerEvents = '';
    }
  }, [open]);

  const handleAssign = () => {
    if (!assignName.trim()) return;
    
    onAssign({
      type: assignType,
      name: assignName.trim()
    });
    
    // Reset and close
    setAssignName('');
    onClose();
  };

  const handleClose = () => {
    setAssignName('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md bg-[#3d3d3d] text-white border-gray-700">
        <DialogTitle className="text-xl font-bold text-white">Assign Ticket</DialogTitle>
        <DialogDescription className="text-gray-300">
          Assign this ticket to a customer or table
        </DialogDescription>

        <div className="space-y-4 mt-4">
          {/* Assignment Type Selection */}
          <div className="flex gap-2">
            <button
              onClick={() => setAssignType('customer')}
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
              onClick={() => setAssignType('table')}
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

          {/* Name Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {assignType === 'customer' ? 'Customer Name' : 'Table Number'}
            </label>
            <Input
              value={assignName}
              onChange={(e) => setAssignName(e.target.value)}
              placeholder={assignType === 'customer' ? 'Enter customer name' : 'Enter table number'}
              className="w-full bg-[#2d2d2d] border-gray-700 text-white placeholder:text-gray-500"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && assignName.trim()) {
                  handleAssign();
                }
              }}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleClose}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssign}
              disabled={!assignName.trim()}
              className="flex-1 bg-penkey-orange hover:bg-penkey-orange/90 text-white disabled:opacity-50"
            >
              Assign
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
