/**
 * Shared voucher layout configuration.
 * Used by both the client-side SVG preview and the server-side PNG generation
 * to ensure what you see in the editor is exactly what gets printed.
 *
 * All coordinates are in BASE units (pre-scale).
 * The actual render multiplies by SCALE (currently 2x).
 * Base image: 535 x 1536 pixels.
 */

export interface VoucherElementLayout {
  x: number;
  y: number;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  color: string;
  textAlign: 'left' | 'center' | 'right';
  fontStyle?: 'normal' | 'italic';
  letterSpacing?: number;
  opacity?: number;
  hidden?: boolean;
}

export interface VoucherQrLayout {
  x: number;
  y: number;
  size: number;
  bgColor: string;
  padding: number;
  borderRadius: number;
  hidden?: boolean;
}

export interface VoucherLayoutConfig {
  recipientLabel: VoucherElementLayout;
  recipientName: VoucherElementLayout;
  value: VoucherElementLayout;
  qrCode: VoucherQrLayout;
  codeLabel: VoucherElementLayout;
  codeValue: VoucherElementLayout;
  message: VoucherElementLayout;
  expiry: VoucherElementLayout;
  storeAddress: VoucherElementLayout;
  issuedDate: VoucherElementLayout;
}

// Base dimensions (before 2x upscale)
export const BASE_W = 535;
export const BASE_H = 1536;
export const SCALE = 2;
export const RENDER_W = BASE_W * SCALE;
export const RENDER_H = BASE_H * SCALE;

// Colors
export const VOUCHER_COLORS = {
  NAVY: '#1a2847',
  CREAM: '#f5ebd6',
  WHITE: '#ffffff',
  GOLD: '#c9a96e',
  TEXT_MUTED: 'rgba(245, 235, 214, 0.6)',
} as const;

/**
 * Default layout matching the original hardcoded positions.
 * These are the values that were baked into buildOverlaySvg() before
 * the layout became configurable.
 */
export const DEFAULT_VOUCHER_LAYOUT: VoucherLayoutConfig = {
  recipientLabel: {
    x: BASE_W / 2,
    y: 430,
    fontSize: 20,
    fontWeight: 'normal',
    color: VOUCHER_COLORS.TEXT_MUTED,
    textAlign: 'center',
  },
  recipientName: {
    x: BASE_W / 2,
    y: 460,
    fontSize: 28,
    fontWeight: 'bold',
    color: VOUCHER_COLORS.WHITE,
    textAlign: 'center',
  },
  value: {
    x: BASE_W / 2,
    y: 510,
    fontSize: 64,
    fontWeight: 'bold',
    color: VOUCHER_COLORS.GOLD,
    textAlign: 'center',
  },
  qrCode: {
    x: BASE_W / 2,
    y: 680,
    size: 260,
    bgColor: VOUCHER_COLORS.WHITE,
    padding: 10,
    borderRadius: 8,
  },
  codeLabel: {
    x: BASE_W / 2,
    y: 1020,
    fontSize: 12,
    fontWeight: 'normal',
    color: VOUCHER_COLORS.TEXT_MUTED,
    textAlign: 'center',
    letterSpacing: 3,
  },
  codeValue: {
    x: BASE_W / 2,
    y: 1050,
    fontSize: 22,
    fontWeight: 'bold',
    color: VOUCHER_COLORS.WHITE,
    textAlign: 'center',
    letterSpacing: 4,
  },
  message: {
    x: BASE_W / 2,
    y: 1100,
    fontSize: 16,
    fontWeight: 'normal',
    color: VOUCHER_COLORS.WHITE,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  expiry: {
    x: BASE_W / 2,
    y: 1280,
    fontSize: 16,
    fontWeight: 'bold',
    color: VOUCHER_COLORS.CREAM,
    textAlign: 'center',
  },
  storeAddress: {
    x: BASE_W / 2,
    y: 1304,
    fontSize: 12,
    fontWeight: 'normal',
    color: VOUCHER_COLORS.CREAM,
    textAlign: 'center',
    opacity: 0.7,
  },
  issuedDate: {
    x: BASE_W / 2,
    y: 1328,
    fontSize: 10,
    fontWeight: 'normal',
    color: VOUCHER_COLORS.CREAM,
    textAlign: 'center',
    opacity: 0.5,
  },
};

/**
 * Metadata for each configurable element.
 * Used by the editor UI to render appropriate controls.
 */
export interface ElementMeta {
  key: keyof VoucherLayoutConfig;
  label: string;
  type: 'text' | 'qr';
  hasFontSize: boolean;
  hasPosition: boolean;
  hasColor: boolean;
  minFontSize: number;
  maxFontSize: number;
}

export const ELEMENT_METADATA: ElementMeta[] = [
  { key: 'recipientLabel', label: 'Recipient Label', type: 'text', hasFontSize: true, hasPosition: true, hasColor: true, minFontSize: 10, maxFontSize: 40 },
  { key: 'recipientName', label: 'Recipient Name', type: 'text', hasFontSize: true, hasPosition: true, hasColor: true, minFontSize: 14, maxFontSize: 56 },
  { key: 'value', label: 'Value / Amount', type: 'text', hasFontSize: true, hasPosition: true, hasColor: true, minFontSize: 24, maxFontSize: 120 },
  { key: 'qrCode', label: 'QR Code', type: 'qr', hasFontSize: false, hasPosition: true, hasColor: false, minFontSize: 0, maxFontSize: 0 },
  { key: 'codeLabel', label: 'Code Label', type: 'text', hasFontSize: true, hasPosition: true, hasColor: true, minFontSize: 8, maxFontSize: 24 },
  { key: 'codeValue', label: 'Voucher Code', type: 'text', hasFontSize: true, hasPosition: true, hasColor: true, minFontSize: 12, maxFontSize: 48 },
  { key: 'message', label: 'Message', type: 'text', hasFontSize: true, hasPosition: true, hasColor: true, minFontSize: 10, maxFontSize: 32 },
  { key: 'expiry', label: 'Expiry Date', type: 'text', hasFontSize: true, hasPosition: true, hasColor: true, minFontSize: 10, maxFontSize: 32 },
  { key: 'storeAddress', label: 'Store Address', type: 'text', hasFontSize: true, hasPosition: true, hasColor: true, minFontSize: 8, maxFontSize: 24 },
  { key: 'issuedDate', label: 'Issued Date', type: 'text', hasFontSize: true, hasPosition: true, hasColor: true, minFontSize: 6, maxFontSize: 20 },
];
