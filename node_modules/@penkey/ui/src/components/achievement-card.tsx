import React from "react";
import { Card, CardContent } from "./card";
import { cn } from "../lib/utils";

interface Achievement {
  done: boolean;
  text: string;
  icon?: string;
}

interface AchievementCardProps {
  title?: string;
  achievements: Achievement[];
  streak?: number;
  className?: string;
}

export function AchievementCard({
  title = "Today's Achievements",
  achievements,
  streak,
  className,
}: AchievementCardProps) {
  const completedCount = achievements.filter((a) => a.done).length;
  const totalCount = achievements.length;
  const progressPercent = (completedCount / totalCount) * 100;

  return (
    <Card className={className}>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Title */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-penkey-navy flex items-center gap-2">
              <span className="text-xl">🏆</span>
              {title}
            </h3>
            <span className="text-sm text-gray-600">
              {completedCount}/{totalCount}
            </span>
          </div>

          {/* Achievements list */}
          <div className="space-y-2">
            {achievements.map((achievement, index) => (
              <div
                key={index}
                className={cn(
                  "flex items-center gap-3 p-2 rounded-lg transition-colors",
                  achievement.done && "bg-green-50"
                )}
              >
                <span className="text-xl">
                  {achievement.done ? "✅" : "⬜"}
                </span>
                <span
                  className={cn(
                    "text-sm",
                    achievement.done
                      ? "text-penkey-navy font-medium"
                      : "text-gray-500"
                  )}
                >
                  {achievement.text}
                </span>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div className="space-y-1">
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-green-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Streak */}
          {streak !== undefined && streak > 0 && (
            <div className="bg-orange-50 rounded-lg p-3 flex items-center justify-center gap-2">
              <span className="text-lg">🔥</span>
              <span className="text-sm font-semibold text-penkey-orange">
                {streak} day{streak !== 1 ? "s" : ""} streak!
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
