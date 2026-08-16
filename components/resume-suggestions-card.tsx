"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sprout } from "lucide-react";
import type { Priority, ResumeSuggestion } from "@/lib/types";

const PRIORITY_LABEL: Record<Priority, string> = {
  high: "优先",
  medium: "建议",
  low: "可选",
};

const PRIORITY_CLASS: Record<Priority, string> = {
  high: "bg-clay text-clay-deep hover:bg-clay",
  medium: "bg-sand text-sand-deep hover:bg-sand",
  low: "bg-sprout text-leaf hover:bg-sprout",
};

export function ResumeSuggestionsCard({
  suggestions,
}: {
  suggestions: ResumeSuggestion[];
}) {
  if (suggestions.length === 0) return null;

  return (
    <Card className="rounded-2xl border-line">
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sprout text-leaf">
            <Sprout className="size-4" />
          </div>
          <div>
            <CardTitle className="text-base font-bold">简历优化建议</CardTitle>
            <p className="text-[13px] text-moss">按优先级排序，可直接动手修改</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {suggestions.map((s, i) => (
          <div
            key={i}
            className="flex gap-3.5 rounded-xl border border-line p-4 text-sm transition-colors hover:border-mint-soft hover:shadow-[0_8px_20px_-12px_rgba(30,122,87,0.25)]"
          >
            <span className="mt-0.5 flex size-6.5 shrink-0 items-center justify-center rounded-full bg-sprout font-display text-[12.5px] font-extrabold text-leaf">
              {i + 1}
            </span>
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge
                  variant="secondary"
                  className="bg-frost text-frost-deep hover:bg-frost"
                >
                  {s.category || "其他"}
                </Badge>
                <Badge className={PRIORITY_CLASS[s.priority]}>
                  {PRIORITY_LABEL[s.priority]}
                </Badge>
              </div>
              <p className="leading-relaxed text-moss">{s.suggestion}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
