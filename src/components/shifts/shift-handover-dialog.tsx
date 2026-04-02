"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription, Button } from "@penkey/ui";
import { Users, Check } from "lucide-react";
import { useScrollLock } from "@/hooks/use-scroll-lock";

interface Employee {
  id: string;
  name: string;
}

interface ShiftHandoverDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shiftId: string;
  currentEmployeeId: string;
  onHandoverComplete: () => void;
}

export function ShiftHandoverDialog({
  open,
  onOpenChange,
  shiftId,
  currentEmployeeId,
  onHandoverComplete,
}: ShiftHandoverDialogProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [loading, setLoading] = useState(false);
  const [employees_loading, setEmployeesLoading] = useState(true);

  useScrollLock(open);

  useEffect(() => {
    if (open) {
      loadEmployees();
    }
  }, [open]);

  const loadEmployees = async () => {
    try {
      setEmployeesLoading(true);
      const response = await fetch("/api/employees");
      if (response.ok) {
        const data = await response.json();
        // Filter out current employee
        setEmployees(data.filter((emp: Employee) => emp.id !== currentEmployeeId));
      }
    } catch (error) {
      console.error("Failed to load employees:", error);
    } finally {
      setEmployeesLoading(false);
    }
  };

  const handleHandover = async () => {
    if (!selectedEmployeeId) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/shifts/${shiftId}/handover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromEmployeeId: currentEmployeeId,
          toEmployeeId: selectedEmployeeId,
        }),
      });

      if (!response.ok) throw new Error("Failed to handover shift");

      onOpenChange(false);
      onHandoverComplete();
    } catch (error) {
      console.error("Failed to handover shift:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-md bg-[#3d3d3d] text-white border-gray-700">
        <DialogTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
          <Users className="h-5 w-5 text-penkey-orange" />
          Hand Over Shift
        </DialogTitle>
        <DialogDescription className="text-sm text-gray-400">
          Transfer this shift to another employee
        </DialogDescription>

        <div className="space-y-3 py-4">
          {employees_loading ? (
            <p className="text-gray-400 text-center">Loading employees...</p>
          ) : employees.length === 0 ? (
            <p className="text-gray-400 text-center">No other employees available</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {employees.map((employee) => (
                <button
                  key={employee.id}
                  onClick={() => setSelectedEmployeeId(employee.id)}
                  className={`w-full p-3 rounded-lg border transition-all text-left ${
                    selectedEmployeeId === employee.id
                      ? "bg-penkey-orange/20 border-penkey-orange"
                      : "bg-[#2d2d2d] border-gray-700 hover:border-gray-600"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{employee.name}</span>
                    {selectedEmployeeId === employee.id && (
                      <Check className="h-4 w-4 text-penkey-orange" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1 bg-gray-600 hover:bg-gray-700 text-white min-h-[44px]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleHandover}
            disabled={!selectedEmployeeId || loading}
            className="flex-1 bg-penkey-orange hover:bg-penkey-orange/90 text-white min-h-[44px] font-semibold disabled:opacity-50"
          >
            {loading ? "Handing Over..." : "Hand Over"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
