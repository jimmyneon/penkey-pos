"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@penkey/ui";
import { Button } from "@penkey/ui";
import { AlertTriangle } from "lucide-react";

interface DuplicateInfo {
  categories: number;
  items: number;
  modifier_groups: number;
}

interface ImportDuplicateDialogProps {
  open: boolean;
  onClose: () => void;
  duplicates: DuplicateInfo | null;
  onSkip: () => void;
  onOverwrite: () => void;
}

export function ImportDuplicateDialog({ 
  open, 
  onClose, 
  duplicates, 
  onSkip, 
  onOverwrite 
}: ImportDuplicateDialogProps) {
  if (!duplicates) return null;

  const totalDuplicates = duplicates.categories + duplicates.items + duplicates.modifier_groups;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#3d3d3d] text-white border-gray-700 max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
            <AlertTriangle className="h-6 w-6 text-yellow-500" />
            Duplicates Found
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-gray-300">
            Found <span className="font-bold text-yellow-500">{totalDuplicates}</span> duplicate{totalDuplicates !== 1 ? 's' : ''} in the import file:
          </p>

          <div className="space-y-2 bg-[#2d2d2d] rounded-lg p-4 border border-gray-700">
            {duplicates.categories > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Categories:</span>
                <span className="font-medium">{duplicates.categories}</span>
              </div>
            )}
            {duplicates.items > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Items:</span>
                <span className="font-medium">{duplicates.items}</span>
              </div>
            )}
            {duplicates.modifier_groups > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Modifier Groups:</span>
                <span className="font-medium">{duplicates.modifier_groups}</span>
              </div>
            )}
          </div>

          <p className="text-sm text-gray-400">
            How would you like to handle these duplicates?
          </p>
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            onClick={onSkip}
            variant="outline"
            className="flex-1 border-gray-600 text-white hover:bg-white/10"
          >
            Skip Duplicates
          </Button>
          <Button
            onClick={onOverwrite}
            className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white"
          >
            Overwrite Existing
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
