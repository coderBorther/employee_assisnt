"use client";

import { Textarea } from "@/components/ui/textarea";

const MAX_JOB_DESCRIPTION_LENGTH = 8000;

interface JobDescriptionInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function JobDescriptionInput({
  value,
  onChange,
}: JobDescriptionInputProps) {
  return (
    <div className="flex flex-col space-y-2">
      <div className="flex items-center justify-between">
        <label htmlFor="job-description" className="text-[13.5px] font-semibold">
          目标岗位描述
        </label>
        <span className="font-mono text-[11px] tracking-wide tabular-nums text-moss-light">
          {value.length}/{MAX_JOB_DESCRIPTION_LENGTH}
        </span>
      </div>
      <Textarea
        id="job-description"
        value={value}
        onChange={(e) =>
          onChange(e.target.value.slice(0, MAX_JOB_DESCRIPTION_LENGTH))
        }
        placeholder="粘贴目标岗位的职位描述（JD）…"
        rows={8}
        className="min-h-[216px] flex-1 resize-y rounded-2xl border-[1.5px] border-line bg-card px-4 py-3.5 text-[14px] leading-[1.8] placeholder:text-moss-light focus-visible:border-mint focus-visible:ring-4 focus-visible:ring-mint/15"
      />
    </div>
  );
}
