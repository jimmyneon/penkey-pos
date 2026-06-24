/**
 * Database Backup Email API
 * Collects all critical table data, gzips it, and emails it as an attachment.
 *
 * Triggered daily by an external cron service (e.g. cron-job.org).
 * Authenticated via BACKUP_SECRET env var to prevent unauthorized access.
 *
 * Usage: GET /api/backup/email?secret=YOUR_BACKUP_SECRET
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { collectBackupData } from "@/lib/services/backup-service";
import { gzipSync } from "zlib";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");

  const expectedSecret = process.env.BACKUP_SECRET;
  if (!expectedSecret) {
    return NextResponse.json(
      { error: "BACKUP_SECRET not configured" },
      { status: 500 }
    );
  }

  if (secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@rewards.penkey.co.uk";
  const replyTo = process.env.RESEND_REPLY_TO_EMAIL || "nfdrepairs@gmail.com";
  const backupEmail = process.env.BACKUP_EMAIL || "nfdrepairs@gmail.com";

  if (!resendApiKey) {
    return NextResponse.json(
      { error: "RESEND_API_KEY not configured" },
      { status: 500 }
    );
  }

  try {
    // 1. Collect all data
    const backup = await collectBackupData(supabaseUrl, supabaseKey);

    // 2. Convert to JSON and gzip
    const jsonStr = JSON.stringify(backup);
    const gzipped = gzipSync(jsonStr);
    const base64Content = gzipped.toString("base64");

    const dateStr = new Date().toISOString().split("T")[0];
    const sizeMB = (gzipped.length / 1024 / 1024).toFixed(2);

    // 3. Build summary table for email body
    const tableSummary = Object.entries(backup.tableCounts)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([table, count]) => `<tr><td>${table}</td><td style="text-align:right">${count}</td></tr>`)
      .join("");

    // 4. Send email with attachment
    const { Resend } = await import("resend");
    const resend = new Resend(resendApiKey);

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: fromEmail,
      replyTo,
      to: backupEmail,
      subject: `Database Backup — ${dateStr} (${backup.totalRows} rows, ${sizeMB} MB)`,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif; padding: 24px; color: #333;">
  <h2 style="color: #1a2847;">Database Backup — ${dateStr}</h2>
  <p>Automated backup of Penkey POS database.</p>
  <table style="border-collapse: collapse; margin: 16px 0;">
    <tr style="background: #1a2847; color: #fff;">
      <th style="padding: 8px 16px; text-align: left;">Table</th>
      <th style="padding: 8px 16px; text-align: right;">Rows</th>
    </tr>
    ${tableSummary}
    <tr style="font-weight: bold; border-top: 2px solid #1a2847;">
      <td style="padding: 8px 16px;">Total</td>
      <td style="padding: 8px 16px; text-align: right;">${backup.totalRows}</td>
    </tr>
  </table>
  <p style="color: #666; font-size: 13px;">
    Compressed size: ${sizeMB} MB<br/>
    Backup timestamp: ${backup.timestamp}<br/>
    Attachment: <code>backup-${dateStr}.json.gz</code>
  </p>
  <p style="color: #999; font-size: 12px; margin-top: 24px;">
    To restore: gunzip the file, then import the JSON into Supabase tables.
  </p>
</body>
</html>`,
      attachments: [
        {
          filename: `backup-${dateStr}.json.gz`,
          content: base64Content,
        },
      ],
    });

    if (emailError) {
      console.error("[Backup Email] Resend error:", emailError);
      return NextResponse.json(
        { error: `Email send failed: ${emailError.message}` },
        { status: 500 }
      );
    }

    console.log("[Backup Email] Sent successfully:", emailData?.id);
    return NextResponse.json({
      success: true,
      messageId: emailData?.id,
      totalRows: backup.totalRows,
      compressedSize: `${sizeMB} MB`,
    });
  } catch (error: any) {
    console.error("[Backup Email] Failed:", error);
    return NextResponse.json(
      { error: error.message || "Backup failed" },
      { status: 500 }
    );
  }
}
