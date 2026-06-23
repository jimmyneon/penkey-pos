/**
 * usePrinters hook
 * Manages printer state and real-time updates
 */

import { useState, useEffect, useCallback } from "react";
import type { Printer, PrintJob } from "@penkey/database";

interface PrinterWithJobs extends Printer {
  jobs?: PrintJob[];
}

interface UsePrintersOptions {
  register_id?: string;
  status?: Printer["status"];
  includeJobs?: boolean;
}

export function usePrinters(options: UsePrintersOptions = {}) {
  const [printers, setPrinters] = useState<PrinterWithJobs[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPrinters = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (options.register_id) params.set("register_id", options.register_id);
      if (options.status) params.set("status", options.status);

      const response = await fetch(`/api/printers?${params}`);
      if (!response.ok) throw new Error("Failed to fetch printers");

      const data = await response.json();
      setPrinters(data.printers || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [options.register_id, options.status]);

  const createPrinter = useCallback(
    async (config: {
      name: string;
      type: Printer["type"];
      connection_type: Printer["connection_type"];
      ip_address?: string;
      port?: number;
      device_path?: string;
      cups_printer_name?: string;
      paper_width: 58 | 80;
      location?: string;
      register_id?: string;
      store_id?: string;
    }) => {
      try {
        const response = await fetch("/api/printers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(config),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to create printer");
        }

        const data = await response.json();
        await fetchPrinters();
        return data.printer;
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [fetchPrinters]
  );

  const updatePrinter = useCallback(
    async (printerId: string, updates: Partial<Printer>) => {
      try {
        const response = await fetch("/api/printers", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ printer_id: printerId, updates }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to update printer");
        }

        const data = await response.json();
        await fetchPrinters();
        return data.printer;
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [fetchPrinters]
  );

  const deletePrinter = useCallback(
    async (printerId: string) => {
      try {
        const response = await fetch(`/api/printers?id=${printerId}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to delete printer");
        }

        await fetchPrinters();
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [fetchPrinters]
  );

  const testPrinter = useCallback(
    async (printerId: string) => {
      try {
        const response = await fetch("/api/print-jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ printer_id: printerId }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to create test job");
        }

        const data = await response.json();
        return data.job;
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    []
  );

  useEffect(() => {
    fetchPrinters();
  }, [fetchPrinters]);

  return {
    printers,
    loading,
    error,
    refresh: fetchPrinters,
    createPrinter,
    updatePrinter,
    deletePrinter,
    testPrinter,
  };
}
