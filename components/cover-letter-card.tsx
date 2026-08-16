"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CopyButton } from "@/components/copy-button";
import { FileText } from "lucide-react";

export function CoverLetterCard({ text }: { text: string }) {
  if (!text) return null;

  return (
    <Card className="rounded-2xl border-line">
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sprout text-leaf">
            <FileText className="size-4" />
          </div>
          <div>
            <CardTitle className="text-base font-bold">求职信</CardTitle>
            <p className="text-[13px] text-moss">紧扣岗位描述与简历亮点，可直接复制</p>
          </div>
        </div>
        <CopyButton text={text} label="复制求职信" />
      </CardHeader>
      <CardContent>
        <div className="whitespace-pre-wrap rounded-2xl border border-line bg-linear-to-b from-[#fcfefd] to-[#f4faf6] px-6 py-5 text-sm leading-8 text-moss">
          {text}
        </div>
      </CardContent>
    </Card>
  );
}
