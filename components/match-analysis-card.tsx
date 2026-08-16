"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Gauge } from "lucide-react";
import type { MatchAnalysis } from "@/lib/types";

const RING_RADIUS = 54;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function scoreTone(score: number): { text: string; bar: string } {
  if (score >= 75)
    return { text: "text-leaf", bar: "bg-linear-to-r from-mint to-leaf" };
  if (score >= 50)
    return {
      text: "text-sand-deep",
      bar: "bg-linear-to-r from-[#f2c879] to-[#d99a2b]",
    };
  return {
    text: "text-clay-deep",
    bar: "bg-linear-to-r from-[#f0a79f] to-[#c2544f]",
  };
}

function scoreVerdict(score: number): string {
  if (score >= 75) return "匹配度良好，是一份值得投递的组合";
  if (score >= 50) return "匹配度中等，建议优化后再投递";
  return "匹配度偏低，建议针对差距重点补齐";
}

function ScoreRing({ value, tone }: { value: number; tone: string }) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimated(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const clamped = Math.max(0, Math.min(100, value));
  const dashOffset = animated
    ? RING_CIRCUMFERENCE * (1 - clamped / 100)
    : RING_CIRCUMFERENCE;

  return (
    <div className="relative size-32 shrink-0">
      <svg width="128" height="128" viewBox="0 0 128 128" className="size-32">
        <defs>
          <linearGradient id="scoreRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6EC7A4" />
            <stop offset="100%" stopColor="#1E7A57" />
          </linearGradient>
        </defs>
        <circle
          cx="64"
          cy="64"
          r={RING_RADIUS}
          fill="none"
          strokeWidth="11"
          className="stroke-sprout"
        />
        <circle
          cx="64"
          cy="64"
          r={RING_RADIUS}
          fill="none"
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          className="stroke-[url(#scoreRingGrad)] transition-[stroke-dashoffset] duration-1000 ease-[cubic-bezier(.22,1,.36,1)]"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`font-display text-[38px] leading-none font-extrabold ${tone}`}>
          {clamped}
        </span>
        <span className="mt-1 text-[10.5px] tracking-[0.08em] text-moss">
          综合匹配度
        </span>
      </div>
    </div>
  );
}

function ScoreBar({
  value,
  barClass,
  className = "",
}: {
  value: number;
  barClass: string;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      className={`h-2.5 w-full overflow-hidden rounded-full bg-sprout ${className}`}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-full transition-all ${barClass}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export function MatchAnalysisCard({ data }: { data: MatchAnalysis }) {
  const tone = scoreTone(data.totalScore);

  return (
    <Card className="rounded-2xl border-line">
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sprout text-leaf">
            <Gauge className="size-4" />
          </div>
          <div>
            <CardTitle className="text-base font-bold">岗位匹配度分析</CardTitle>
            <p className="text-[13px] text-moss">
              基于简历与目标 JD 的综合评估
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <ScoreRing value={data.totalScore} tone={tone.text} />
          <div className="min-w-0 flex-1">
            <div className={`text-[15px] font-bold ${tone.text}`}>
              {scoreVerdict(data.totalScore)}
            </div>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-moss">
              综合技能、项目经验、学历资质与 JD 关键词覆盖情况给出整体评估，
              可结合下方维度评分与文字分析针对性优化。
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full border border-sprout-deep bg-sprout px-3 py-1 text-xs font-semibold text-leaf">
                技能匹配
              </span>
              <span className="rounded-full border border-sprout-deep bg-sprout px-3 py-1 text-xs font-semibold text-leaf">
                经验对口
              </span>
              <span className="rounded-full border border-sprout-deep bg-sprout px-3 py-1 text-xs font-semibold text-leaf">
                建议微调
              </span>
            </div>
          </div>
        </div>

        {data.dimensions.length > 0 && (
          <div className="space-y-4">
            <Separator className="bg-line" />
            {data.dimensions.map((d, i) => {
              const t = scoreTone(d.score);
              return (
                <div key={i} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{d.name}</span>
                    <span className={`font-display font-bold tabular-nums ${t.text}`}>
                      {d.score}
                    </span>
                  </div>
                  <ScoreBar value={d.score} barClass={t.bar} />
                  {d.comment && (
                    <p className="text-xs leading-relaxed text-moss">
                      {d.comment}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {(data.summary || data.gapAnalysis) && (
          <div className="space-y-3">
            <Separator className="bg-line" />
            <div className="grid gap-4 lg:grid-cols-2">
              {data.summary && (
                <div className="rounded-2xl border border-sprout-deep bg-linear-to-b from-[#fbfefc] to-sprout p-5">
                  <h3 className="mb-2 flex items-center gap-2 text-[13.5px] font-bold">
                    <span className="text-leaf">☀</span>
                    总体分析
                  </h3>
                  <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-moss">
                    {data.summary}
                  </p>
                </div>
              )}
              {data.gapAnalysis && (
                <div className="rounded-2xl border border-sprout-deep bg-linear-to-b from-[#fbfefc] to-sprout p-5">
                  <h3 className="mb-2 flex items-center gap-2 text-[13.5px] font-bold">
                    <span className="text-leaf">◐</span>
                    差距与建议
                  </h3>
                  <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-moss">
                    {data.gapAnalysis}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
