"use client";

import { useEffect } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@penkey/ui";
import { X, Trash2, Edit, Users, Merge, Split, RefreshCw } from "lucide-react";

interface TicketActionsMenuProps {
  open: boolean;
  onClose: () => void;
  onClearTicket: () => void;
  onEditTicket: () => void;
  onAssignTicket: () => void;
  onMergeTickets: () => void;
  onSplitTicket: () => void;
  hasItems: boolean;
}

export function TicketActionsMenu({ 
  open, 
  onClose, 
  onClearTicket, 
  onEditTicket,
  onAssignTicket,
  onMergeTickets,
  onSplitTicket,
  hasItems 
}: TicketActionsMenuProps) {
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
  const handleAction = (action: string) => {
    onClose();
    
    switch (action) {
      case 'clear':
        onClearTicket();
        break;
      case 'edit':
        onEditTicket();
        break;
      case 'assign':
        onAssignTicket();
        break;
      case 'merge':
        onMergeTickets();
        break;
      case 'split':
        onSplitTicket();
        break;
      case 'sync':
        alert('Sync - Coming soon\n\nSync data with server');
        break;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xs bg-[#3d3d3d] text-white p-0 border-gray-700">
        <DialogTitle className="sr-only">Ticket Actions</DialogTitle>
        <DialogDescription className="sr-only">Actions for current ticket</DialogDescription>
        
        <div className="flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-700">
            <h3 className="font-bold text-lg text-white">Ticket Actions</h3>
          </div>

          {/* Actions */}
          <div className="p-2">
            <button 
              onClick={() => handleAction('clear')}
              disabled={!hasItems}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-red-900/20 transition-colors text-left text-red-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              <Trash2 className="h-5 w-5" />
              <span className="font-medium">Clear Ticket</span>
            </button>
            
            <button 
              onClick={() => handleAction('edit')}
              disabled={!hasItems}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors text-left text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              <Edit className="h-5 w-5" />
              <span className="font-medium">Edit Ticket</span>
            </button>
            
            <button 
              onClick={() => handleAction('assign')}
              disabled={!hasItems}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors text-left text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              <Users className="h-5 w-5" />
              <span className="font-medium">Assign Ticket</span>
            </button>
            
            <button 
              onClick={() => handleAction('merge')}
              disabled={!hasItems}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors text-left text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              <Merge className="h-5 w-5" />
              <span className="font-medium">Merge Tickets</span>
            </button>
            
            <button 
              onClick={() => handleAction('split')}
              disabled={!hasItems}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors text-left text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              <Split className="h-5 w-5" />
              <span className="font-medium">Split Ticket</span>
            </button>
            
            <div className="border-t border-gray-700 my-2"></div>
            
            <button 
              onClick={() => handleAction('sync')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors text-left text-white"
            >
              <RefreshCw className="h-5 w-5" />
              <span className="font-medium">Sync</span>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
