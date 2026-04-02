import React from "react";
import { Card, CardContent } from "./card";
import { cn } from "../lib/utils";

interface StoryCardProps {
  icon?: string;
  title: string;
  metric?: string;
  description?: string;
  comparison?: string;
  comparisonType?: "positive" | "negative" | "neutral";
  progress?: number;
  progressLabel?: string;
  tip?: string;
  className?: string;
}

export function StoryCard({
  icon,
  title,
  metric,
  description,
  comparison,
  comparisonType = "neutral",
  progress,
  progressLabel,
  tip,
  className,
}: StoryCardProps) {
  return (
    <Card className={cn("border-l-4 border-l-penkey-orange", className)}>
      <CardContent className="pt-6">
        <div className="space-y-3">
          {/* Title with icon */}
          <div className="flex items-center gap-2">
            {icon && <span className="text-2xl">{icon}</span>}
            <h3 className="text-lg font-semibold text-penkey-navy">{title}</h3>
          </div>

          {/* Main metric */}
          {metric && (
            <p className="text-3xl font-bold text-penkey-navy">{metric}</p>
          )}

          {/* Description */}
          {description && (
            <p className="text-base text-gray-700">{description}</p>
          )}

          {/* Comparison */}
          {comparison && (
            <p
              className={cn(
                "text-sm font-medium flex items-center gap-1",
                comparisonType === "positive" && "text-green-600",
                comparisonType === "negative" && "text-red-600",
                comparisonType === "neutral" && "text-gray-600"
              )}
            >
              {comparisonType === "positive" && "↑"}
              {comparisonType === "negative" && "↓"}
              {comparison}
            </p>
          )}

          {/* Progress bar */}
          {progress !== undefined && (
            <div className="space-y-1">
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-penkey-orange h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              {progressLabel && (
                <p className="text-xs text-gray-600">{progressLabel}</p>
              )}
            </div>
          )}

          {/* Tip */}
          {tip && (
            <div className="bg-penkey-cream/50 rounded-lg p-3 mt-3">
              <p className="text-sm text-penkey-navy flex items-start gap-2">
                <span className="text-base">💡</span>
                <span>{tip}</span>
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
