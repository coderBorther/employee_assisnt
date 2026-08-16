"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  FileCheck2,
  FileUp,
  FileWarning,
  Loader2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { validatePdfFile } from "@/lib/pdf";

export interface OcrProgressInfo {
  currentPage: number;
  totalPages: number;
}

interface ResumeUploadProps {
  fileName: string;
  isExtracting: boolean;
  extractError: string | null;
  resumeText: string;
  ocrActive: boolean;
  ocrProgress: OcrProgressInfo | null;
  onFileSelected: (file: File) => void;
  onClear: () => void;
}

export function ResumeUpload({
  fileName,
  isExtracting,
  extractError,
  resumeText,
  ocrActive,
  ocrProgress,
  onFileSelected,
  onClear,
}: ResumeUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const [invalid, setInvalid] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [lastPick, setLastPick] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFile = useCallback(
    (file?: File | null) => {
      if (!file) return;
      const err = validatePdfFile(file);
      if (err) {
        setInvalid(err);
        return;
      }
      setInvalid(null);
      onFileSelected(file);
    },
    [onFileSelected]
  );

  // 始终持有最新的 handleFile，供原生事件监听使用
  const handleFileRef = useRef(handleFile);
  useEffect(() => {
    handleFileRef.current = handleFile;
  }, [handleFile]);

  /**
   * 读取并处理文件。用 requestAnimationFrame 延迟一步：
   * 某些 webview 会先触发 change 事件、再异步填充 input.files，
   * 立即读取会拿到空列表。
   */
  const processInput = (input: HTMLInputElement) => {
    requestAnimationFrame(() => {
      const files = input.files;
      const file = files?.[0];
      setLastPick(
        `已捕获文件选择事件 · files=${files?.length ?? 0}` +
          (file
            ? ` · ${file.name} (${file.type || "无类型"}, ${file.size}B)`
            : " · 未读取到文件")
      );
      handleFileRef.current(file);
      input.value = "";
    });
  };

  // 原生监听（change + input），不依赖 React 合成事件，兼容性最好
  const nativeHandler = (e: Event) => {
    processInput(e.target as HTMLInputElement);
  };

  const inputCallbackRef = (el: HTMLInputElement | null) => {
    if (inputRef.current === el) return;
    inputRef.current?.removeEventListener("change", nativeHandler);
    inputRef.current?.removeEventListener("input", nativeHandler);
    inputRef.current = el;
    el?.addEventListener("change", nativeHandler);
    el?.addEventListener("input", nativeHandler);
  };

  const hasFile = fileName.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-[13.5px] font-semibold">简历（PDF）</label>
        {hasFile ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs text-moss"
            onClick={onClear}
          >
            <X className="size-3.5" />
            移除
          </Button>
        ) : (
          <span className="font-mono text-[11px] tracking-wide text-moss-light">
            PDF · MAX 10MB
          </span>
        )}
      </div>

      {!hasFile ? (
        // 文件输入框铺满整个拖拽区：点击/拖拽都直接落在 input 上
        <div
          className={`relative min-h-[216px] overflow-hidden rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-all ${
            dragOver
              ? "border-mint bg-sprout shadow-[0_10px_24px_-12px_rgba(30,122,87,0.3)]"
              : "border-mint-soft bg-linear-to-b from-[#fbfefc] to-sprout hover:-translate-y-px hover:border-mint hover:shadow-[0_10px_24px_-12px_rgba(30,122,87,0.25)]"
          }`}
        >
          <input
            ref={inputCallbackRef}
            type="file"
            aria-label="选择简历 PDF 文件"
            className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              // dataTransfer 只在事件期间有效，必须同步读取文件对象
              const file = e.dataTransfer.files?.[0];
              handleFileRef.current(file);
            }}
          />
          <div className="pointer-events-none relative z-0 flex flex-col items-center gap-2.5">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-white text-leaf shadow-[0_8px_18px_-8px_rgba(30,122,87,0.4)]">
              <FileUp className="size-5" />
            </div>
            <div>
              <p className="text-[14.5px] font-semibold">
                点击选择或拖拽 PDF 到这里
              </p>
              <p className="mt-1 text-xs text-moss">上传后自动提取文字，扫描件自动 OCR 识别</p>
            </div>
            <span className="mt-1 rounded-full border border-sprout-deep bg-white/80 px-2.5 py-0.5 font-mono text-[10.5px] tracking-wide text-leaf">
              DRAG &amp; DROP
            </span>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-line bg-card p-4">
          <input
            id="resume-file-input"
            ref={inputCallbackRef}
            type="file"
            className="sr-only"
          />
          <div className="flex items-center gap-3">
            <div
              className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
                extractError
                  ? "bg-clay text-clay-deep"
                  : "bg-sprout text-leaf"
              }`}
            >
              {isExtracting ? (
                <Loader2 className="size-5 animate-spin" />
              ) : extractError ? (
                <FileWarning className="size-5" />
              ) : (
                <FileCheck2 className="size-5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{fileName}</p>
              <div className="mt-0.5 flex items-center gap-2">
                {isExtracting ? (
                  ocrActive ? (
                    <Badge variant="secondary">
                      正在 OCR 识别…（第 {ocrProgress?.currentPage ?? 1}/
                      {ocrProgress?.totalPages ?? "…"} 页）
                    </Badge>
                  ) : (
                    <Badge variant="secondary">正在提取文字…</Badge>
                  )
                ) : extractError ? (
                  <Badge variant="destructive">解析失败</Badge>
                ) : (
                  <Badge variant="secondary" className="text-leaf">
                    已提取 {resumeText.length} 字
                  </Badge>
                )}
              </div>
            </div>
            <label
              htmlFor="resume-file-input"
              role="button"
              tabIndex={0}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "cursor-pointer rounded-full"
              )}
            >
              重新选择
            </label>
          </div>

          {extractError && (
            <Alert variant="destructive" className="mt-3">
              <FileWarning className="size-4" />
              <AlertTitle>PDF 解析失败</AlertTitle>
              <AlertDescription>{extractError}</AlertDescription>
            </Alert>
          )}

          {!extractError && resumeText && (
            <div className="mt-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-0 text-xs text-moss"
                onClick={() => setPreviewOpen((v) => !v)}
              >
                {previewOpen ? "收起预览" : "预览提取的简历文字"}
              </Button>
              {previewOpen && (
                <pre className="mt-2 max-h-56 overflow-auto rounded-2xl whitespace-pre-wrap border border-line bg-mist/60 p-3 text-xs leading-relaxed text-moss">
                  {resumeText}
                </pre>
              )}
            </div>
          )}
        </div>
      )}

      {invalid && (
        <Alert variant="destructive">
          <FileWarning className="size-4" />
          <AlertDescription>{invalid}</AlertDescription>
        </Alert>
      )}

      {lastPick && !hasFile && (
        <p className="font-mono text-[11px] leading-relaxed text-moss-light">
          {lastPick}
        </p>
      )}
    </div>
  );
}
