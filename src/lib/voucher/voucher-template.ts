import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';

export interface VoucherTemplateData {
  code: string;
  voucher_type: 'amount' | 'percent' | 'item';
  amount?: number;
  percent_discount?: number;
  item_name?: string;
  recipient_name?: string;
  recipient_email?: string;
  message?: string;
  expires_at?: string;
  storeName: string;
  storeAddress?: string;
}

const NAVY = '#1a2847';
const CREAM = '#f5ebd6';
const WHITE = '#ffffff';
const TEXT_DARK = '#2a2a2a';
const TEXT_MUTED = '#8a8a8a';

const SCALE = 2;
const BASE_W = 535;
const BASE_H = 1536;
const W = BASE_W * SCALE;
const H = BASE_H * SCALE;

function getValueText(v: VoucherTemplateData): string {
  if (v.voucher_type === 'amount') return `\u00a3${Number(v.amount).toFixed(2)}`;
  if (v.voucher_type === 'percent') return `${v.percent_discount}% OFF`;
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

/**
 * Build an SVG overlay with dynamic text positioned on the voucher template.
 * Coordinates are at 2x scale (1070x3072) to match the upscaled base image.
 */
async function buildOverlaySvg(v: VoucherTemplateData): Promise<string> {
  const valueText = escapeXml(getValueText(v));
  const expiry = escapeXml(expiryText(v));
  const created = escapeXml(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }));
  const recipient = v.recipient_name ? escapeXml(v.recipient_name) : '';
  const message = v.message ? escapeXml(v.message) : '';
  const storeAddrEsc = v.storeAddress ? escapeXml(v.storeAddress) : '';
  const cx = W / 2;

  const qrDataUrl = await QRCode.toDataURL(v.code, {
    width: 300,
    margin: 1,
    color: { dark: NAVY, light: '#ffffff' },
  });

  const qrSize = 260 * SCALE;
  const qrX = cx - qrSize / 2;
  const qrY = 680 * SCALE;

  let yCursor = 430 * SCALE;

  const elements: string[] = [];

  if (recipient) {
    elements.push(`<text x="${cx}" y="${yCursor}" text-anchor="middle" font-family="Georgia, serif" font-size="${20 * SCALE}" fill="${TEXT_MUTED}">A gift for</text>`);
    yCursor += 30 * SCALE;
    elements.push(`<text x="${cx}" y="${yCursor}" text-anchor="middle" font-family="Georgia, serif" font-size="${28 * SCALE}" font-weight="600" fill="${NAVY}">${recipient}</text>`);
    yCursor += 50 * SCALE;
  }

  const valueFontSize = valueText.length > 10 ? 48 * SCALE : 64 * SCALE;
  elements.push(`<text x="${cx}" y="${yCursor + valueFontSize * 0.35}" text-anchor="middle" font-family="Georgia, serif" font-size="${valueFontSize}" font-weight="700" fill="${NAVY}">${valueText}</text>`);
  yCursor += valueFontSize + 30 * SCALE;

  elements.push(`<rect x="${qrX}" y="${qrY}" width="${qrSize}" height="${qrSize}" fill="${WHITE}" rx="${8 * SCALE}"/>`);
  elements.push(`<image href="${qrDataUrl}" x="${qrX + 10 * SCALE}" y="${qrY + 10 * SCALE}" width="${qrSize - 20 * SCALE}" height="${qrSize - 20 * SCALE}"/>`);

  const codeY = qrY + qrSize + 40 * SCALE;
  elements.push(`<text x="${cx}" y="${codeY}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${12 * SCALE}" fill="${TEXT_MUTED}" letter-spacing="${3 * SCALE}">VOUCHER CODE</text>`);
  elements.push(`<text x="${cx}" y="${codeY + 30 * SCALE}" text-anchor="middle" font-family="Courier New, monospace" font-size="${22 * SCALE}" font-weight="700" fill="${NAVY}" letter-spacing="${4 * SCALE}">${escapeXml(v.code)}</text>`);

  let msgY = codeY + 60 * SCALE;
  if (message) {
    const msgLines = wrapText(v.message!, 32);
    for (const line of msgLines.slice(0, 3)) {
      elements.push(`<text x="${cx}" y="${msgY}" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="${16 * SCALE}" fill="${TEXT_DARK}">${escapeXml(line)}</text>`);
      msgY += 24 * SCALE;
    }
  }

  const expiryY = 1280 * SCALE;
  elements.push(`<text x="${cx}" y="${expiryY}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${16 * SCALE}" font-weight="600" fill="${CREAM}">Valid until: ${expiry}</text>`);
  if (storeAddrEsc) {
    elements.push(`<text x="${cx}" y="${expiryY + 24 * SCALE}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${12 * SCALE}" fill="${CREAM}" opacity="0.7">${storeAddrEsc}</text>`);
  }
  elements.push(`<text x="${cx}" y="${expiryY + (storeAddrEsc ? 48 : 24) * SCALE}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${10 * SCALE}" fill="${CREAM}" opacity="0.5">Issued: ${created}</text>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${elements.join('\n  ')}
</svg>`;
}

/**
 * Generate a PNG by compositing dynamic text onto the user's voucher template image.
 * Uses sharp to load voucher.png, upscale 2x, and overlay text + QR code.
 */
export async function generateVoucherPng(v: VoucherTemplateData): Promise<Buffer> {
  const sharp = (await import('sharp')).default;

  const templatePath = path.join(process.cwd(), 'public', 'voucher.png');
  const templateBuffer = fs.readFileSync(templatePath);

  const overlaySvg = await buildOverlaySvg(v);

  const png = await sharp(templateBuffer)
    .resize(W, H, { fit: 'fill', kernel: 'lanczos3' })
    .composite([{
      input: Buffer.from(overlaySvg),
      blend: 'over',
    }])
    .png({ quality: 90, compressionLevel: 9 })
    .toBuffer();

  return png;
}
