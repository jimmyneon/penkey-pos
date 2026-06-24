"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import {
  VoucherLayoutConfig,
  VoucherElementLayout,
  VoucherQrLayout,
  ElementMeta,
  DEFAULT_VOUCHER_LAYOUT,
  BASE_W,
  BASE_H,
} from "@/lib/voucher/voucher-layout-config";

interface ElementControlsProps {
  meta: ElementMeta;
  layout: VoucherLayoutConfig;
  onLayoutChange: (layout: VoucherLayoutConfig) => void;
  expanded: boolean;
  onToggle: () => void;
}

export function ElementControls({
  meta,
  layout,
  onLayoutChange,
  expanded,
  onToggle,
}: ElementControlsProps) {
  const element = (layout as any)[meta.key] as VoucherElementLayout | VoucherQrLayout;
  const defaultElement = (DEFAULT_VOUCHER_LAYOUT as any)[meta.key] as VoucherElementLayout | VoucherQrLayout;

  const updateField = (field: string, value: number | string) => {
    const updated = { ...layout };
    (updated as any)[meta.key] = { ...(updated as any)[meta.key], [field]: value };
    onLayoutChange(updated);
  };

  const resetElement = () => {
    const updated = { ...layout };
    (updated as any)[meta.key] = { ...defaultElement };
    onLayoutChange(updated);
  };

  const resetField = (field: string) => {
    const updated = { ...layout };
    (updated as any)[meta.key] = {
      ...(updated as any)[meta.key],
      [field]: (defaultElement as any)[field],
    };
    onLayoutChange(updated);
  };

  const isQr = meta.type === "qr";
  const qrEl = element as VoucherQrLayout;
  const textEl = element as VoucherElementLayout;

  return (
    <div className="border border-gray-700/50 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-[#2d2d2d] hover:bg-[#333] transition-colors"
      >
        <span className="text-sm font-medium text-white">{meta.label}</span>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        )}
      </button>

      {expanded && (
        <div className="p-3 space-y-3 bg-[#252525]">
          {/* Per-element reset */}
          <div className="flex justify-end">
            <button
              onClick={resetElement}
              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-gray-600/50 text-gray-400 hover:text-gray-200 hover:border-gray-500 transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              Reset Element
            </button>
          </div>

          {/* X position */}
          {meta.hasPosition && (
            <div>
              <label className="text-xs text-gray-400 flex justify-between items-center mb-1">
                <span>X Position</span>
                <div className="flex items-center gap-2">
                  <span className="text-gray-300 font-mono">
                    {isQr ? qrEl.x.toFixed(0) : textEl.x.toFixed(0)}
                  </span>
                  <button
                    onClick={() => resetField("x")}
                    className="text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </button>
                </div>
              </label>
              <input
                type="range"
                min={0}
                max={BASE_W}
                step={1}
                value={isQr ? qrEl.x : textEl.x}
                onChange={(e) => updateField("x", parseInt(e.target.value))}
                className="w-full accent-penkey-orange"
              />
            </div>
          )}

          {/* Y position */}
          {meta.hasPosition && (
            <div>
              <label className="text-xs text-gray-400 flex justify-between items-center mb-1">
                <span>Y Position</span>
                <div className="flex items-center gap-2">
                  <span className="text-gray-300 font-mono">
                    {isQr ? qrEl.y.toFixed(0) : textEl.y.toFixed(0)}
                  </span>
                  <button
                    onClick={() => resetField("y")}
                    className="text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </button>
                </div>
              </label>
              <input
                type="range"
                min={0}
                max={BASE_H}
                step={1}
                value={isQr ? qrEl.y : textEl.y}
                onChange={(e) => updateField("y", parseInt(e.target.value))}
                className="w-full accent-penkey-orange"
              />
            </div>
          )}

          {/* Font size */}
          {meta.hasFontSize && (
            <div>
              <label className="text-xs text-gray-400 flex justify-between items-center mb-1">
                <span>Font Size</span>
                <div className="flex items-center gap-2">
                  <span className="text-gray-300 font-mono">{textEl.fontSize}px</span>
                  <button
                    onClick={() => resetField("fontSize")}
                    className="text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </button>
                </div>
              </label>
              <input
                type="range"
                min={meta.minFontSize}
                max={meta.maxFontSize}
                step={1}
                value={textEl.fontSize}
                onChange={(e) => updateField("fontSize", parseInt(e.target.value))}
                className="w-full accent-penkey-orange"
              />
            </div>
          )}

          {/* QR size */}
          {isQr && (
            <div>
              <label className="text-xs text-gray-400 flex justify-between items-center mb-1">
                <span>QR Size</span>
                <div className="flex items-center gap-2">
                  <span className="text-gray-300 font-mono">{qrEl.size}px</span>
                  <button
                    onClick={() => resetField("size")}
                    className="text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </button>
                </div>
              </label>
              <input
                type="range"
                min={100}
                max={400}
                step={5}
                value={qrEl.size}
                onChange={(e) => updateField("size", parseInt(e.target.value))}
                className="w-full accent-penkey-orange"
              />
            </div>
          )}

          {/* Color */}
          {meta.hasColor && (
            <div>
              <label className="text-xs text-gray-400 flex justify-between items-center mb-1">
                <span>Color</span>
                <button
                  onClick={() => resetField("color")}
                  className="text-gray-500 hover:text-gray-300 transition-colors"
                >
                  <RotateCcw className="h-3 w-3" />
                </button>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={textEl.color.startsWith("rgba") ? "#ffffff" : textEl.color}
                  onChange={(e) => updateField("color", e.target.value)}
                  className="w-10 h-8 rounded border border-gray-600 bg-transparent cursor-pointer"
                />
                <input
                  type="text"
                  value={textEl.color}
                  onChange={(e) => updateField("color", e.target.value)}
                  className="flex-1 bg-[#2d2d2d] text-white text-xs px-2 py-1.5 rounded border border-gray-600 focus:outline-none focus:border-penkey-orange font-mono"
                />
              </div>
            </div>
          )}

          {/* Text alignment */}
          {meta.hasFontSize && (
            <div>
              <label className="text-xs text-gray-400 flex justify-between items-center mb-1">
                <span>Alignment</span>
                <button
                  onClick={() => resetField("textAlign")}
                  className="text-gray-500 hover:text-gray-300 transition-colors"
                >
                  <RotateCcw className="h-3 w-3" />
                </button>
              </label>
              <div className="grid grid-cols-3 gap-1">
                {(["left", "center", "right"] as const).map((align) => (
                  <button
                    key={align}
                    onClick={() => updateField("textAlign", align)}
                    className={`py-1.5 text-xs font-medium rounded border transition-colors ${
                      textEl.textAlign === align
                        ? "border-penkey-orange bg-penkey-orange/15 text-penkey-orange"
                        : "border-gray-600/50 bg-[#2d2d2d] text-gray-400 hover:border-gray-500"
                    }`}
                  >
                    {align.charAt(0).toUpperCase() + align.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Font weight toggle */}
          {meta.hasFontSize && (
            <div>
              <label className="text-xs text-gray-400 flex justify-between items-center mb-1">
                <span>Weight</span>
                <button
                  onClick={() => resetField("fontWeight")}
                  className="text-gray-500 hover:text-gray-300 transition-colors"
                >
                  <RotateCcw className="h-3 w-3" />
                </button>
              </label>
              <div className="grid grid-cols-2 gap-1">
                {(["normal", "bold"] as const).map((weight) => (
                  <button
                    key={weight}
                    onClick={() => updateField("fontWeight", weight)}
                    className={`py-1.5 text-xs font-medium rounded border transition-colors ${
                      textEl.fontWeight === weight
                        ? "border-penkey-orange bg-penkey-orange/15 text-penkey-orange"
                        : "border-gray-600/50 bg-[#2d2d2d] text-gray-400 hover:border-gray-500"
                    }`}
                  >
                    {weight === "bold" ? "Bold" : "Normal"}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
