import React from "react";
import { Card, CardContent } from "./card";
import { cn } from "../lib/utils";

interface TrendCardProps {
  label: string;
  value: string;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
  sentiment?: "positive" | "negative" | "neutral";
  className?: string;
}

export function TrendCard({
  label,
  value,
  change,
  changeLabel,
  icon,
  sentiment = "neutral",
  className,
}: TrendCardProps) {
  const getSentimentEmoji = () => {
    if (change === undefined) return "📊";
    if (sentiment === "positive") return "🎉";
    if (sentiment === "negative") return "⚠️";
    return "📊";
  };

  const getSentimentText = () => {
    if (change === undefined) return "";
    if (sentiment === "positive") return "Going Great!";
    if (sentiment === "negative") return "Needs Attention";
    return "Steady";
  };

  return (
    <Card className={className}>
      <CardContent className="pt-6">
        <div className="space-y-2">
          {/* Label */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">{label}</p>
            {icon || <span className="text-xl">{getSentimentEmoji()}</span>}
          </div>

          {/* Value */}
          <p className="text-2xl font-bold text-penkey-navy">{value}</p>

          {/* Change indicator */}
          {change !== undefined && (
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "text-sm font-medium",
                  sentiment === "positive" && "text-green-600",
                  sentiment === "negative" && "text-red-600",
                  sentiment === "neutral" && "text-gray-600"
                )}
              >
                {change > 0 ? "↑" : change < 0 ? "↓" : "→"} {Math.abs(change)}%
              </span>
              <span className="text-xs text-gray-500">
                {changeLabel || getSentimentText()}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
