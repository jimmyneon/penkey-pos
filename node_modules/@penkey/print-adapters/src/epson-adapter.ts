import type { PrinterAdapter, PrintJob, PrinterConfig } from "./types";

/**
 * Epson TM-series printer adapter using ePOS-Print API
 * Supports network printing over LAN (HTTP/WebSocket)
 */
export class EpsonAdapter implements PrinterAdapter {
  private config: PrinterConfig;
  private connected: boolean = false;
  private eposDevice: any = null;

  constructor(config: PrinterConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    if (!this.config.ipAddress) {
      throw new Error("IP address is required for Epson LAN printer");
    }

    try {
      // In browser environment, use ePOS-Print JavaScript API
      if (typeof window !== "undefined" && (window as any).epson) {
        const epson = (window as any).epson;
        const eposBuilder = new epson.ePOSBuilder();
        
        this.eposDevice = new epson.ePOSDevice();
        
        await new Promise<void>((resolve, reject) => {
          this.eposDevice.connect(
            this.config.ipAddress,
            this.config.port || 8008,
            (data: any) => {
              if (data === "OK" || data === "SSL_CONNECT_OK") {
                this.connected = true;
                resolve();
              } else {
                reject(new Error(`Connection failed: ${data}`));
              }
            }
          );
        });
      } else {
        // Server-side or Print Bridge: use HTTP API
        const response = await fetch(
          `http://${this.config.ipAddress}:${this.config.port || 8008}/cgi-bin/epos/service.cgi?devid=local_printer&timeout=10000`,
          { method: "GET" }
        );
        
        if (response.ok) {
          this.connected = true;
        } else {
          throw new Error(`Failed to connect: ${response.statusText}`);
        }
      }
    } catch (error) {
      this.connected = false;
      throw new Error(`Epson printer connection failed: ${error}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.eposDevice) {
      this.eposDevice.disconnect();
      this.eposDevice = null;
    }
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async print(job: PrintJob): Promise<void> {
    if (!this.connected) {
      throw new Error("Printer not connected");
    }

    try {
      // Build ESC/POS commands from template
      const commands = this.buildPrintCommands(job.template, job.data);
      
      if (typeof window !== "undefined" && (window as any).epson) {
        // Browser: use ePOS-Print API
        await this.printViaBrowser(commands);
      } else {
        // Server/Bridge: use HTTP API
        await this.printViaHttp(commands);
      }
    } catch (error) {
      throw new Error(`Print failed: ${error}`);
    }
  }

  async testPrint(): Promise<void> {
    const testJob: PrintJob = {
      id: "test",
      printerId: this.config.id,
      template: "test",
      data: {
        storeName: "Penkey Délicaf & Gifts",
        dateTime: new Date().toLocaleString("en-GB"),
      },
      priority: "normal",
      createdAt: new Date(),
      status: "pending",
    };

    await this.print(testJob);
  }

  private buildPrintCommands(template: string, data: Record<string, any>): string {
    // This will be enhanced with Handlebars templates
    // For now, return basic ESC/POS commands
    
    let commands = "";
    
    // Initialize
    commands += "\x1B\x40"; // ESC @ - Initialize printer
    
    // Set alignment center
    commands += "\x1B\x61\x01"; // ESC a 1
    
    // Print store name (bold, double size)
    commands += "\x1B\x45\x01"; // ESC E 1 - Bold on
    commands += "\x1D\x21\x11"; // GS ! 17 - Double size
    commands += (data.storeName || "Penkey") + "\n";
    commands += "\x1B\x45\x00"; // ESC E 0 - Bold off
    commands += "\x1D\x21\x00"; // GS ! 0 - Normal size
    
    // Print date/time
    commands += data.dateTime + "\n";
    
    // Line separator
    commands += "\x1B\x61\x00"; // ESC a 0 - Left align
    commands += "--------------------------------\n";
    
    // Print items (this will be template-driven)
    if (data.lines) {
      data.lines.forEach((line: any) => {
        commands += `${line.name}\n`;
        commands += `  ${line.quantity} x £${line.price.toFixed(2)} = £${line.total.toFixed(2)}\n`;
      });
    }
    
    commands += "--------------------------------\n";
    
    // Print totals
    if (data.total) {
      commands += `TOTAL: £${data.total.toFixed(2)}\n`;
    }
    
    // Cut paper
    commands += "\n\n\n";
    commands += "\x1D\x56\x00"; // GS V 0 - Full cut
    
    return commands;
  }

  private async printViaBrowser(commands: string): Promise<void> {
    // Implementation for browser-based ePOS-Print
    // This requires the Epson ePOS-Print JavaScript library
    return new Promise((resolve, reject) => {
      if (!this.eposDevice) {
        reject(new Error("Device not initialized"));
        return;
      }

      const printer = this.eposDevice.createDevice(
        "local_printer",
        this.eposDevice.DEVICE_TYPE_PRINTER,
        { crypto: false, buffer: false },
        (data: any, code: any) => {
          if (code === "OK") {
            resolve();
          } else {
            reject(new Error(`Print failed: ${code}`));
          }
        }
      );

      printer.send(commands);
    });
  }

  private async printViaHttp(commands: string): Promise<void> {
    // Implementation for HTTP-based printing (server-side or Print Bridge)
    const url = `http://${this.config.ipAddress}:${this.config.port || 8008}/cgi-bin/epos/service.cgi?devid=local_printer&timeout=10000`;
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
      },
      body: this.buildXmlRequest(commands),
    });

    if (!response.ok) {
      throw new Error(`HTTP print failed: ${response.statusText}`);
    }
  }

  private buildXmlRequest(commands: string): string {
    // Build ePOS-Print XML request
    const base64Commands = Buffer.from(commands, "binary").toString("base64");
    
    return `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Body>
    <epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print">
      <text>${base64Commands}</text>
      <cut type="feed"/>
    </epos-print>
  </s:Body>
</s:Envelope>`;
  }
}
