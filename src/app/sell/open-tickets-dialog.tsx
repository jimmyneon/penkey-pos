"use client";

import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, Button } from "@penkey/ui";
import { Trash2, FileText, Merge, Split, UserPlus, User, Hash, Printer } from "lucide-react";
import { formatCurrency } from "@penkey/ui";
import { ConfirmDialog } from "@/components/confirm-dialog";

interface TicketLine {
  id: string;
  item_id: string;
  item_name: string;
  variant_name?: string;
  quantity: number;
  unit_price: number;
  modifiers?: Array<{
    group_name: string;
    option_name: string;
    price: number;
  }>;
}

interface SavedTicket {
  id: string;
  name: string;
  comment: string;
  items: number;
  total: number;
  savedAt: string;
  created_at?: string; // Database field
  lines: TicketLine[];
  assignment?: { type: 'customer' | 'table'; name: string } | null;
  ticket_assignment?: { type: 'customer' | 'table'; name: string } | null; // Database field
}

interface OpenTicketsDialogProps {
  open: boolean;
  onClose: () => void;
  tickets: SavedTicket[];
  onLoadTicket: (ticketId: string) => void;
  onDeleteTicket: (ticketId: string | string[]) => void;
  onMergeTickets?: (ticketId: string | string[]) => void;
  onSplitTicket?: (ticketId: string) => void;
  onAddToCustomer?: (ticketId: string) => void;
  onPrintTickets?: (ticketIds: string[]) => void;
}

export function OpenTicketsDialog({
  open,
  onClose,
  tickets,
  onLoadTicket,
  onDeleteTicket,
  onMergeTickets,
  onSplitTicket,
  onAddToCustomer,
  onPrintTickets,
}: OpenTicketsDialogProps) {
  const [editMode, setEditMode] = useState(false);
  const [selectedTickets, setSelectedTickets] = useState<Set<string>>(new Set());
  const [expandedTickets, setExpandedTickets] = useState<Set<string>>(new Set());
  const [dragOffset, setDragOffset] = useState<{ [key: string]: number }>({});
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [mergeConfirmOpen, setMergeConfirmOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmTitle, setConfirmTitle] = useState("");
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const longPressTriggered = useRef(false);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const swipeTicket = useRef<string | null>(null);
  const isDragging = useRef(false);

  const handleTouchStart = (ticketId: string, e: React.TouchEvent | React.MouseEvent) => {
    longPressTriggered.current = false;
    swipeTicket.current = ticketId;
    
    // Get touch/mouse position
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    touchStartX.current = clientX;
    touchStartY.current = clientY;
    
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      setEditMode(true);
      setSelectedTickets(new Set([ticketId]));
      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 500); // 500ms long press
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!swipeTicket.current || editMode) return;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const deltaX = clientX - touchStartX.current;
    const deltaY = clientY - touchStartY.current;
    
    // Cancel long press if user moves
    if (longPressTimer.current && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
      clearTimeout(longPressTimer.current);
    }
    
    // Only allow horizontal dragging to the right
    if (deltaX > 0 && Math.abs(deltaY) < 50) {
      isDragging.current = true;
      // Update drag offset with max of 150px
      setDragOffset(prev => ({
        ...prev,
        [swipeTicket.current!]: Math.min(deltaX, 150)
      }));
    }
  };

  const handleTouchEnd = (e: React.TouchEvent | React.MouseEvent) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
    
    const ticketId = swipeTicket.current;
    
    // Check for swipe right
    if (!longPressTriggered.current && ticketId && !editMode && isDragging.current) {
      const clientX = 'changedTouches' in e ? e.changedTouches[0].clientX : e.clientX;
      const clientY = 'changedTouches' in e ? e.changedTouches[0].clientY : e.clientY;
      const deltaX = clientX - touchStartX.current;
      const deltaY = clientY - touchStartY.current;
      
      // Swipe right detection: moved right > 100px and vertical movement < 50px
      if (deltaX > 100 && Math.abs(deltaY) < 50) {
        // Haptic feedback
        if (navigator.vibrate) {
          navigator.vibrate(30);
        }
        onLoadTicket(ticketId);
        onClose();
        // Reset drag offset
        setDragOffset(prev => ({ ...prev, [ticketId]: 0 }));
        swipeTicket.current = null;
        isDragging.current = false;
        return;
      }
    }
    
    // Animate back to original position
    if (ticketId && dragOffset[ticketId]) {
      setDragOffset(prev => ({ ...prev, [ticketId]: 0 }));
    }
    
    swipeTicket.current = null;
    isDragging.current = false;
  };

  const handleTicketClick = (ticketId: string) => {
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }

    if (editMode) {
      // Toggle selection
      const newSelected = new Set(selectedTickets);
      if (newSelected.has(ticketId)) {
        newSelected.delete(ticketId);
      } else {
        newSelected.add(ticketId);
      }
      setSelectedTickets(newSelected);
    } else {
      // Single tap - Only one expanded at a time
      if (expandedTickets.has(ticketId)) {
        // Close if already open
        setExpandedTickets(new Set());
      } else {
        // Open this one, close all others
        setExpandedTickets(new Set([ticketId]));
        
        // Scroll the ticket into view after a brief delay
        setTimeout(() => {
          const element = document.getElementById(`ticket-${ticketId}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      }
    }
  };

  const toggleExpanded = (ticketId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const newExpanded = new Set(expandedTickets);
    if (newExpanded.has(ticketId)) {
      newExpanded.delete(ticketId);
    } else {
      newExpanded.add(ticketId);
    }
    setExpandedTickets(newExpanded);
  };

  const handleDeleteSelected = () => {
    // Guard clause - prevent deletion if nothing selected
    if (selectedTickets.size === 0) return;
    
    const ticketCount = selectedTickets.size;
    const ticketNames = Array.from(selectedTickets)
      .map(id => tickets.find(t => t.id === id)?.name)
      .filter(Boolean)
      .join(", ");
    
    setConfirmTitle("Delete Tickets?");
    setConfirmMessage(`Delete ${ticketCount} ticket${ticketCount > 1 ? 's' : ''} (${ticketNames})? This cannot be undone.`);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    // Pass all selected ticket IDs at once to avoid state update issues
    onDeleteTicket(Array.from(selectedTickets));
    setEditMode(false);
    setSelectedTickets(new Set());
  };

  const handleMergeSelected = () => {
    // Guard clause - require at least 2 tickets to merge
    if (selectedTickets.size < 2) return;
    if (!onMergeTickets) return;
    
    // Show confirmation for merge
    const ticketCount = selectedTickets.size;
    const ticketNames = Array.from(selectedTickets)
      .map(id => tickets.find(t => t.id === id)?.name)
      .filter(Boolean)
      .join(", ");
    
    setConfirmTitle("Merge Tickets?");
    setConfirmMessage(`Merge ${ticketCount} tickets (${ticketNames}) into the current ticket? The saved tickets will be deleted.`);
    setMergeConfirmOpen(true);
  };

  const confirmMerge = () => {
    // Pass all selected ticket IDs at once to avoid state update issues
    if (onMergeTickets) {
      onMergeTickets(Array.from(selectedTickets));
    }
    setEditMode(false);
    setSelectedTickets(new Set());
    onClose();
  };

  const handleSplitSelected = () => {
    if (selectedTickets.size === 1 && onSplitTicket) {
      const ticketId = Array.from(selectedTickets)[0];
      onSplitTicket(ticketId);
      setEditMode(false);
      setSelectedTickets(new Set());
      onClose();
    }
  };

  const handleAddToCustomer = () => {
    if (selectedTickets.size === 1 && onAddToCustomer) {
      const ticketId = Array.from(selectedTickets)[0];
      onAddToCustomer(ticketId);
      setEditMode(false);
      setSelectedTickets(new Set());
      onClose();
    }
  };

  const handlePrintSelected = () => {
    if (selectedTickets.size > 0 && onPrintTickets) {
      onPrintTickets(Array.from(selectedTickets));
      setEditMode(false);
      setSelectedTickets(new Set());
    }
  };

  const exitEditMode = () => {
    setEditMode(false);
    setSelectedTickets(new Set());
  };

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setEditMode(false);
      setSelectedTickets(new Set());
      setExpandedTickets(new Set());
      
      // Force unlock scroll in case it's stuck
      document.body.style.overflow = '';
      document.body.style.pointerEvents = '';
    }
  }, [open]);

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] h-[90vh] max-w-none bg-[#3d3d3d] text-white border-gray-700 animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-300 flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
            Open Tickets
            <span className="text-sm font-normal bg-penkey-orange px-2 py-1 rounded">
              {tickets.length}
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Edit Mode Header */}
        {editMode && (
          <div className="bg-[#2d2d2d] border-b-2 border-penkey-orange px-4 py-3 flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-white text-lg">
                {selectedTickets.size} selected
              </span>
              <button 
                onClick={exitEditMode} 
                className="text-gray-400 hover:text-white text-sm"
              >
                Done
              </button>
            </div>
            
            {/* Action Buttons - Always Same Size Grid */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                size="lg"
                onClick={handleMergeSelected}
                disabled={selectedTickets.size < 2}
                className="bg-[#4d4d4d] hover:bg-[#5d5d5d] text-white border-0 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Merge className="h-5 w-5 mr-2" />
                Merge {selectedTickets.size >= 2 ? `(${selectedTickets.size})` : ''}
              </Button>
              <Button
                size="lg"
                onClick={handleSplitSelected}
                disabled={selectedTickets.size !== 1}
                className="bg-[#4d4d4d] hover:bg-[#5d5d5d] text-white border-0 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Split className="h-5 w-5 mr-2" />
                Split
              </Button>
              <Button
                size="lg"
                onClick={handlePrintSelected}
                disabled={selectedTickets.size === 0}
                className="bg-[#4d4d4d] hover:bg-[#5d5d5d] text-white border-0 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Printer className="h-5 w-5 mr-2" />
                Print {selectedTickets.size > 0 ? `(${selectedTickets.size})` : ''}
              </Button>
              <Button
                size="lg"
                onClick={handleDeleteSelected}
                disabled={selectedTickets.size === 0}
                className="bg-red-600 hover:bg-red-700 text-white border-0 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="h-5 w-5 mr-2" />
                Delete {selectedTickets.size > 0 ? `(${selectedTickets.size})` : ''}
              </Button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto scrollbar-hide py-4" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
          <div className="space-y-3">
          {tickets.length > 0 ? (
            tickets.map((ticket) => {
              const isSelected = selectedTickets.has(ticket.id);
              const isExpanded = expandedTickets.has(ticket.id);
              return (
                <div
                  key={ticket.id}
                  id={`ticket-${ticket.id}`}
                  className="relative"
                >
                  {/* Orange OPEN box - Behind the card */}
                  {dragOffset[ticket.id] > 0 && (
                    <div 
                      className="absolute inset-y-0 left-0 flex items-center justify-center rounded-lg z-0"
                      style={{ 
                        width: `${Math.min(dragOffset[ticket.id] + 20, 170)}px`,
                        backgroundColor: '#ff8c00'
                      }}
                    >
                      <span className="text-white font-bold text-2xl whitespace-nowrap">OPEN</span>
                    </div>
                  )}
                  
                <div
                  className={`relative bg-[#2d2d2d] rounded-lg border-2 z-10 ${
                    isSelected
                      ? 'border-penkey-orange'
                      : 'border-gray-700'
                  }`}
                  style={{
                    transform: `translateX(${dragOffset[ticket.id] || 0}px)`,
                    transition: isDragging.current && swipeTicket.current === ticket.id ? 'none' : 'transform 0.3s ease-out',
                  }}
                >
                  
                  <div 
                    className="relative p-4 cursor-pointer active:bg-[#3d3d3d] transition-colors bg-[#2d2d2d] rounded-lg"
                    onTouchStart={(e) => handleTouchStart(ticket.id, e)}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onMouseDown={(e) => handleTouchStart(ticket.id, e)}
                    onMouseMove={handleTouchMove}
                    onMouseUp={handleTouchEnd}
                    onMouseLeave={handleTouchEnd}
                    onClick={() => handleTicketClick(ticket.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      {/* Left side - Checkbox in edit mode */}
                      {editMode && (
                        <div className="flex items-center pt-1">
                          <div
                            className={`w-7 h-7 rounded border-2 flex items-center justify-center transition-colors ${
                              isSelected
                                ? 'bg-penkey-orange border-penkey-orange'
                                : 'border-gray-500'
                            }`}
                          >
                            {isSelected && (
                              <svg
                                className="w-5 h-5 text-white"
                                fill="none"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path d="M5 13l4 4L19 7"></path>
                              </svg>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Middle - Ticket info */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-white text-lg truncate">
                          {ticket.name}
                        </h4>
                        {(ticket.assignment || ticket.ticket_assignment) && (
                          <div className="mt-1 inline-flex items-center gap-1.5 bg-[#2d2d2d] border border-gray-600 rounded px-2 py-1">
                            {(ticket.assignment?.type || ticket.ticket_assignment?.type) === 'customer' ? (
                              <User className="h-3 w-3 text-penkey-orange" />
                            ) : (
                              <Hash className="h-3 w-3 text-penkey-orange" />
                            )}
                            <span className="text-xs text-gray-300 font-medium">
                              {(ticket.assignment || ticket.ticket_assignment)?.name}
                            </span>
                          </div>
                        )}
                        {ticket.comment && (
                          <p className="text-sm text-gray-300 mt-1 line-clamp-2">
                            {ticket.comment}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2 text-sm text-gray-400">
                          <span>{(() => {
                            try {
                              const dateStr = ticket.savedAt || ticket.created_at || '';
                              if (!dateStr) return 'Recently';
                              const date = new Date(dateStr);
                              return isNaN(date.getTime()) ? 'Recently' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            } catch {
                              return 'Recently';
                            }
                          })()}</span>
                          <span>•</span>
                          <span>{ticket.items || ticket.lines?.length || 0} items</span>
                        </div>
                      </div>

                      {/* Right side - Amount */}
                      <div className="text-right flex-shrink-0">
                        <p className="text-xl font-bold text-penkey-orange">
                          {formatCurrency(ticket.total)}
                        </p>
                        {!editMode && (
                          <span className="text-xs text-gray-400">Swipe to open →</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded Items List - Absolute Overlay */}
                {isExpanded && !editMode && ticket.lines && ticket.lines.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-2">
                    <div className="border-2 border-penkey-orange rounded-lg bg-[#252525] shadow-2xl p-4">
                      <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-hide">
                        {ticket.lines.map((line, idx) => (
                          <div key={idx} className="flex items-start justify-between py-2 border-b border-gray-700 last:border-0">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-white font-medium">{line.item_name}</span>
                                {line.variant_name && (
                                  <span className="text-xs text-gray-400 bg-gray-700 px-2 py-0.5 rounded">
                                    {line.variant_name}
                                  </span>
                                )}
                              </div>
                              {line.modifiers && line.modifiers.length > 0 && (
                                <div className="mt-1 space-y-0.5">
                                  {line.modifiers.map((mod, modIdx) => (
                                    <div key={modIdx} className="text-xs text-gray-400 flex items-center gap-2">
                                      <span>+ {mod.option_name}</span>
                                      {mod.price > 0 && (
                                        <span className="text-penkey-orange">
                                          {formatCurrency(mod.price)}
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="text-right ml-4">
                              <div className="text-sm text-gray-400">x{line.quantity}</div>
                              <div className="text-white font-semibold">
                                {formatCurrency(line.unit_price * line.quantity)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                </div>
              );
            })
          ) : (
            <div className="text-center py-12">
              <FileText className="h-16 w-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 text-lg">No saved tickets</p>
              <p className="text-gray-500 text-sm mt-2">
                Save tickets to access them later
              </p>
            </div>
          )}
          </div>
        </div>

        {!editMode && (
          <div className="flex justify-end pt-4 border-t border-gray-700">
            <Button onClick={onClose} className="bg-gray-600 hover:bg-gray-700 text-white">
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>

    {/* Delete Confirmation Dialog */}
    <ConfirmDialog
      open={deleteConfirmOpen}
      onClose={() => setDeleteConfirmOpen(false)}
      onConfirm={confirmDelete}
      title={confirmTitle}
      message={confirmMessage}
      confirmText="Delete"
      cancelText="Cancel"
      variant="danger"
    />

    {/* Merge Confirmation Dialog */}
    <ConfirmDialog
      open={mergeConfirmOpen}
      onClose={() => setMergeConfirmOpen(false)}
      onConfirm={confirmMerge}
      title={confirmTitle}
      message={confirmMessage}
      confirmText="Merge"
      cancelText="Cancel"
      variant="warning"
    />
    </>
  );
}
