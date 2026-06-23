"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, Circle, Star, Gift, Coffee, UtensilsCrossed, X, ChevronDown, ChevronUp } from "lucide-react";

interface CheckoutReminder {
  id: string;
  icon: React.ReactNode;
  script: string;
  description: string;
}

interface CartLine {
  item_id: string;
  item_name: string;
  category_id?: string;
}

interface CheckoutRemindersProps {
  cartLines: CartLine[];
  hasPerksCustomer: boolean;
  orgId?: string;
  memberId?: string;
}

export function CheckoutReminders({
  cartLines,
  hasPerksCustomer,
  orgId,
  memberId,
}: CheckoutRemindersProps) {
  const [dismissed, setDismissed] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [isExpanded, setIsExpanded] = useState(true);

  // Reset when cart changes
  useEffect(() => {
    setDismissed(false);
    setCheckedItems(new Set());
    setIsExpanded(true);
  }, [cartLines.length]);

  if (dismissed) return null;

  const hasDrink = cartLines.some(line => {
    const name = (line.item_name || '').toLowerCase();
    return name.includes('coffee') || name.includes('latte') || name.includes('americano') ||
      name.includes('cappuccino') || name.includes('flat white') || name.includes('tea') ||
      name.includes('espresso') || name.includes('mocha') || name.includes('juice') ||
      name.includes('smoothie') || name.includes('cola') || name.includes('water');
  });

  const hasFood = cartLines.some(line => {
    const name = (line.item_name || '').toLowerCase();
    return name.includes('sandwich') || name.includes('panini') || name.includes('toastie') ||
      name.includes('wrap') || name.includes('salad') || name.includes('breakfast') ||
      name.includes('lunch') || name.includes('roll') || name.includes('soup');
  });

  const hasSweet = cartLines.some(line => {
    const name = (line.item_name || '').toLowerCase();
    return name.includes('cake') || name.includes('brownie') || name.includes('cookie') ||
      name.includes('flapjack') || name.includes('muffin') || name.includes('scone') ||
      name.includes('biscuit') || name.includes('pastry');
  });

  const reminders: CheckoutReminder[] = [];

  if (hasDrink && !hasFood && !hasSweet) {
    reminders.push({
      id: 'upsell-food',
      icon: <UtensilsCrossed className="h-5 w-5" />,
      script: "Would you like something to eat with your drink?",
      description: "Customer only has a drink - suggest food or a sweet treat",
    });
  }

  if (hasFood && !hasDrink) {
    reminders.push({
      id: 'upsell-drink',
      icon: <Coffee className="h-5 w-5" />,
      script: "Would you like a drink with that?",
      description: "Customer has food but no drink",
    });
  }

  if (!hasPerksCustomer) {
    reminders.push({
      id: 'perks',
      icon: <Gift className="h-5 w-5" />,
      script: "Do you have a Penkey rewards card?",
      description: "Ask before processing payment - scan their QR code",
    });
  }

  reminders.push({
    id: 'review',
    icon: <Star className="h-5 w-5" />,
    script: "After payment: Point out the review QR code on screen",
    description: "Ask them to leave a Google review - it really helps us!",
  });

  const toggleCheck = (id: string) => {
    const next = new Set(checkedItems);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setCheckedItems(next);
  };

  const allChecked = checkedItems.size === reminders.length;

  return (
    <div className={`rounded-xl border-2 transition-all ${
      allChecked
        ? 'bg-green-500/10 border-green-500/50'
        : 'bg-penkey-orange/10 border-penkey-orange/40'
    }`}>
      {/* Header */}
      <div
        className="flex items-center justify-between p-3 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          {allChecked ? (
            <CheckCircle2 className="h-5 w-5 text-green-400" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-penkey-orange" />
          )}
          <span className={`font-semibold text-sm ${
            allChecked ? 'text-green-400' : 'text-penkey-orange'
          }`}>
            {allChecked
              ? 'All done! Great service!'
              : `Before you charge: ${reminders.length - checkedItems.size} reminders left`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDismissed(true);
            }}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronUp className="h-4 w-4 text-gray-400" />
          )}
        </div>
      </div>

      {/* Reminder Items */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-2">
          {reminders.map((reminder) => {
            const isChecked = checkedItems.has(reminder.id);
            return (
              <button
                key={reminder.id}
                onClick={() => toggleCheck(reminder.id)}
                className={`w-full flex items-start gap-3 p-3 rounded-lg transition-all text-left ${
                  isChecked
                    ? 'bg-green-500/10 border border-green-500/30'
                    : 'bg-[#3d3d3d] border border-gray-700 hover:border-gray-600'
                }`}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {isChecked ? (
                    <CheckCircle2 className="h-5 w-5 text-green-400" />
                  ) : (
                    <Circle className="h-5 w-5 text-gray-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={isChecked ? 'text-green-400' : 'text-white'}>
                      {reminder.icon}
                    </span>
                    <p className={`font-semibold text-sm ${
                      isChecked ? 'text-green-400 line-through' : 'text-white'
                    }`}>
                      &ldquo;{reminder.script}&rdquo;
                    </p>
                  </div>
                  <p className="text-xs text-gray-400">
                    {reminder.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
