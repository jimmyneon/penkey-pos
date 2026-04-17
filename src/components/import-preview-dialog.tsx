"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@penkey/ui";
import { Button } from "@penkey/ui";
import { Package, Tag, Boxes, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

interface ImportPreviewData {
  categories: { name: string; duplicate: boolean }[];
  items: { name: string; category: string; price: number; duplicate: boolean }[];
  modifier_groups: { name: string; duplicate: boolean }[];
  format: string;
}

interface ImportPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  previewData: ImportPreviewData | null;
  onConfirm: () => void;
  loading?: boolean;
  progressMessage?: string;
}

export function ImportPreviewDialog({ 
  open, 
  onClose, 
  previewData, 
  onConfirm,
  loading = false,
  progressMessage = ''
}: ImportPreviewDialogProps) {
  if (!previewData) return null;

  const totalItems = previewData.categories.length + previewData.items.length + previewData.modifier_groups.length;
  const duplicateCount = [
    ...previewData.categories,
    ...previewData.items,
    ...previewData.modifier_groups
  ].filter(item => item.duplicate).length;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#3d3d3d] text-white border-gray-700 max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Import Preview
          </DialogTitle>
          <div className="text-sm text-gray-400 mt-2">
            Format: <span className="text-white font-medium">{previewData.format}</span>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#2d2d2d] rounded-lg p-3 border border-gray-700">
              <div className="flex items-center gap-2 mb-1">
                <Tag className="h-4 w-4 text-purple-500" />
                <span className="text-xs font-medium">Categories</span>
              </div>
              <div className="text-xl font-bold">{previewData.categories.length}</div>
            </div>

            <div className="bg-[#2d2d2d] rounded-lg p-3 border border-gray-700">
              <div className="flex items-center gap-2 mb-1">
                <Package className="h-4 w-4 text-blue-500" />
                <span className="text-xs font-medium">Items</span>
              </div>
              <div className="text-xl font-bold">{previewData.items.length}</div>
            </div>

            <div className="bg-[#2d2d2d] rounded-lg p-3 border border-gray-700">
              <div className="flex items-center gap-2 mb-1">
                <Boxes className="h-4 w-4 text-green-500" />
                <span className="text-xs font-medium">Modifiers</span>
              </div>
              <div className="text-xl font-bold">{previewData.modifier_groups.length}</div>
            </div>
          </div>

          {/* Duplicate Warning */}
          {duplicateCount > 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
              <div className="flex items-center gap-2 text-yellow-500">
                <AlertCircle className="h-5 w-5" />
                <span className="font-medium">
                  {duplicateCount} duplicate{duplicateCount !== 1 ? 's' : ''} found
                </span>
              </div>
              <p className="text-sm text-gray-400 mt-1">
                Duplicates will be updated with new data from the import file.
              </p>
            </div>
          )}

          {/* Categories Preview */}
          {previewData.categories.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Tag className="h-4 w-4 text-purple-500" />
                Categories ({previewData.categories.length})
              </h3>
              <div className="bg-[#2d2d2d] rounded-lg border border-gray-700 max-h-40 overflow-y-auto">
                {previewData.categories.slice(0, 50).map((cat, idx) => (
                  <div 
                    key={idx} 
                    className="px-3 py-2 border-b border-gray-700 last:border-b-0 flex items-center justify-between"
                  >
                    <span className="text-sm">{cat.name}</span>
                    {cat.duplicate ? (
                      <span className="text-xs text-yellow-500 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Duplicate
                      </span>
                    ) : (
                      <span className="text-xs text-green-500 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        New
                      </span>
                    )}
                  </div>
                ))}
                {previewData.categories.length > 50 && (
                  <div className="px-3 py-2 text-xs text-gray-500 text-center">
                    ... and {previewData.categories.length - 50} more
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Items Preview */}
          {previewData.items.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Package className="h-4 w-4 text-blue-500" />
                Items ({previewData.items.length})
              </h3>
              <div className="bg-[#2d2d2d] rounded-lg border border-gray-700 max-h-40 overflow-y-auto">
                {previewData.items.slice(0, 50).map((item, idx) => (
                  <div 
                    key={idx} 
                    className="px-3 py-2 border-b border-gray-700 last:border-b-0"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="text-sm font-medium">{item.name}</div>
                        <div className="text-xs text-gray-400">
                          {item.category && `${item.category} • `}£{item.price.toFixed(2)}
                        </div>
                      </div>
                      {item.duplicate ? (
                        <span className="text-xs text-yellow-500 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Duplicate
                        </span>
                      ) : (
                        <span className="text-xs text-green-500 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          New
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {previewData.items.length > 50 && (
                  <div className="px-3 py-2 text-xs text-gray-500 text-center">
                    ... and {previewData.items.length - 50} more
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Modifier Groups Preview */}
          {previewData.modifier_groups.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Boxes className="h-4 w-4 text-green-500" />
                Modifier Groups ({previewData.modifier_groups.length})
              </h3>
              <div className="bg-[#2d2d2d] rounded-lg border border-gray-700 max-h-40 overflow-y-auto">
                {previewData.modifier_groups.slice(0, 50).map((mod, idx) => (
                  <div 
                    key={idx} 
                    className="px-3 py-2 border-b border-gray-700 last:border-b-0 flex items-center justify-between"
                  >
                    <span className="text-sm">{mod.name}</span>
                    {mod.duplicate ? (
                      <span className="text-xs text-yellow-500 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Duplicate
                      </span>
                    ) : (
                      <span className="text-xs text-green-500 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        New
                      </span>
                    )}
                  </div>
                ))}
                {previewData.modifier_groups.length > 50 && (
                  <div className="px-3 py-2 text-xs text-gray-500 text-center">
                    ... and {previewData.modifier_groups.length - 50} more
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col gap-3">
          {loading && progressMessage && (
            <div className="flex items-center gap-2 bg-[#2d2d2d] p-3 rounded-lg border border-gray-700">
              <Loader2 className="h-5 w-5 text-penkey-orange animate-spin" />
              <span className="text-sm text-white">{progressMessage}</span>
            </div>
          )}
          <div className="flex gap-2 w-full">
            <Button
              onClick={onClose}
              variant="outline"
              disabled={loading}
              className="flex-1 border-gray-600 text-white hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              onClick={onConfirm}
              disabled={loading}
              className="flex-1 bg-penkey-orange hover:bg-penkey-orange/90 text-white"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importing...
                </span>
              ) : (
                `Import ${totalItems} Item${totalItems !== 1 ? 's' : ''}`
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
