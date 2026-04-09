/**
 * usePrintJobs hook
 * Manages print job state and real-time updates
 */

import { useState, useEffect, useCallback } from "react";
import type { PrintJob } from "@penkey/database";

interface UsePrintJobsOptions {
  printer_id?: string;
  status?: PrintJob["status"];
  limit?: number;
}

export function usePrintJobs(options: UsePrintJobsOptions = {}) {
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (options.printer_id) params.set("printer_id", options.printer_id);
      if (options.status) params.set("status", options.status);
      if (options.limit) params.set("limit", options.limit.toString());

      const response = await fetch(`/api/print-jobs?${params}`);
      if (!response.ok) throw new Error("Failed to fetch print jobs");

      const data = await response.json();
      setJobs(data.jobs || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [options.printer_id, options.status, options.limit]);

  const retryJob = useCallback(async (jobId: string) => {
    try {
      const response = await fetch("/api/print-jobs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: jobId, action: "retry" }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to retry job");
      }

      await fetchJobs();
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, [fetchJobs]);

  const cancelJob = useCallback(async (jobId: string) => {
    try {
      const response = await fetch("/api/print-jobs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: jobId, action: "cancel" }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to cancel job");
      }

      await fetchJobs();
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, [fetchJobs]);

  useEffect(() => {
    fetchJobs();
    
    // Auto-refresh every 5 seconds
    const interval = setInterval(fetchJobs, 5000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  return {
    jobs,
    loading,
    error,
    refresh: fetchJobs,
    retryJob,
    cancelJob,
  };
}
