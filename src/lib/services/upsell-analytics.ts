/**
 * Upsell Analytics Service
 * Tracks upsell suggestion effectiveness
 */

interface UpsellAnalyticsEvent {
  org_id: string;
  store_id?: string;
  register_id?: string;
  member_id?: string;
  trigger_item_id: string;
  trigger_item_name: string;
  suggested_item_id: string;
  suggested_item_name: string;
  suggestion_reason: string;
  action: 'shown' | 'accepted' | 'dismissed' | 'auto_dismissed';
  receipt_id?: string;
}

export class UpsellAnalyticsService {
  /**
   * Track when upsell suggestions are shown
   */
  async trackShown(
    orgId: string,
    triggerItem: { id: string; name: string },
    suggestions: Array<{ id: string; name: string; suggestion_reason: string }>,
    memberId?: string
  ): Promise<void> {
    try {
      const events = suggestions.map((suggestion) => ({
        org_id: orgId,
        member_id: memberId,
        trigger_item_id: triggerItem.id,
        trigger_item_name: triggerItem.name,
        suggested_item_id: suggestion.id,
        suggested_item_name: suggestion.name,
        suggestion_reason: suggestion.suggestion_reason,
        action: 'shown' as const,
      }));

      await this.sendEvents(events);
    } catch (err) {
      console.error('[UpsellAnalytics] Failed to track shown:', err);
    }
  }

  /**
   * Track when a suggestion is accepted
   */
  async trackAccepted(
    orgId: string,
    triggerItem: { id: string; name: string },
    acceptedItem: { id: string; name: string; suggestion_reason: string },
    memberId?: string,
    receiptId?: string
  ): Promise<void> {
    try {
      const event: UpsellAnalyticsEvent = {
        org_id: orgId,
        member_id: memberId,
        trigger_item_id: triggerItem.id,
        trigger_item_name: triggerItem.name,
        suggested_item_id: acceptedItem.id,
        suggested_item_name: acceptedItem.name,
        suggestion_reason: acceptedItem.suggestion_reason,
        action: 'accepted',
        receipt_id: receiptId,
      };

      await this.sendEvents([event]);
    } catch (err) {
      console.error('[UpsellAnalytics] Failed to track accepted:', err);
    }
  }

  /**
   * Track when suggestions are dismissed
   */
  async trackDismissed(
    orgId: string,
    triggerItem: { id: string; name: string },
    suggestions: Array<{ id: string; name: string; suggestion_reason: string }>,
    isAuto: boolean,
    memberId?: string
  ): Promise<void> {
    try {
      const action = isAuto ? 'auto_dismissed' : 'dismissed';
      const events = suggestions.map((suggestion) => ({
        org_id: orgId,
        member_id: memberId,
        trigger_item_id: triggerItem.id,
        trigger_item_name: triggerItem.name,
        suggested_item_id: suggestion.id,
        suggested_item_name: suggestion.name,
        suggestion_reason: suggestion.suggestion_reason,
        action: action as 'dismissed' | 'auto_dismissed',
      }));

      await this.sendEvents(events);
    } catch (err) {
      console.error('[UpsellAnalytics] Failed to track dismissed:', err);
    }
  }

  /**
   * Send analytics events to API
   */
  private async sendEvents(events: UpsellAnalyticsEvent[]): Promise<void> {
    try {
      // Send to API endpoint (will be created)
      const response = await fetch('/api/analytics/upsell', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ events }),
      });

      if (!response.ok) {
        throw new Error('Failed to send analytics events');
      }

      console.log(`[UpsellAnalytics] Tracked ${events.length} events`);
    } catch (err) {
      // Don't throw - analytics failures shouldn't break the app
      console.error('[UpsellAnalytics] Failed to send events:', err);
    }
  }

  /**
   * Batch events in localStorage for offline support (future enhancement)
   */
  private queueEvent(event: UpsellAnalyticsEvent): void {
    try {
      const queue = this.getQueue();
      queue.push(event);
      localStorage.setItem('pos_analytics_queue', JSON.stringify(queue));
    } catch (err) {
      console.error('[UpsellAnalytics] Failed to queue event:', err);
    }
  }

  private getQueue(): UpsellAnalyticsEvent[] {
    try {
      const stored = localStorage.getItem('pos_analytics_queue');
      return stored ? JSON.parse(stored) : [];
    } catch (err) {
      return [];
    }
  }

  /**
   * Flush queued events (future enhancement)
   */
  async flushQueue(): Promise<void> {
    const queue = this.getQueue();
    if (queue.length === 0) return;

    try {
      await this.sendEvents(queue);
      localStorage.removeItem('pos_analytics_queue');
    } catch (err) {
      console.error('[UpsellAnalytics] Failed to flush queue:', err);
    }
  }
}

// Export singleton instance
export const upsellAnalytics = new UpsellAnalyticsService();
