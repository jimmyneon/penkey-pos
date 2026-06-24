"use client";

import { useState, useEffect, useCallback } from "react";
import { RotateCcw, Save, Eye, Settings2, Loader2 } from "lucide-react";
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
}

export function VoucherTemplateEditor({
  previewData,
  layout,
  onLayoutChange,
  onSave,
  saving,
  qrDataUrl,
}: VoucherTemplateEditorProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [showGuides, setShowGuides] = useState(true);
  const [activeTab, setActiveTab] = useState<"preview" | "controls">("preview");

  const toggle = (key: string) => {
    setExpandedKey(expandedKey === key ? null : key);
  };

  const handleReset = useCallback(() => {
    onLayoutChange({ ...DEFAULT_VOUCHER_LAYOUT });
  }, [onLayoutChange]);

  return (
    <div className="flex flex-col h-full">
      {/* Tab switcher */}
      <div className="flex gap-1 p-2 bg-[#3d3d3d] border-b border-gray-700">
        <button
          onClick={() => setActiveTab("preview")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "preview"
              ? "bg-penkey-orange/15 text-penkey-orange"
              : "text-gray-400 hover:bg-white/5"
          }`}
        >
          <Eye className="h-4 w-4" />
          Preview
        </button>
        <button
          onClick={() => setActiveTab("controls")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "controls"
              ? "bg-penkey-orange/15 text-penkey-orange"
              : "text-gray-400 hover:bg-white/5"
          }`}
        >
          <Settings2 className="h-4 w-4" />
          Adjust
        </button>
      </div>

      {/* Preview tab */}
      {activeTab === "preview" && (
        <div className="flex-1 overflow-y-auto p-3">
          <div className="relative mx-auto bg-[#1a2847] rounded-xl overflow-hidden" style={{ maxWidth: 280 }}>
            <VoucherSvgPreview
              data={previewData}
              layout={layout}
              qrDataUrl={qrDataUrl}
              showGuideLines={showGuides}
              selectedElement={expandedKey}
              className="w-full"
            />
          </div>
          <div className="flex items-center justify-center gap-2 mt-3">
            <button
              onClick={() => setShowGuides(!showGuides)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                showGuides
                  ? "border-penkey-orange/50 bg-penkey-orange/10 text-penkey-orange"
                  : "border-gray-600/50 bg-[#2d2d2d] text-gray-400"
              }`}
            >
              {showGuides ? "Hide Guides" : "Show Guides"}
            </button>
          </div>
          {expandedKey && (
            <p className="text-center text-xs text-gray-500 mt-2">
              Tap &ldquo;Adjust&rdquo; to edit the selected element
            </p>
          )}
        </div>
      )}

      {/* Controls tab */}
      {activeTab === "controls" && (
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
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

          {/* Action buttons */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleReset}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-gray-600 bg-[#2d2d2d] text-gray-300 text-sm font-medium hover:bg-[#333] transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>
            {onSave && (
              <button
                onClick={onSave}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-penkey-orange hover:bg-penkey-orange/90 text-white text-sm font-medium disabled:opacity-50 transition-colors"
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
        </div>
      )}
    </div>
  );
}
