"use client";

import { useState } from "react";
import { Button } from "@penkey/ui";
import { 
  Printer, 
  Wifi, 
  WifiOff, 
  AlertCircle, 
  CheckCircle, 
  Trash2, 
  Edit2, 
  TestTube,
  MoreVertical,
  HardDrive
} from "lucide-react";
import { usePrinters } from "@/lib/hooks/use-printers";
import { usePrintJobs } from "@/lib/hooks/use-print-jobs";

interface PrinterCardProps {
  registerId?: string;
}

export function PrinterManager({ registerId }: PrinterCardProps) {
  const { printers, loading, error, createPrinter, updatePrinter, deletePrinter, testPrinter, refresh } = usePrinters({
    register_id: registerId,
  });

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState<any>(null);

  if (loading) {
    return (
      <div className="bg-surface rounded-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-700 rounded w-1/3"></div>
          <div className="h-20 bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-surface rounded-lg p-6">
        <div className="text-red-400 flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          <span>Error loading printers: {error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-lg p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <Printer className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Printers</h2>
            <p className="text-sm text-gray-400">
              Manage receipt printers for this register
            </p>
          </div>
        </div>
        <Button
          onClick={() => setShowAddDialog(true)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          Add Printer
        </Button>
      </div>

      {printers.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <Printer className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>No printers configured</p>
          <p className="text-sm mt-1">Add a printer to start printing receipts</p>
        </div>
      ) : (
        <div className="space-y-3">
          {printers.map((printer) => (
            <PrinterCard
              key={printer.id}
              printer={printer}
              onEdit={() => setEditingPrinter(printer)}
              onTest={() => testPrinter(printer.id)}
              onDelete={() => {
                if (confirm("Are you sure you want to delete this printer?")) {
                  deletePrinter(printer.id);
                }
              }}
            />
          ))}
        </div>
      )}

      {/* Add Printer Dialog */}
      {showAddDialog && (
        <PrinterDialog
          onClose={() => setShowAddDialog(false)}
          onSave={async (config) => {
            await createPrinter({ ...config, register_id: registerId });
            setShowAddDialog(false);
          }}
          registerId={registerId}
        />
      )}

      {/* Edit Printer Dialog */}
      {editingPrinter && (
        <PrinterDialog
          printer={editingPrinter}
          onClose={() => setEditingPrinter(null)}
          onSave={async (config) => {
            await updatePrinter(editingPrinter.id, config);
            setEditingPrinter(null);
          }}
          registerId={registerId}
        />
      )}
    </div>
  );
}

function PrinterCard({ 
  printer, 
  onEdit, 
  onTest, 
  onDelete 
}: { 
  printer: any; 
  onEdit: () => void; 
  onTest: () => void; 
  onDelete: () => void;
}) {
  const { jobs } = usePrintJobs({ printer_id: printer.id, limit: 5 });

  const statusColors = {
    online: "bg-green-500",
    offline: "bg-gray-500",
    error: "bg-red-500",
    printing: "bg-blue-500 animate-pulse",
  };

  const pendingJobs = jobs.filter((j) => j.status === "pending").length;

  return (
    <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className={`w-3 h-3 rounded-full mt-1.5 ${statusColors[printer.status as keyof typeof statusColors] || "bg-gray-500"}`} />
          <div>
            <h3 className="font-medium text-white">{printer.name}</h3>
            <div className="flex items-center gap-2 mt-1 text-sm text-gray-400">
              <span className="capitalize">{printer.type}</span>
              <span>•</span>
              <span className="capitalize">{printer.connection_type}</span>
              <span>•</span>
              <span>{printer.paper_width}mm</span>
              {printer.cups_printer_name && (
                <>
                  <span>•</span>
                  <span className="text-blue-400">{printer.cups_printer_name}</span>
                </>
              )}
            </div>
            {printer.location && (
              <p className="text-sm text-gray-500 mt-1">{printer.location}</p>
            )}
            {pendingJobs > 0 && (
              <p className="text-sm text-yellow-400 mt-1">
                {pendingJobs} pending job{pendingJobs !== 1 ? "s" : ""}
              </p>
            )}
            {printer.last_error && (
              <p className="text-sm text-red-400 mt-1">{printer.last_error}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onTest}
            className="text-gray-400 hover:text-white"
          >
            <TestTube className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onEdit}
            className="text-gray-400 hover:text-white"
          >
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="text-gray-400 hover:text-red-400"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function PrinterDialog({
  printer,
  onClose,
  onSave,
  registerId,
}: {
  printer?: any;
  onClose: () => void;
  onSave: (config: any) => void;
  registerId?: string;
}) {
  const [form, setForm] = useState({
    name: printer?.name || "",
    type: printer?.type || "epson",
    connection_type: printer?.connection_type || "cups",
    cups_printer_name: printer?.cups_printer_name || "epson-tm-t20",
    ip_address: printer?.ip_address || "",
    port: printer?.port || 8008,
    device_path: printer?.device_path || "",
    paper_width: printer?.paper_width || 80,
    location: printer?.location || "",
  });

  const isEditing = !!printer;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-semibold text-white mb-4">
          {isEditing ? "Edit Printer" : "Add Printer"}
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Printer Name
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              placeholder="e.g., Main Receipt Printer"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Type
              </label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              >
                <option value="epson">Epson</option>
                <option value="star">Star</option>
                <option value="escpos">ESCPOS</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Connection
              </label>
              <select
                value={form.connection_type}
                onChange={(e) => setForm({ ...form, connection_type: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              >
                <option value="cups">CUPS (Recommended)</option>
                <option value="lan">Network (LAN)</option>
                <option value="usb">Direct USB</option>
              </select>
            </div>
          </div>

          {form.connection_type === "cups" && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                CUPS Printer Name
              </label>
              <input
                type="text"
                value={form.cups_printer_name}
                onChange={(e) => setForm({ ...form, cups_printer_name: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                placeholder="e.g., epson-tm-t20"
              />
              <p className="text-xs text-gray-500 mt-1">
                Name of printer in CUPS (lpstat -p)
              </p>
            </div>
          )}

          {form.connection_type === "lan" && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  IP Address
                </label>
                <input
                  type="text"
                  value={form.ip_address}
                  onChange={(e) => setForm({ ...form, ip_address: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  placeholder="192.168.1.100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Port
                </label>
                <input
                  type="number"
                  value={form.port}
                  onChange={(e) => setForm({ ...form, port: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                />
              </div>
            </>
          )}

          {form.connection_type === "usb" && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Device Path
              </label>
              <input
                type="text"
                value={form.device_path}
                onChange={(e) => setForm({ ...form, device_path: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                placeholder="/dev/usb/lp0"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Paper Width
            </label>
            <select
              value={form.paper_width}
              onChange={(e) => setForm({ ...form, paper_width: parseInt(e.target.value) as 58 | 80 })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
            >
              <option value={80}>80mm (Standard)</option>
              <option value={58}>58mm (Narrow)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Location
            </label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              placeholder="e.g., Main Counter"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={() => onSave(form)}
            disabled={!form.name}
            className="flex-1 bg-blue-600 hover:bg-blue-700"
          >
            {isEditing ? "Save Changes" : "Add Printer"}
          </Button>
        </div>
      </div>
    </div>
  );
}
