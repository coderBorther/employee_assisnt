"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CopyButton } from "@/components/copy-button";
import { ChevronDown, MessagesSquare } from "lucide-react";
import type { InterviewQuestion } from "@/lib/types";

export function InterviewQuestionsCard({
  questions,
}: {
  questions: InterviewQuestion[];
}) {
  if (questions.length === 0) return null;

  return (
    <Card className="rounded-2xl border-line">
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sprout text-leaf">
            <MessagesSquare className="size-4" />
          </div>
          <div>
            <CardTitle className="text-base font-bold">
              面试问题与参考回答（{questions.length} 题）
            </CardTitle>
            <p className="text-[13px] text-moss">点击展开查看参考回答</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {questions.map((q, i) => (
          <details
            key={i}
            className="group overflow-hidden rounded-xl border border-line bg-card transition-colors open:border-mint-soft"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-3 text-sm font-semibold">
                <span className="flex size-6.5 shrink-0 items-center justify-center rounded-full bg-sprout font-display text-[12.5px] font-extrabold text-leaf">
                  {i + 1}
                </span>
                {q.question}
              </span>
              <ChevronDown className="size-4 shrink-0 text-moss-light transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t border-dashed border-line bg-[#fbfefc] px-5 py-4 pl-[3.75rem]">
              <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-moss">
                {q.referenceAnswer}
              </p>
              <CopyButton
                text={`${q.question}\n\n${q.referenceAnswer}`}
                label="复制问答"
              />
            </div>
          </details>
        ))}
      </CardContent>
    </Card>
  );
}
