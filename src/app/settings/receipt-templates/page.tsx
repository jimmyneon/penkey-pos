"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@penkey/ui";
import { 
  ArrowLeft,
  Receipt,
  Save,
  Eye,
  Plus,
  Trash2,
  RefreshCw
} from "lucide-react";
import { hapticButtonPress, hapticSuccess } from "@/lib/utils/haptics";
import { useToast } from "@/lib/hooks/use-toast";
import { ToastContainer } from "@/components/toast-container";
import { buildReceipt } from "@/lib/services/receipt-builder";
import type { ReceiptData } from "@penkey/print-adapters";

interface ReceiptTemplate {
  id: string;
  name: string;
  header: string;
  footer: string;
  created_at: string;
}

export default function ReceiptTemplatesPage() {
  const router = useRouter();
  const { toasts, showToast, dismissToast } = useToast();
  const [templates, setTemplates] = useState<ReceiptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<ReceiptTemplate | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [previewData, setPreviewData] = useState("");

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const resp = await fetch("/api/receipt-templates");
      if (!resp.ok) throw new Error("Failed to load templates");
      const data = await resp.json();
      setTemplates(data.templates || []);
      setLoading(false);
    } catch (error: any) {
      showToast(error.message || "Failed to load templates", "error");
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedTemplate) return;
    
    try {
      hapticButtonPress();
      const resp = await fetch("/api/receipt-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selectedTemplate),
      });
      
      if (!resp.ok) throw new Error("Failed to save template");
      hapticSuccess();
      showToast("Template saved successfully", "success");
      loadTemplates();
    } catch (error: any) {
      showToast(error.message || "Failed to save template", "error");
    }
  };

  const handlePreview = () => {
    if (!selectedTemplate) return;
    
    // Generate preview using the template and receipt builder
    // Parse header lines into store_name, store_address, store_phone
    const headerLines = selectedTemplate.header.split('\n').filter(Boolean);
    const receiptData: ReceiptData = {
      store_name: headerLines[0] || 'Store Name',
      store_address: headerLines[1] || '',
      store_phone: headerLines[2] || '',
      lines: [
        { quantity: 1, item_name: "Ham Baguette", line_total: 6.50 },
        { quantity: 1, item_name: "Tea", line_total: 3.00 },
      ],
      subtotal: 9.50,
      tax: 0.00,
      total: 9.50,
      payment_method: "Card",
      date: new Date().toLocaleDateString('en-GB'),
      time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      receipt_number: 1024,
      employee_name: 'Staff',
      register_name: 'Till 1',
    };
    
    const preview = buildReceipt(receiptData);
    setPreviewData(preview);
    setPreviewMode(true);
  };

  const handleCreateNew = () => {
    const newTemplate: ReceiptTemplate = {
      id: "",
      name: "New Template",
      header: "PENKEY DELICAF\n5 New Street, Lymington\nWhatsApp Pre-orders: 01590 619472",
      footer: "Thank you for visiting",
      created_at: new Date().toISOString(),
    };
    setSelectedTemplate(newTemplate);
  };

  const handleDelete = async (id: string) => {
    try {
      hapticButtonPress();
      const resp = await fetch(`/api/receipt-templates?id=${id}`, {
        method: "DELETE",
      });
      
      if (!resp.ok) throw new Error("Failed to delete template");
      hapticSuccess();
      showToast("Template deleted", "success");
      loadTemplates();
      if (selectedTemplate?.id === id) {
        setSelectedTemplate(null);
      }
    } catch (error: any) {
      showToast(error.message || "Failed to delete template", "error");
    }
  };

  return (
    <div className="min-h-dvh bg-[#1a1a1a] text-white p-4 sm:p-6">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-[#2d2d2d] rounded-lg transition-colors"
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-500/20 rounded-lg">
            <Receipt className="h-5 w-5 text-orange-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Receipt Templates</h1>
            <p className="text-sm text-zinc-400">Create and manage receipt templates</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-orange-400" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Template List */}
          <div className="bg-[#2d2d2d] rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Templates</h2>
              <Button
                onClick={() => { hapticButtonPress(); handleCreateNew(); }}
                className="bg-orange-500 hover:bg-orange-600"
              >
                <Plus className="h-4 w-4 mr-2" />
                New
              </Button>
            </div>
            
            <div className="space-y-2">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedTemplate?.id === template.id
                      ? "border-orange-500 bg-orange-500/10"
                      : "border-gray-600 hover:border-gray-500"
                  }`}
                  onClick={() => setSelectedTemplate(template)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">{template.name}</h3>
                      <p className="text-xs text-zinc-400">
                        {new Date(template.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(template.id);
                      }}
                      className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                    >
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </button>
                  </div>
                </div>
              ))}
              
              {templates.length === 0 && (
                <p className="text-center text-zinc-400 py-8">
                  No templates yet. Create one to get started.
                </p>
              )}
            </div>
          </div>

          {/* Template Editor */}
          <div className="bg-[#2d2d2d] rounded-lg p-4">
            {selectedTemplate ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Edit Template</h2>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { hapticButtonPress(); handlePreview(); }}
                      className="border-gray-600"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Preview
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => { hapticButtonPress(); handleSave(); }}
                      className="bg-orange-500 hover:bg-orange-600"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </Button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Template Name</label>
                    <input
                      type="text"
                      value={selectedTemplate.name}
                      onChange={(e) => setSelectedTemplate({ ...selectedTemplate, name: e.target.value })}
                      className="w-full bg-[#3d3d3d] text-white px-3 py-2 rounded border border-gray-600 focus:border-orange-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Header (centre aligned)</label>
                    <textarea
                      value={selectedTemplate.header}
                      onChange={(e) => setSelectedTemplate({ ...selectedTemplate, header: e.target.value })}
                      className="w-full bg-[#3d3d3d] text-white px-3 py-2 rounded border border-gray-600 focus:border-orange-500 focus:outline-none h-24 font-mono text-sm"
                      placeholder="PENKEY DELICAF&#10;5 New Street, Lymington&#10;WhatsApp Pre-orders: 01590 619472"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Footer (centre aligned)</label>
                    <textarea
                      value={selectedTemplate.footer}
                      onChange={(e) => setSelectedTemplate({ ...selectedTemplate, footer: e.target.value })}
                      className="w-full bg-[#3d3d3d] text-white px-3 py-2 rounded border border-gray-600 focus:border-orange-500 focus:outline-none h-24 font-mono text-sm"
                      placeholder="Thank you for visiting"
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center text-zinc-400 py-12">
                <Receipt className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Select a template to edit or create a new one</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewMode && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#2d2d2d] rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Receipt Preview</h2>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPreviewMode(false)}
                className="border-gray-600"
              >
                Close
              </Button>
            </div>
            <pre className="bg-[#1a1a1a] p-4 rounded text-sm font-mono whitespace-pre-wrap">
              {previewData}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
