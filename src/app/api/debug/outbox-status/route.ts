import { NextRequest, NextResponse } from "next/server";
import { validatePOSSession, unauthorizedResponse } from "@/lib/api/auth";

// Debug endpoint to check outbox sync status
export async function GET(request: NextRequest) {
  const session = await validatePOSSession(request);
  if (!session) {
    return unauthorizedResponse();
  }

  // This endpoint just returns instructions since we can't access IndexedDB from server
  return NextResponse.json({
    message: "Check browser console for outbox status",
    instructions: [
      "Open browser DevTools → Console",
      "Run: OutboxSyncService.getOutboxCount()",
      "Run: OutboxSyncService.getPendingItems()",
      "Run: OutboxSyncService.getFailedItems()",
      "To manually trigger sync: OutboxSyncService.syncOutbox()",
      "To retry failed: OutboxSyncService.retryFailedItems()"
    ]
  });
}
