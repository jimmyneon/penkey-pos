import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import {
  VoucherLayoutConfig,
  VoucherElementLayout,
  DEFAULT_VOUCHER_LAYOUT,
  SCALE,
  RENDER_W,
  RENDER_H,
  VOUCHER_COLORS,
} from './voucher-layout-config';

export interface VoucherTemplateData {
  code: string;
  voucher_type: 'amount' | 'percent' | 'item';
  amount?: number;
  percent_discount?: number;
  item_name?: string;
  voucher_title?: string;
  recipient_name?: string;
  recipient_email?: string;
  message?: string;
  expires_at?: string;
  storeName: string;
  storeAddress?: string;
}

function getValueText(v: VoucherTemplateData): string {
  if (v.voucher_type === 'amount') return `\u00a3${Number(v.amount).toFixed(2)}`;
  if (v.voucher_type === 'percent') return `${v.percent_discount}% OFF`;
  if (v.voucher_title) return v.voucher_title;
  return `Free ${v.item_name}`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function expiryText(v: VoucherTemplateData): string {
  if (!v.expires_at) return 'No expiry';
  return new Date(v.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if ((current + ' ' + word).trim().length > maxChars) {
      if (current) lines.push(current.trim());
      current = word;
    } else {
      current = (current + ' ' + word).trim();
    }
  }
  if (current) lines.push(current.trim());
  return lines;
}

function buildTextElement(
  el: VoucherElementLayout,
  text: string,
  fontFamily: string = 'sans-serif'
): string {
  const anchor =
    el.textAlign === 'center' ? 'middle' : el.textAlign === 'right' ? 'end' : 'start';
  const fontStyleAttr = el.fontStyle === 'italic' ? ` font-style="italic"` : '';
  const letterSpacingAttr = el.letterSpacing ? ` letter-spacing="${el.letterSpacing * SCALE}"` : '';
  const opacityAttr = el.opacity != null ? ` opacity="${el.opacity}"` : '';
  const y = el.y + el.fontSize * 0.35;

  return `<text x="${el.x * SCALE}" y="${y * SCALE}" text-anchor="${anchor}" font-family="${fontFamily}" font-size="${el.fontSize * SCALE}" font-weight="${el.fontWeight}" fill="${el.color}"${fontStyleAttr}${letterSpacingAttr}${opacityAttr}>${escapeXml(text)}</text>`;
}

/**
 * Build an SVG overlay with dynamic text positioned on the voucher template.
 * Uses the configurable layout (or defaults if none provided).
 * Coordinates are at 2x scale (1070x3072) to match the upscaled base image.
 */
export async function buildOverlaySvg(
  v: VoucherTemplateData,
  layout: VoucherLayoutConfig = DEFAULT_VOUCHER_LAYOUT
): Promise<string> {
  const valueText = getValueText(v);
  const expiry = expiryText(v);
  const created = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const recipient = v.recipient_name || '';
  const message = v.message || '';

  const qrDataUrl = await QRCode.toDataURL(v.code, {
    width: 300,
    margin: 1,
    color: { dark: VOUCHER_COLORS.NAVY, light: '#ffffff' },
  });

  const elements: string[] = [];

  // Recipient label + name
  if (recipient) {
    if (!layout.recipientLabel.hidden) elements.push(buildTextElement(layout.recipientLabel, 'A gift for'));
    if (!layout.recipientName.hidden) elements.push(buildTextElement(layout.recipientName, recipient));
  }

  // Value
  if (!layout.value.hidden) {
    elements.push(buildTextElement(layout.value, valueText));
  }

  // QR Code
  if (!layout.qrCode.hidden) {
    const qr = layout.qrCode;
    const qrSize = qr.size * SCALE;
    const qrX = qr.x * SCALE - qrSize / 2;
    const qrY = qr.y * SCALE;
    elements.push(`<rect x="${qrX}" y="${qrY}" width="${qrSize}" height="${qrSize}" fill="${qr.bgColor}" rx="${qr.borderRadius * SCALE}"/>`);
    elements.push(`<image href="${qrDataUrl}" x="${qrX + qr.padding * SCALE}" y="${qrY + qr.padding * SCALE}" width="${qrSize - qr.padding * SCALE * 2}" height="${qrSize - qr.padding * SCALE * 2}"/>`);
  }

  // Code label + value
  if (!layout.codeLabel.hidden) elements.push(buildTextElement(layout.codeLabel, 'VOUCHER CODE'));
  if (!layout.codeValue.hidden) elements.push(buildTextElement(layout.codeValue, v.code, 'monospace'));

  // Message
  if (message && !layout.message.hidden) {
    const msgLines = wrapText(v.message!, 32);
    for (const line of msgLines.slice(0, 3)) {
      elements.push(buildTextElement(layout.message, line));
    }
  }

  // Expiry
  if (!layout.expiry.hidden) {
    elements.push(buildTextElement(layout.expiry, `Valid until: ${expiry}`));
  }

  // Store address
  if (v.storeAddress && !layout.storeAddress.hidden) {
    elements.push(buildTextElement(layout.storeAddress, v.storeAddress));
  }

  // Issued date
  if (!layout.issuedDate.hidden) {
    elements.push(buildTextElement(layout.issuedDate, `Issued: ${created}`));
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${RENDER_W}" height="${RENDER_H}" viewBox="0 0 ${RENDER_W} ${RENDER_H}">
  ${elements.join('\n  ')}
</svg>`;
}

/**
 * Generate a PNG by compositing dynamic text onto the user's voucher template image.
 * Uses sharp to load voucher.png, upscale 2x, and overlay text + QR code.
 * Accepts an optional layout config for custom text positioning.
 */
export async function generateVoucherPng(
  v: VoucherTemplateData,
  layout?: VoucherLayoutConfig,
  backgroundImageUrl?: string
): Promise<Buffer> {
  const sharp = (await import('sharp')).default;

  let templateBuffer: Buffer;

  if (backgroundImageUrl && backgroundImageUrl.startsWith('http')) {
    // Fetch from remote URL (Supabase Storage)
    const res = await fetch(backgroundImageUrl);
    if (!res.ok) throw new Error(`Failed to fetch template image: ${res.status}`);
    const arrayBuffer = await res.arrayBuffer();
    templateBuffer = Buffer.from(arrayBuffer);
  } else {
    // Local file from public/
    const imageSrc = backgroundImageUrl || '/voucher.png';
    const templatePath = path.join(process.cwd(), 'public', imageSrc);
    templateBuffer = fs.readFileSync(templatePath);
  }

  const overlaySvg = await buildOverlaySvg(v, layout || DEFAULT_VOUCHER_LAYOUT);

  const png = await sharp(templateBuffer)
    .resize(RENDER_W, RENDER_H, { fit: 'fill', kernel: 'lanczos3' })
    .composite([{
      input: Buffer.from(overlaySvg),
      blend: 'over',
    }])
    .png({ quality: 90, compressionLevel: 9 })
    .toBuffer();

  return png;
}
