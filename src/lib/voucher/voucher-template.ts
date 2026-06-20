import QRCode from 'qrcode';

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
const NAVY_LIGHT = '#243556';
const CREAM = '#f5ebd6';
const CREAM_DARK = '#e8dcc0';
const GOLD = '#c9a96e';
const WHITE = '#ffffff';
const TEXT_DARK = '#2a2a2a';
const TEXT_MUTED = '#8a8a8a';

const WIDTH = 1240;
const HEIGHT = 3540;

function getValueText(v: VoucherTemplateData): string {
  if (v.voucher_type === 'amount') return `\u00a3${Number(v.amount).toFixed(2)}`;
  if (v.voucher_type === 'percent') return `${v.percent_discount}% OFF`;
  return `Free ${v.item_name}`;
}

function getValueSubtext(v: VoucherTemplateData): string {
  if (v.voucher_type === 'amount') return 'This voucher can be redeemed for goods to the value shown.';
  if (v.voucher_type === 'percent') return 'This voucher gives the stated percentage off your order.';
  return `This voucher entitles the bearer to one free ${v.item_name}.`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function expiryText(v: VoucherTemplateData): string {
  if (!v.expires_at) return 'No expiry';
  return new Date(v.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Generate a high-resolution SVG voucher matching the navy/cream design.
 * Rendered at 1240x3540 (300 DPI for 105mm x 300mm print).
 */
export async function generateVoucherSvg(v: VoucherTemplateData): Promise<string> {
  const valueText = getValueText(v);
  const subtext = getValueSubtext(v);
  const expiry = expiryText(v);
  const created = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const recipient = v.recipient_name ? escapeXml(v.recipient_name) : '';
  const message = v.message ? escapeXml(v.message) : '';
  const storeNameEsc = escapeXml(v.storeName);
  const storeAddrEsc = v.storeAddress ? escapeXml(v.storeAddress) : '';

  const qrDataUrl = await QRCode.toDataURL(v.code, {
    width: 400,
    margin: 1,
    color: { dark: NAVY, light: '#ffffff' },
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="navyGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${NAVY}"/>
      <stop offset="100%" stop-color="${NAVY_LIGHT}"/>
    </linearGradient>
    <linearGradient id="goldGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${GOLD}" stop-opacity="0.3"/>
      <stop offset="50%" stop-color="${GOLD}" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="${GOLD}" stop-opacity="0.3"/>
    </linearGradient>
    <pattern id="dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
      <circle cx="10" cy="10" r="1" fill="${GOLD}" opacity="0.15"/>
    </pattern>
  </defs>

  <!-- Outer border -->
  <rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" fill="${NAVY}"/>
  <rect x="18" y="18" width="${WIDTH - 36}" height="${HEIGHT - 36}" fill="${CREAM}" rx="8"/>

  <!-- ===== NAVY TOP SECTION ===== -->
  <rect x="18" y="18" width="${WIDTH - 36}" height="780" fill="url(#navyGrad)" rx="8"/>
  <rect x="18" y="770" width="${WIDTH - 36}" height="30" fill="url(#navyGrad)"/>
  <rect x="18" y="18" width="${WIDTH - 36}" height="780" fill="url(#dots)" rx="8"/>

  <!-- Gold decorative border line -->
  <rect x="50" y="50" width="${WIDTH - 100}" height="2" fill="url(#goldGrad)"/>
  <rect x="50" y="756" width="${WIDTH - 100}" height="2" fill="url(#goldGrad)"/>

  <!-- Decorative corner flourishes -->
  <g stroke="${GOLD}" stroke-width="2" fill="none" opacity="0.6">
    <path d="M 50 80 Q 50 60 70 60"/>
    <path d="M ${WIDTH - 50} 80 Q ${WIDTH - 50} 60 ${WIDTH - 70} 60"/>
    <path d="M 50 728 Q 50 748 70 748"/>
    <path d="M ${WIDTH - 50} 728 Q ${WIDTH - 50} 748 ${WIDTH - 70} 748"/>
  </g>

  <!-- Brand name -->
  <text x="${WIDTH / 2}" y="200" text-anchor="middle" font-family="Georgia, serif" font-size="56" font-weight="700" fill="${WHITE}" letter-spacing="4">${storeNameEsc}</text>

  <!-- Decorative divider -->
  <line x1="${WIDTH / 2 - 80}" y1="240" x2="${WIDTH / 2 + 80}" y2="240" stroke="${GOLD}" stroke-width="2"/>
  <circle cx="${WIDTH / 2}" cy="240" r="5" fill="${GOLD}"/>

  <!-- Gift Voucher label -->
  <text x="${WIDTH / 2}" y="320" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" fill="${GOLD}" letter-spacing="12" font-weight="600">GIFT VOUCHER</text>

  <!-- Ornamental flourish -->
  <g transform="translate(${WIDTH / 2}, 380)" fill="${GOLD}" opacity="0.7">
    <path d="M -60 0 L -40 0 M 60 0 L 40 0" stroke="${GOLD}" stroke-width="1.5"/>
    <path d="M -30 0 Q -15 -12 0 0 Q 15 -12 30 0" stroke="${GOLD}" stroke-width="1.5" fill="none"/>
    <circle cx="0" cy="0" r="3"/>
  </g>

  <!-- Recipient -->
  ${recipient ? `
  <text x="${WIDTH / 2}" y="480" text-anchor="middle" font-family="Georgia, serif" font-size="24" fill="${CREAM}" opacity="0.7">A gift for</text>
  <text x="${WIDTH / 2}" y="530" text-anchor="middle" font-family="Georgia, serif" font-size="42" font-weight="600" fill="${WHITE}">${recipient}</text>
  ` : ''}

  <!-- Value -->
  <text x="${WIDTH / 2}" y="${recipient ? 660 : 580}" text-anchor="middle" font-family="Georgia, serif" font-size="${valueText.length > 10 ? 80 : 110}" font-weight="700" fill="${GOLD}">${escapeXml(valueText)}</text>

  <!-- ===== CREAM MIDDLE SECTION ===== -->
  <!-- Value subtext -->
  <text x="${WIDTH / 2}" y="870" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" fill="${TEXT_MUTED}">${escapeXml(subtext)}</text>

  <!-- Dashed divider -->
  <line x1="120" y1="940" x2="${WIDTH - 120}" y2="940" stroke="${CREAM_DARK}" stroke-width="2" stroke-dasharray="12 8"/>

  <!-- QR Code -->
  <rect x="${WIDTH / 2 - 130}" y="1000" width="260" height="260" fill="${WHITE}" stroke="${CREAM_DARK}" stroke-width="2" rx="12"/>
  <image href="${qrDataUrl}" x="${WIDTH / 2 - 120}" y="1010" width="240" height="240"/>

  <!-- Voucher code label -->
  <text x="${WIDTH / 2}" y="1310" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="${TEXT_MUTED}" letter-spacing="4">VOUCHER CODE</text>

  <!-- Voucher code -->
  <rect x="${WIDTH / 2 - 200}" y="1340" width="400" height="70" fill="${NAVY}" rx="10" opacity="0.08"/>
  <text x="${WIDTH / 2}" y="1390" text-anchor="middle" font-family="Courier New, monospace" font-size="42" font-weight="700" fill="${NAVY}" letter-spacing="6">${escapeXml(v.code)}</text>

  <!-- Message -->
  ${message ? `
  <line x1="120" y1="1480" x2="${WIDTH - 120}" y2="1480" stroke="${CREAM_DARK}" stroke-width="1" stroke-dasharray="8 6"/>
  <text x="${WIDTH / 2}" y="1540" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="26" fill="${TEXT_DARK}">&ldquo;${message}&rdquo;</text>
  ` : ''}

  <!-- ===== TERMS SECTION ===== -->
  <line x1="120" y1="${message ? 1660 : 1480}" x2="${WIDTH - 120}" y2="${message ? 1660 : 1480}" stroke="${CREAM_DARK}" stroke-width="1"/>

  <text x="120" y="${message ? 1720 : 1540}" font-family="Arial, sans-serif" font-size="18" fill="${TEXT_MUTED}">
    <tspan x="120" dy="0">This voucher is valid for redemption at ${storeNameEsc} only.</tspan>
    <tspan x="120" dy="32">Present this voucher or quote the code above at the time of purchase.</tspan>
    <tspan x="120" dy="32">Cannot be exchanged for cash. No change will be given for partial redemption.</tspan>
    <tspan x="120" dy="32">Lost or stolen vouchers cannot be replaced.</tspan>
  </text>

  <!-- ===== NAVY BOTTOM SECTION ===== -->
  <rect x="18" y="${HEIGHT - 420}" width="${WIDTH - 36}" height="402" fill="url(#navyGrad)" rx="8"/>
  <rect x="18" y="${HEIGHT - 430}" width="${WIDTH - 36}" height="20" fill="url(#navyGrad)"/>
  <rect x="50" y="${HEIGHT - 390}" width="${WIDTH - 100}" height="2" fill="url(#goldGrad)"/>

  <!-- Expiry -->
  <text x="${WIDTH / 2}" y="${HEIGHT - 330}" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="${WHITE}" font-weight="600">Valid until: ${escapeXml(expiry)}</text>

  <!-- Store address -->
  ${storeAddrEsc ? `<text x="${WIDTH / 2}" y="${HEIGHT - 290}" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="${CREAM}" opacity="0.7">${storeAddrEsc}</text>` : ''}

  <!-- Issued date -->
  <text x="${WIDTH / 2}" y="${HEIGHT - 250}" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="${CREAM}" opacity="0.5">Issued: ${escapeXml(created)}</text>

  <!-- Decorative bottom flourish -->
  <g transform="translate(${WIDTH / 2}, ${HEIGHT - 180})" fill="${GOLD}" opacity="0.5">
    <line x1="-80" y1="0" x2="-30" y2="0" stroke="${GOLD}" stroke-width="1"/>
    <line x1="80" y1="0" x2="30" y2="0" stroke="${GOLD}" stroke-width="1"/>
    <circle cx="0" cy="0" r="3"/>
  </g>

  <!-- Scan instruction -->
  <text x="${WIDTH / 2}" y="${HEIGHT - 120}" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="${CREAM}" opacity="0.6">Scan the QR code or present this code in-store to redeem</text>

  <!-- Bottom gold border -->
  <rect x="50" y="${HEIGHT - 68}" width="${WIDTH - 100}" height="2" fill="url(#goldGrad)"/>
</svg>`;
}

/**
 * Generate a PNG buffer from the SVG using sharp.
 * Returns a compressed PNG buffer.
 */
export async function generateVoucherPng(v: VoucherTemplateData): Promise<Buffer> {
  const sharp = (await import('sharp')).default;
  const svg = await generateVoucherSvg(v);

  const png = await sharp(Buffer.from(svg), { density: 300 })
    .png({ quality: 90, compressionLevel: 9, palette: false })
    .toBuffer();

  return png;
}
