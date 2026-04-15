"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@penkey/ui";
import { Button } from "@penkey/ui";
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";

interface ImportResults {
  categories: { created: number; updated: number; skipped: number; errors: number };
  items: { created: number; updated: number; skipped: number; errors: number };
  item_variants: { created: number; updated: number; skipped: number; errors: number };
  modifier_groups: { created: number; updated: number; skipped: number; errors: number };
  modifier_options: { created: number; updated: number; skipped: number; errors: number };
  item_modifier_links: { created: number; updated: number; skipped: number; errors: number };
}

interface ImportResultsDialogProps {
  open: boolean;
  onClose: () => void;
  results: ImportResults | null;
  format?: string;
}

export function ImportResultsDialog({ open, onClose, results, format }: ImportResultsDialogProps) {
  if (!results) return null;

  const totalCreated = Object.values(results).reduce((sum, r) => sum + r.created, 0);
  const totalUpdated = Object.values(results).reduce((sum, r) => sum + r.updated, 0);
  const totalSkipped = Object.values(results).reduce((sum, r) => sum + r.skipped, 0);
  const totalErrors = Object.values(results).reduce((sum, r) => sum + r.errors, 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#3d3d3d] text-white border-gray-700 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Import Complete</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {format && (
            <div className="text-sm text-gray-400">
              Format detected: <span className="text-white font-medium">{format}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#2d2d2d] rounded-lg p-4 border border-gray-700">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span className="text-sm font-medium">Created</span>
              </div>
              <div className="text-2xl font-bold text-green-500">{totalCreated}</div>
            </div>

            <div className="bg-[#2d2d2d] rounded-lg p-4 border border-gray-700">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-5 w-5 text-blue-500" />
                <span className="text-sm font-medium">Updated</span>
              </div>
              <div className="text-2xl font-bold text-blue-500">{totalUpdated}</div>
            </div>

            <div className="bg-[#2d2d2d] rounded-lg p-4 border border-gray-700">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-5 w-5 text-yellow-500" />
                <span className="text-sm font-medium">Skipped</span>
              </div>
              <div className="text-2xl font-bold text-yellow-500">{totalSkipped}</div>
            </div>

            <div className="bg-[#2d2d2d] rounded-lg p-4 border border-gray-700">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="h-5 w-5 text-red-500" />
                <span className="text-sm font-medium">Errors</span>
              </div>
              <div className="text-2xl font-bold text-red-500">{totalErrors}</div>
            </div>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {Object.entries(results).map(([key, value]) => {
              const total = value.created + value.updated + value.skipped + value.errors;
              if (total === 0) return null;

              const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

              return (
                <div key={key} className="bg-[#2d2d2d] rounded p-3 border border-gray-700">
                  <div className="font-medium text-sm mb-2">{label}</div>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    {value.created > 0 && (
                      <div className="text-green-500">
                        +{value.created} created
                      </div>
                    )}
                    {value.updated > 0 && (
                      <div className="text-blue-500">
                        ~{value.updated} updated
                      </div>
                    )}
                    {value.skipped > 0 && (
                      <div className="text-yellow-500">
                        ↷{value.skipped} skipped
                      </div>
                    )}
                    {value.errors > 0 && (
                      <div className="text-red-500">
                        ✕{value.errors} errors
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose} className="bg-penkey-orange hover:bg-penkey-orange/90">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
