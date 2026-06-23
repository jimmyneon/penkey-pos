/**
 * Staff-Friendly Targets System
 *
 * Replaces monetary targets with tangible, achievable goals that staff can directly influence.
 * Staff can't control how much money comes in, but they CAN control:
 * - How many upsells they do
 * - What % of tickets include food (wet mix)
 * - How many customers they serve
 * - How many Google reviews they prompt
 */

export interface StaffTarget {
  id: string;
  label: string;
  description: string;
  daily: number;
  weekly: number;
  monthly: number;
  unit: string;
  icon: string;
}

export const STAFF_TARGETS: StaffTarget[] = [
  {
    id: 'upsells',
    label: 'Upsells',
    description: 'Items you suggested that the customer added',
    daily: 10,
    weekly: 50,
    monthly: 200,
    unit: ' upsells',
    icon: 'sparkles',
  },
  {
    id: 'wet_mix',
    label: 'Wet Mix %',
    description: 'Tickets that include food (not just drinks)',
    daily: 40,
    weekly: 40,
    monthly: 40,
    unit: '%',
    icon: 'utensils',
  },
  {
    id: 'tickets',
    label: 'Tickets Served',
    description: 'Number of customers you served',
    daily: 30,
    weekly: 150,
    monthly: 600,
    unit: ' tickets',
    icon: 'receipt',
  },
  {
    id: 'reviews',
    label: 'Review Mentions',
    description: 'Times you asked customers to leave a Google review',
    daily: 5,
    weekly: 25,
    monthly: 100,
    unit: ' mentions',
    icon: 'star',
  },
];

export interface StaffTargetProgress {
  targetId: string;
  label: string;
  description: string;
  current: number;
  goal: number;
  unit: string;
  icon: string;
  percentage: number;
  achieved: boolean;
}

export function getStaffTargetsForPeriod(
  period: 'today' | 'yesterday' | 'last7days' | 'month' | 'year' | 'alltime' | 'custom',
  customDays: number = 30,
): Omit<StaffTargetProgress, 'current' | 'percentage' | 'achieved'>[] {
  const periodKey = period === 'today' || period === 'yesterday' ? 'daily'
    : period === 'last7days' ? 'weekly'
    : period === 'month' ? 'monthly'
    : period === 'year' ? 'monthly'
    : period === 'alltime' ? 'monthly'
    : customDays <= 1 ? 'daily'
    : customDays <= 7 ? 'weekly'
    : 'monthly';

  return STAFF_TARGETS.map(t => ({
    targetId: t.id,
    label: t.label,
    description: t.description,
    goal: t[periodKey],
    unit: t.unit,
    icon: t.icon,
  }));
}

export function calculateTargetProgress(
  targets: Omit<StaffTargetProgress, 'current' | 'percentage' | 'achieved'>[],
  metrics: {
    upsellCount: number;
    wetMixPercentage: number;
    ticketCount: number;
    reviewMentions: number;
  },
): StaffTargetProgress[] {
  const valueMap: Record<string, number> = {
    upsells: metrics.upsellCount,
    wet_mix: metrics.wetMixPercentage,
    tickets: metrics.ticketCount,
    reviews: metrics.reviewMentions,
  };

  return targets.map(t => {
    const current = valueMap[t.targetId] || 0;
    const percentage = t.goal > 0 ? Math.min((current / t.goal) * 100, 100) : 0;
    return {
      ...t,
      current,
      percentage,
      achieved: current >= t.goal,
    };
  });
}
