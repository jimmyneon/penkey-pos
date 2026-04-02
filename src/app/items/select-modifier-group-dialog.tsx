"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, Button } from "@penkey/ui";
import { Loader2, Search } from "lucide-react";
import { useScrollLock } from "@/hooks/use-scroll-lock";

interface ModifierGroup {
  id: string;
  name: string;
  selection_type: string;
}

interface SelectModifierGroupDialogProps {
  open: boolean;
  onClose: () => void;
  orgId: string;
  // Single-select callback (backwards compatible)
  onSelect?: (group: ModifierGroup) => void;
  // Multi-select mode
  multiSelect?: boolean;
  onAssign?: (groups: ModifierGroup[]) => void;
}

export function SelectModifierGroupDialog({ open, onClose, orgId, onSelect, multiSelect = false, onAssign }: SelectModifierGroupDialogProps) {
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<ModifierGroup[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  
  // Use the scroll lock hook instead of manual scroll management
  useScrollLock(open);

  useEffect(() => {
    if (!open || !orgId) return;
    setSelected(new Set());
    (async () => {
      try {
        setLoading(true);
        const resp = await fetch(`/api/modifiers/groups?org_id=${orgId}`);
        if (!resp.ok) throw new Error("Failed to load modifier groups");
        const data = await resp.json();
        setGroups(data || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, orgId]);

  const filtered = groups.filter(g => g.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[92vw] max-w-sm sm:max-w-md bg-[#3d3d3d] border-0 max-h-[90vh] flex flex-col p-0">
        <div className="flex-shrink-0 px-6 pt-6 pb-3">
          <DialogHeader>
            <DialogTitle className="text-xl text-white">Select Modifier Group</DialogTitle>
          </DialogHeader>

          <div className="px-1 pt-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search groups..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-[#2d2d2d] text-white border border-gray-600 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-penkey-orange"
              />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide px-6" style={{ WebkitOverflowScrolling: 'touch' }}>
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 text-penkey-orange animate-spin" />
            </div>
          ) : filtered.length ? (
            <div className="space-y-2 pb-4">
              {filtered.map((g) => {
                const isSelected = selected.has(g.id);
                return (
                  <button
                    key={g.id}
                    onClick={() => {
                      if (multiSelect) {
                        const next = new Set(selected);
                        if (next.has(g.id)) next.delete(g.id); else next.add(g.id);
                        setSelected(next);
                      } else {
                        setSelected(new Set([g.id]));
                      }
                    }}
                    className={`w-full p-4 text-left rounded-lg border transition-colors ${
                      isSelected
                        ? "border-penkey-orange bg-orange-900/20 hover:bg-orange-900/30"
                        : "border-gray-700 hover:bg-[#4d4d4d]"
                    }`}
                  >
                    <p className="text-white font-medium text-sm">{g.name}</p>
                    <p className="text-xs text-gray-400 capitalize">{g.selection_type}</p>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-gray-400 text-center py-10">No modifier groups found</div>
          )}
        </div>

        <div className="flex-shrink-0 px-6 py-4 border-t border-gray-700 flex gap-3">
          <Button
            type="button"
            variant="ghost"
            className="text-white hover:bg-white/10"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-penkey-orange hover:bg-penkey-orange/90 text-white ml-auto"
            disabled={selected.size === 0}
            onClick={() => {
              if (onSelect) {
                const chosen = groups.find(g => selected.has(g.id));
                if (chosen) onSelect(chosen);
              } else if (onAssign) {
                const chosen = groups.filter(g => selected.has(g.id));
                onAssign(chosen);
              }
              onClose();
            }}
          >
            {multiSelect ? `Assign (${selected.size})` : 'Apply'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
