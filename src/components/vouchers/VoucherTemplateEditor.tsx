"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { RotateCcw, Save, X, Loader2, ChevronUp, ChevronDown, Check } from "lucide-react";
import {
  VoucherLayoutConfig,
  VoucherTemplate,
  DEFAULT_VOUCHER_LAYOUT,
  ELEMENT_METADATA,
} from "@/lib/voucher/voucher-layout-config";
import { VoucherSvgPreview, VoucherPreviewData } from "./VoucherSvgPreview";
import { ElementControls } from "./ElementControls";
import { TemplateSelector } from "./TemplateSelector";

interface VoucherTemplateEditorProps {
  previewData: VoucherPreviewData;
  layout: VoucherLayoutConfig;
  onLayoutChange: (layout: VoucherLayoutConfig) => void;
  onSave?: () => Promise<boolean>;
  saving?: boolean;
  qrDataUrl?: string;
  onClose: () => void;
  templates: VoucherTemplate[];
  activeTemplateId: string;
  backgroundImageUrl?: string;
  onSelectTemplate: (templateId: string) => void;
  onCreateTemplate: (name: string, imageUrl: string) => void;
  onDeleteTemplate: (templateId: string) => void;
  onUploadTemplateImage: (file: File) => Promise<string | null>;
}

export function VoucherTemplateEditor({
  previewData,
  layout,
  onLayoutChange,
  onSave,
  saving,
  qrDataUrl,
  onClose,
  templates,
  activeTemplateId,
  backgroundImageUrl,
  onSelectTemplate,
  onCreateTemplate,
  onDeleteTemplate,
  onUploadTemplateImage,
}: VoucherTemplateEditorProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [sheetExpanded, setSheetExpanded] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const previewRef = useRef<HTMLDivElement>(null);
  const sheetContentRef = useRef<HTMLDivElement>(null);
  const elementRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Scroll to top when editor opens
  useEffect(() => {
    if (previewRef.current) {
      previewRef.current.scrollTop = 0;
    }
  }, []);

  const toggle = (key: string) => {
    const isExpanding = expandedKey !== key;
    setExpandedKey(isExpanding ? key : null);
    if (isExpanding) {
      setSheetExpanded(true);
      // Scroll the sheet content so the expanded element is at the top
      setTimeout(() => {
        const elRef = elementRefs.current[key];
        if (elRef && sheetContentRef.current) {
          const elRect = elRef.getBoundingClientRect();
          const containerRect = sheetContentRef.current.getBoundingClientRect();
          const offset = elRect.top - containerRect.top + sheetContentRef.current.scrollTop - 8;
          sheetContentRef.current.scrollTo({ top: offset, behavior: "smooth" });
        }
      }, 50);
    }
  };

  const handleReset = useCallback(() => {
    onLayoutChange({ ...DEFAULT_VOUCHER_LAYOUT });
  }, [onLayoutChange]);

  const handleSave = useCallback(async () => {
    if (!onSave) return;
    const success = await onSave();
    setSaveStatus(success ? "success" : "error");
    if (success) {
      setTimeout(() => setSaveStatus("idle"), 2500);
    }
  }, [onSave]);

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
      <div ref={previewRef} className="flex-1 overflow-y-auto flex flex-col items-center justify-start p-4 min-h-0">
        <div
          className="relative bg-[#1a2847] rounded-xl overflow-hidden flex-shrink-0"
          style={{ width: "100%", maxWidth: 300 }}
        >
          <VoucherSvgPreview
            data={previewData}
            layout={layout}
            qrDataUrl={qrDataUrl}
            backgroundImageUrl={backgroundImageUrl}
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
          <div ref={sheetContentRef} className="overflow-y-auto px-3 pb-3" style={{ maxHeight: "calc(55vh - 48px)" }}>
            {/* Template selector */}
            <div className="mb-3">
              <TemplateSelector
                templates={templates}
                activeTemplateId={activeTemplateId}
                onSelect={onSelectTemplate}
                onCreate={onCreateTemplate}
                onDelete={onDeleteTemplate}
                onUploadImage={onUploadTemplateImage}
              />
            </div>

            <div className="space-y-2">
              {ELEMENT_METADATA.map((meta) => (
                <div key={meta.key} ref={(el) => { elementRefs.current[meta.key] = el; }}>
                  <ElementControls
                    meta={meta}
                    layout={layout}
                    onLayoutChange={onLayoutChange}
                    expanded={expandedKey === meta.key}
                    onToggle={() => toggle(meta.key)}
                  />
                </div>
              ))}
            </div>

            {/* Save button + confirmation */}
            {onSave && (
              <>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className={`w-full flex items-center justify-center gap-2 py-3 mt-3 rounded-xl text-white text-sm font-bold disabled:opacity-50 transition-colors ${
                    saveStatus === "success"
                      ? "bg-green-600"
                      : saveStatus === "error"
                      ? "bg-red-600"
                      : "bg-penkey-orange hover:bg-penkey-orange/90"
                  }`}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : saveStatus === "success" ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {saveStatus === "success"
                    ? "Saved!"
                    : saveStatus === "error"
                    ? "Failed — try again"
                    : "Save Layout"}
                </button>
                {saveStatus === "success" && (
                  <p className="text-center text-xs text-green-400 mt-1.5">
                    Layout saved — close and create your voucher
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
