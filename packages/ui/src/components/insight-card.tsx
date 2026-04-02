import React from "react";
import { Card, CardContent } from "./card";

interface InsightCardProps {
  title?: string;
  insights: string[];
  className?: string;
}

export function InsightCard({
  title = "Today's Story",
  insights,
  className,
}: InsightCardProps) {
  return (
    <Card className={className}>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Title */}
          <h3 className="text-lg font-semibold text-penkey-navy flex items-center gap-2">
            <span className="text-xl">💬</span>
            {title}
          </h3>

          {/* Insights */}
          <div className="space-y-3">
            {insights.map((insight, index) => (
              <p key={index} className="text-base text-gray-700 leading-relaxed">
                {insight}
              </p>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
