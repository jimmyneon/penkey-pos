"use client";

import { useRouter } from "next/navigation";
import { Button } from "@penkey/ui";
import { ArrowLeft, Users } from "lucide-react";

export default function EmployeesPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#2d2d2d] flex flex-col">
      {/* Header */}
      <header className="bg-[#3d3d3d] text-white px-4 py-3 flex items-center justify-between border-b border-gray-700">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => router.push("/sell")}
          className="text-white hover:bg-white/10"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back to POS
        </Button>
        <h1 className="font-semibold text-lg">Employees</h1>
        <div className="w-32"></div>
      </header>

      {/* Content */}
      <div className="flex-1 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-[#3d3d3d] rounded-lg p-8 text-center">
            <Users className="h-16 w-16 text-penkey-orange mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-4">Employee Management</h2>
            <p className="text-gray-300 mb-6">
              Manage staff, permissions, and access control.
            </p>
            <div className="text-left text-gray-400 space-y-2">
              <p>• Add and manage employees</p>
              <p>• Set PINs and permissions</p>
              <p>• Assign roles (Manager, Cashier, etc.)</p>
              <p>• Track working hours</p>
              <p>• View employee sales performance</p>
            </div>
            <p className="text-penkey-orange mt-6 font-semibold">Coming Soon</p>
          </div>
        </div>
      </div>
    </div>
  );
}
