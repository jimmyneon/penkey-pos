"use client";

import { useState, useCallback } from "react";
import { RotateCcw, Save, X, Loader2, ChevronUp, ChevronDown } from "lucide-react";
import {
  VoucherLayoutConfig,
  DEFAULT_VOUCHER_LAYOUT,
  ELEMENT_METADATA,
} from "@/lib/voucher/voucher-layout-config";
import { VoucherSvgPreview, VoucherPreviewData } from "./VoucherSvgPreview";
import { ElementControls } from "./ElementControls";

interface VoucherTemplateEditorProps {
  previewData: VoucherPreviewData;
  layout: VoucherLayoutConfig;
  onLayoutChange: (layout: VoucherLayoutConfig) => void;
  onSave?: () => void;
  saving?: boolean;
  qrDataUrl?: string;
  onClose: () => void;
}

export function VoucherTemplateEditor({
  previewData,
  layout,
  onLayoutChange,
  onSave,
  saving,
  qrDataUrl,
  onClose,
}: VoucherTemplateEditorProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [sheetExpanded, setSheetExpanded] = useState(true);

  const toggle = (key: string) => {
    setExpandedKey(expandedKey === key ? null : key);
    if (expandedKey !== key) setSheetExpanded(true);
  };

  const handleReset = useCallback(() => {
    onLayoutChange({ ...DEFAULT_VOUCHER_LAYOUT });
  }, [onLayoutChange]);

  return (
    <div className="fixed inset-0 z-[60] bg-[#1a1a1a] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#2d2d2d] border-b border-gray-700 flex-shrink-0">
        <h2 className="text-base font-semibold text-white">Customize Layout</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-gray-600 text-gray-300 active:bg-[#333] transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset All
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Preview area — fills available space, always visible */}
      <div className="flex-1 overflow-y-auto flex flex-col items-center justify-start p-4 min-h-0">
        <div
          className="relative bg-[#1a2847] rounded-xl overflow-hidden flex-shrink-0"
          style={{ width: "100%", maxWidth: 300 }}
        >
          <VoucherSvgPreview
            data={previewData}
            layout={layout}
            qrDataUrl={qrDataUrl}
            showGuideLines={true}
            selectedElement={expandedKey}
            className="w-full"
          />
        </div>
      </div>

      {/* Bottom sheet — collapsible controls */}
      <div
        className="bg-[#2d2d2d] border-t border-gray-700 transition-all duration-300 flex-shrink-0"
        style={{
          maxHeight: sheetExpanded ? "55vh" : "48px",
          overflow: "hidden",
        }}
      >
        {/* Sheet handle / toggle */}
        <button
          onClick={() => setSheetExpanded(!sheetExpanded)}
          className="w-full flex items-center justify-between px-4 py-3 active:bg-[#333] transition-colors"
        >
          <span className="text-sm font-medium text-white">
            {expandedKey
              ? ELEMENT_METADATA.find((m) => m.key === expandedKey)?.label
              : "Adjust Elements"}
          </span>
          {sheetExpanded ? (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          )}
        </button>

        {/* Sheet content */}
        {sheetExpanded && (
          <div className="overflow-y-auto px-3 pb-3" style={{ maxHeight: "calc(55vh - 48px)" }}>
            <div className="space-y-2">
              {ELEMENT_METADATA.map((meta) => (
                <ElementControls
                  key={meta.key}
                  meta={meta}
                  layout={layout}
                  onLayoutChange={onLayoutChange}
                  expanded={expandedKey === meta.key}
                  onToggle={() => toggle(meta.key)}
                />
              ))}
            </div>

            {/* Save button */}
            {onSave && (
              <button
                onClick={onSave}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-3 mt-3 rounded-xl bg-penkey-orange hover:bg-penkey-orange/90 text-white text-sm font-bold disabled:opacity-50 transition-colors"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Layout
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
