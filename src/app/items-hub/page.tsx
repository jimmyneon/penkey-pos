"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@penkey/ui";
import { ArrowLeft, Package, Tag, Boxes, Percent, Home, Download, Upload } from "lucide-react";
import { hapticButtonPress } from "@/lib/utils/haptics";

interface Session {
  employee: { id: string; name: string; role: string };
  register: { id: string; name: string; store_name: string };
  org_id: string;
}

export default function ItemsHubPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const sessionData = sessionStorage.getItem("pos_session");
    if (!sessionData) {
      router.push("/lock");
      return;
    }
    try {
      const parsed = JSON.parse(sessionData);
      setSession(parsed);
    } catch (err) {
      console.error("Failed to parse session:", err);
      router.push("/lock");
    } finally {
      setLoading(false);
    }
  }, [router]);

  const catalogueItems = [
    {
      title: "Items",
      description: "Manage products",
      icon: Package,
      href: "/items",
      color: "bg-blue-500",
    },
    {
      title: "Categories",
      description: "Organize items",
      icon: Tag,
      href: "/categories",
      color: "bg-purple-500",
    },
    {
      title: "Modifiers",
      description: "Add options",
      icon: Boxes,
      href: "/modifiers",
      color: "bg-green-500",
    },
    {
      title: "Discounts",
      description: "Manage discounts",
      icon: Percent,
      href: "/discounts",
      color: "bg-orange-500",
    },
  ];

  const handleExport = async () => {
    try {
      setExporting(true);
      const response = await fetch('/api/export');
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = response.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] || 'penkey-export.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (file: File) => {
    try {
      setImporting(true);
      const text = await file.text();
      
      const response = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'text/csv' },
        body: text,
      });
      
      if (!response.ok) throw new Error('Import failed');
      
      const result = await response.json();
      setImportDialogOpen(false);
      
      const message = `Import complete!\n\nCategories: ${result.results.categories.created} created, ${result.results.categories.errors} errors\nItems: ${result.results.items.created} created, ${result.results.items.errors} errors\nItem Variants: ${result.results.item_variants?.created || 0} created, ${result.results.item_variants?.errors || 0} errors\nModifier Groups: ${result.results.modifier_groups.created} created, ${result.results.modifier_groups.errors} errors\nModifier Options: ${result.results.modifier_options.created} created, ${result.results.modifier_options.errors} errors\nItem-Modifier Links: ${result.results.item_modifier_links?.created || 0} created, ${result.results.item_modifier_links?.errors || 0} errors`;
      alert(message);
    } catch (error) {
      console.error('Import failed:', error);
      alert('Import failed. Please check the file format and try again.');
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#2d2d2d] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#2d2d2d] flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-[#3d3d3d] text-white px-4 py-3 flex items-center justify-between border-b border-gray-700">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            hapticButtonPress();
            router.push("/sell");
          }}
          className="text-white hover:bg-white/10"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back
        </Button>
        <h1 className="font-semibold text-lg">Management</h1>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              hapticButtonPress();
              setImportDialogOpen(true);
            }}
            className="text-white hover:bg-white/10"
            title="Import data"
          >
            <Upload className="h-5 w-5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              hapticButtonPress();
              handleExport();
            }}
            disabled={exporting}
            className="text-white hover:bg-white/10"
            title="Export all data"
          >
            <Download className="h-5 w-5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              hapticButtonPress();
              router.push("/sell");
            }}
            className="text-white hover:bg-white/10"
            title="Home"
          >
            <Home className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto">
          {catalogueItems.map((item) => (
            <button
              key={item.title}
              onClick={() => {
                hapticButtonPress();
                router.push(item.href);
              }}
              className="bg-[#3d3d3d] rounded-xl p-6 hover:bg-[#4d4d4d] transition-all duration-200 border-2 border-transparent hover:border-penkey-orange active:scale-95"
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className={`${item.color} rounded-xl p-4 transition-transform duration-200`}>
                  <item.icon className="h-10 w-10 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">
                    {item.title}
                  </h3>
                  <p className="text-sm text-gray-400">
                    {item.description}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Import Dialog */}
      {importDialogOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#3d3d3d] rounded-lg p-6 shadow-xl max-w-md w-full mx-4">
            <h2 className="text-lg font-semibold text-white mb-4">Import Data</h2>
            <p className="text-gray-400 text-sm mb-4">
              Select a CSV file exported from Penkey or Loyverse to import items, categories, and modifiers.
            </p>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleImport(file);
                }
              }}
              disabled={importing}
              className="w-full text-white text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-penkey-orange file:text-white hover:file:bg-penkey-orange/90"
            />
            <div className="flex justify-end gap-2 mt-4">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setImportDialogOpen(false)}
                disabled={importing}
                className="text-white hover:bg-white/10"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
