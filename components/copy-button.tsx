"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";

interface CopyButtonProps {
  text: string;
  label?: string;
}

export function CopyButton({ text, label = "复制" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-8 rounded-full border border-sprout-deep bg-sprout text-xs font-semibold text-leaf hover:bg-sprout-deep hover:text-leaf-deep"
      onClick={handleCopy}
    >
      {copied ? (
        <Check className="size-3.5 text-leaf" />
      ) : (
        <Copy className="size-3.5" />
      )}
      {copied ? "已复制" : label}
    </Button>
  );
}
