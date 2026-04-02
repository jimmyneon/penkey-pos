export interface PrinterConfig {
  id: string;
  name: string;
  type: "epson" | "star" | "escpos";
  connectionType: "lan" | "usb" | "bluetooth";
  ipAddress?: string;
  port?: number;
  devicePath?: string;
  paperWidth: 58 | 80; // mm
}

export interface PrintJob {
  id: string;
  printerId: string;
  template: string;
  data: Record<string, any>;
  priority: "high" | "normal" | "low";
  createdAt: Date;
  status: "pending" | "printing" | "completed" | "failed";
  error?: string;
}

export interface PrinterAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  print(job: PrintJob): Promise<void>;
  isConnected(): boolean;
  testPrint(): Promise<void>;
}

export interface ReceiptData {
  receiptNumber: string;
  storeName: string;
  storeAddress: string;
  storePhone: string;
  vatNumber: string;
  dateTime: string;
  employeeName: string;
  lines: Array<{
    name: string;
    quantity: number;
    price: number;
    total: number;
    modifiers?: string[];
    notes?: string;
  }>;
  subtotal: number;
  discounts: number;
  tax: number;
  total: number;
  payments: Array<{
    method: string;
    amount: number;
  }>;
  change?: number;
  footerText?: string;
  customerCopy?: boolean;
}

export interface KitchenTicketData {
  ticketNumber: string;
  orderTime: string;
  diningOption: "eat-in" | "takeaway";
  customerName?: string;
  tableNumber?: string;
  items: Array<{
    name: string;
    quantity: number;
    modifiers?: string[];
    notes?: string;
  }>;
}
