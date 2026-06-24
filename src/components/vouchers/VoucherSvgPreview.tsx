"use client";

import { useMemo } from "react";
import {
  VoucherLayoutConfig,
  VoucherElementLayout,
  BASE_W,
  BASE_H,
  SCALE,
  RENDER_W,
  RENDER_H,
} from "@/lib/voucher/voucher-layout-config";

export interface VoucherPreviewData {
  code: string;
  voucherType: "amount" | "percent" | "item";
  amount?: number;
  percentDiscount?: number;
  itemName?: string;
  voucherTitle?: string;
  recipientName?: string;
  recipientEmail?: string;
  message?: string;
  expiresAt?: string;
  storeName?: string;
  storeAddress?: string;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getValueText(d: VoucherPreviewData): string {
  if (d.voucherType === "amount") return `\u00a3${Number(d.amount || 0).toFixed(2)}`;
  if (d.voucherType === "percent") return `${d.percentDiscount || 0}% OFF`;
  if (d.voucherTitle) return d.voucherTitle;
  return `Free ${d.itemName || "Item"}`;
}

function getExpiryText(d: VoucherPreviewData): string {
  if (!d.expiresAt) return "No expiry";
  return new Date(d.expiresAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > maxChars) {
      if (current) lines.push(current.trim());
      current = word;
    } else {
      current = (current + " " + word).trim();
    }
  }
  if (current) lines.push(current.trim());
  return lines;
}

function buildTextElement(
  el: VoucherElementLayout,
  text: string,
  fontFamily: string = "sans-serif"
): string {
  const anchor =
    el.textAlign === "center" ? "middle" : el.textAlign === "right" ? "end" : "start";
  const fontStyleAttr = el.fontStyle === "italic" ? ` font-style="italic"` : "";
  const letterSpacingAttr = el.letterSpacing
    ? ` letter-spacing="${el.letterSpacing * SCALE}"`
    : "";
  const opacityAttr = el.opacity != null ? ` opacity="${el.opacity}"` : "";
  const y = el.y + el.fontSize * 0.35;

  return `<text x="${el.x * SCALE}" y="${y * SCALE}" text-anchor="${anchor}" font-family="${fontFamily}" font-size="${el.fontSize * SCALE}" font-weight="${el.fontWeight}" fill="${el.color}"${fontStyleAttr}${letterSpacingAttr}${opacityAttr}>${escapeXml(text)}</text>`;
}

interface VoucherSvgPreviewProps {
  data: VoucherPreviewData;
  layout: VoucherLayoutConfig;
  qrDataUrl?: string;
  className?: string;
  showGuideLines?: boolean;
  selectedElement?: string | null;
  onElementClick?: (key: string) => void;
}

export function VoucherSvgPreview({
  data,
  layout,
  qrDataUrl,
  className,
  showGuideLines = false,
  selectedElement,
  onElementClick,
}: VoucherSvgPreviewProps) {
  const svgString = useMemo(() => {
    const elements: string[] = [];

    // Recipient label + name
    if (data.recipientName) {
      elements.push(buildTextElement(layout.recipientLabel, "A gift for"));
      elements.push(buildTextElement(layout.recipientName, data.recipientName));
    }

    // Value
    const valueText = getValueText(data);
    elements.push(buildTextElement(layout.value, valueText));

    // QR Code
    const qr = layout.qrCode;
    const qrSize = qr.size * SCALE;
    const qrX = qr.x * SCALE - qrSize / 2;
    const qrY = qr.y * SCALE;
    elements.push(
      `<rect x="${qrX}" y="${qrY}" width="${qrSize}" height="${qrSize}" fill="${qr.bgColor}" rx="${qr.borderRadius * SCALE}"/>`
    );
    if (qrDataUrl) {
      const pad = qr.padding * SCALE;
      elements.push(
        `<image href="${qrDataUrl}" x="${qrX + pad}" y="${qrY + pad}" width="${qrSize - pad * 2}" height="${qrSize - pad * 2}"/>`
      );
    } else {
      // Placeholder box for QR
      elements.push(
        `<rect x="${qrX + qr.padding * SCALE}" y="${qrY + qr.padding * SCALE}" width="${qrSize - qr.padding * SCALE * 2}" height="${qrSize - qr.padding * SCALE * 2}" fill="#ddd" rx="${qr.borderRadius * SCALE}"/>`
      );
    }

    // Code label + value
    elements.push(buildTextElement(layout.codeLabel, "VOUCHER CODE"));
    elements.push(buildTextElement(layout.codeValue, data.code || "XXXX-XXXX", "monospace"));

    // Message
    if (data.message) {
      const msgLines = wrapText(data.message, 32);
      for (const line of msgLines.slice(0, 3)) {
        elements.push(buildTextElement(layout.message, line));
      }
    }

    // Expiry
    elements.push(buildTextElement(layout.expiry, `Valid until: ${getExpiryText(data)}`));

    // Store address
    if (data.storeAddress) {
      elements.push(buildTextElement(layout.storeAddress, data.storeAddress));
    }

    // Issued date
    const created = new Date().toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    elements.push(buildTextElement(layout.issuedDate, `Issued: ${created}`));

    // Guide lines for editing
    if (showGuideLines) {
      const guideLines: string[] = [];
      // Center vertical line
      guideLines.push(
        `<line x1="${(BASE_W / 2) * SCALE}" y1="0" x2="${(BASE_W / 2) * SCALE}" y2="${RENDER_H}" stroke="rgba(255,255,255,0.15)" stroke-width="1" stroke-dasharray="4,4"/>`
      );
      // Selected element highlight
      if (selectedElement) {
        const el = (layout as any)[selectedElement];
        if (el && el.fontSize != null) {
          const boxH = el.fontSize * SCALE * 1.4;
          const boxY = el.y * SCALE - el.fontSize * SCALE * 0.2;
          const boxW = 300 * SCALE;
          const boxX = el.x * SCALE - boxW / 2;
          guideLines.push(
            `<rect x="${boxX}" y="${boxY}" width="${boxW}" height="${boxH}" fill="none" stroke="#c9a96e" stroke-width="2" stroke-dasharray="6,3" rx="4"/>`
          );
        }
      }
      return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${RENDER_W} ${RENDER_H}" preserveAspectRatio="xMidYMid meet">
  <image href="/voucher.png" x="0" y="0" width="${RENDER_W}" height="${RENDER_H}" preserveAspectRatio="none"/>
  ${elements.join("\n  ")}
  ${guideLines.join("\n  ")}
</svg>`;
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${RENDER_W} ${RENDER_H}" preserveAspectRatio="xMidYMid meet">
  <image href="/voucher.png" x="0" y="0" width="${RENDER_W}" height="${RENDER_H}" preserveAspectRatio="none"/>
  ${elements.join("\n  ")}
</svg>`;
  }, [data, layout, qrDataUrl, showGuideLines, selectedElement]);

  return (
    <div
      className={className}
      style={{
        backgroundImage: "none",
        position: "relative",
      }}
      dangerouslySetInnerHTML={{ __html: svgString }}
    />
  );
}
