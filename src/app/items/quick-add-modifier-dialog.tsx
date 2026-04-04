"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, Button, Input, Label } from "@penkey/ui";
import { createSupabaseClient } from "@/lib/database";
import { hapticSuccess, hapticButtonPress } from "@/lib/utils/haptics";
import { Loader2 } from "lucide-react";

interface QuickAddModifierDialogProps {
  open: boolean;
  onClose: () => void;
  orgId: string;
  onSuccess: () => void;
}

export function QuickAddModifierDialog({
  open,
  onClose,
  orgId,
  onSuccess,
}: QuickAddModifierDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    groupName: "",
  });

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.groupName) {
      alert("Please fill in required fields");
      return;
    }

    setLoading(true);
    hapticButtonPress();

    try {
      // Check if group exists; create if not
      let groupId: string | undefined;
      const sessionData = sessionStorage.getItem('pos_session');
      if (!sessionData) {
        alert('Session expired. Please log in again.');
        setLoading(false);
        return;
      }

      const groupsResponse = await fetch(`/api/modifiers/groups?org_id=${orgId}`, {
        headers: {
          'x-pos-session': sessionData,
        },
      });
      if (!groupsResponse.ok) throw new Error("Failed to fetch groups");
      
      const groups = await groupsResponse.json();
      const existingGroup = groups.find((g: any) => g.name === formData.groupName);

      if (existingGroup) {
        groupId = existingGroup.id;
      } else {
        const createGroupResponse = await fetch("/api/modifiers/groups", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-pos-session": sessionData,
          },
          body: JSON.stringify({
            name: formData.groupName,
            selection_type: "optional",
            min_selections: 0,
            max_selections: null,
          }),
        });

        if (!createGroupResponse.ok) {
          const errorData = await createGroupResponse.json();
          throw new Error(errorData.error || "Failed to create group");
        }

        const newGroup = await createGroupResponse.json();
        groupId = newGroup.id;
      }

      hapticSuccess();
      setFormData({
        groupName: "",
      });
      onSuccess();
    } catch (error) {
      console.error("Failed to add modifier:", error);
      alert("Failed to add modifier");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[92vw] max-w-sm sm:max-w-md bg-[#3d3d3d] border-0 max-h-[90vh] overflow-y-auto scrollbar-hide">
        <DialogHeader>
          <DialogTitle className="text-xl text-white">Add Modifier Group</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="groupName" className="text-sm font-medium text-gray-300">
              Group Name *
            </Label>
            <Input
              id="groupName"
              type="text"
              value={formData.groupName}
              onChange={(e) => setFormData({ ...formData, groupName: e.target.value })}
              placeholder="e.g., Milk Options, Extra Shots"
              required
              className="mt-1 bg-[#2d2d2d] text-white border-gray-600"
            />
            <p className="text-xs text-gray-400 mt-1">Groups organize related modifiers</p>
          </div>

          {/* Option field removed per request */}

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 bg-penkey-orange hover:bg-penkey-orange/90"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
