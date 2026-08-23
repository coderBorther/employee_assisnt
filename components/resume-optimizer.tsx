"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CopyButton } from "@/components/copy-button";
import { ConcurrencyLimitDialog } from "@/components/concurrency-limit-dialog";
import { createClient } from "@/lib/supabase/client";
import {
  CONCURRENCY_LIMIT_CODE,
} from "@/lib/constants";
import {
  Download,
  FileText,
  Loader2,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import type { OptimizedResumeResult } from "@/lib/types";

type Status = "idle" | "loading" | "pending" | "success" | "error";

interface ResumeOptimizerProps {
  /** 来源的智能分析记录 ID（用于读取简历 + JD）。 */
  analysisId: string;
  /** 原始简历文件名（用于 PDF 下载命名）。 */
  resumeFileName?: string;
}

interface JobStatusResponse {
  status?: string;
  result?: OptimizedResumeResult | null;
  errorMessage?: string | null;
}

/** 去掉 `## ` 分节标题标记，得到可直接复制的干净文本。 */
function cleanResumeText(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/^##\s+/, ""))
    .join("\n");
}

function ResumeTextBlock({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="whitespace-pre-wrap rounded-2xl border border-line bg-linear-to-b from-[#fcfefd] to-[#f4faf6] px-6 py-5 text-sm leading-7 text-moss">
      {lines.map((line, i) => {
        const heading = line.startsWith("## ");
        if (!line.trim()) {
          return <div key={i} className="h-2.5" aria-hidden="true" />;
        }
        return heading ? (
          <p
            key={i}
            className="mt-2 mb-1 font-display text-[15px] font-extrabold text-leaf first:mt-0"
          >
            {line.replace(/^##\s+/, "")}
          </p>
        ) : (
          <p key={i}>{line}</p>
        );
      })}
    </div>
  );
}

/** 轮询一次任务状态（kind=optimization）。 */
async function fetchOptimizationStatus(
  optimizationId: string
): Promise<JobStatusResponse> {
  const res = await fetch(
    `/api/job-status?kind=optimization&id=${encodeURIComponent(optimizationId)}`
  );
  if (!res.ok) {
    return {};
  }
  return (await res.json().catch(() => ({}))) as JobStatusResponse;
}

export function ResumeOptimizer({
  analysisId,
  resumeFileName,
}: ResumeOptimizerProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<OptimizedResumeResult | null>(null);
  const [optimizationId, setOptimizationId] = useState<string | null>(null);
  const [cached, setCached] = useState(false);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pollingId, setPollingId] = useState<string | null>(null);

  /** 挂载时恢复：如果该分析已存在优化记录，直接展示其状态，避免跳页后丢失。 */
  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    void (async () => {
      try {
        const { data } = await supabase
          .from("resume_optimizations")
          .select("id, status, result, error_message")
          .eq("analysis_id", analysisId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cancelled || !data) return;
        const row = data as {
          id: string;
          status: string;
          result: unknown;
          error_message: string | null;
        };
        if (row.status === "success") {
          const text = (row.result as OptimizedResumeResult | null)
            ?.optimizedResume;
          if (typeof text === "string" && text.trim()) {
            setResult({ optimizedResume: text });
            setOptimizationId(row.id);
            setCached(true);
            setStatus("success");
          }
        } else if (row.status === "pending" || row.status === "processing") {
          setOptimizationId(row.id);
          setStatus("pending");
          setPollingId(row.id);
        } else if (row.status === "error") {
          setError(row.error_message || "简历优化失败，请稍后重试");
          setStatus("error");
        }
      } catch {
        // 恢复失败不阻塞：用户可点击按钮重新生成
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [analysisId]);

  /** 后台模式下轮询任务状态，直至 success/error。 */
  useEffect(() => {
    if (!pollingId || status !== "pending") return;
    const timer = setInterval(async () => {
      const data = await fetchOptimizationStatus(pollingId);
      if (data.status === "success" && data.result?.optimizedResume) {
        setResult({ optimizedResume: data.result.optimizedResume });
        setOptimizationId(pollingId);
        setCached(false);
        setStatus("success");
        setPollingId(null);
      } else if (data.status === "error") {
        setError(data.errorMessage || "简历优化失败，请稍后重试");
        setStatus("error");
        setPollingId(null);
      }
      // pending/processing 或网络抖动：继续轮询
    }, 3000);
    return () => clearInterval(timer);
  }, [pollingId, status]);

  const handleOptimize = useCallback(async () => {
    setStatus("loading");
    setError("");
    try {
      const res = await fetch("/api/optimize-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysisId }),
      });
      const data = (await res.json().catch(() => null)) as {
        result?: OptimizedResumeResult;
        optimizationId?: string;
        status?: string;
        cached?: boolean;
        error?: string;
        code?: string;
      } | null;
      if (res.status === 429 && data?.code === CONCURRENCY_LIMIT_CODE) {
        setDialogOpen(true);
        setStatus("idle");
        return;
      }
      if (!res.ok) {
        throw new Error(data?.error || "简历优化失败，请稍后重试");
      }
      if (!data) {
        throw new Error("服务返回结果异常，请重试");
      }
      const text = data.result?.optimizedResume;
      if (typeof text === "string" && text.trim()) {
        setResult({ optimizedResume: text });
        setOptimizationId(data.optimizationId ?? null);
        setCached(data.cached ?? false);
        setStatus("success");
        return;
      }
      if (data.optimizationId && data.status === "pending") {
        setOptimizationId(data.optimizationId);
        setStatus("pending");
        setPollingId(data.optimizationId);
        return;
      }
      throw new Error("服务返回结果异常，请重试");
    } catch (e) {
      setError(e instanceof Error ? e.message : "简历优化失败，请稍后重试");
      setStatus("error");
    }
  }, [analysisId]);

  const handleDownloadPdf = useCallback(async () => {
    if (!optimizationId || downloading) return;
    setDownloading(true);
    setError("");
    try {
      const res = await fetch("/api/optimize-resume/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optimizationId, fileName: resumeFileName ?? null }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error || "PDF 生成失败，请重试");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${resumeFileName?.replace(/\.pdf$/i, "").slice(0, 60) || "优化简历"}-优化版.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "PDF 生成失败，请稍后重试");
    } finally {
      setDownloading(false);
    }
  }, [optimizationId, resumeFileName, downloading]);

  const busy = status === "loading" || status === "pending";
  const copyText = result ? cleanResumeText(result.optimizedResume) : "";

  return (
    <Card className="rounded-2xl border-line bg-linear-to-br from-sprout/60 via-card to-card shadow-[0_1px_2px_rgba(22,54,42,0.04),0_12px_32px_-12px_rgba(22,54,42,0.10)]">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-mint to-leaf text-white shadow-md shadow-leaf/25">
              <Sparkles className="size-4" />
            </div>
            <div>
              <CardTitle className="text-base font-extrabold">AI 简历优化</CardTitle>
              <p className="mt-0.5 max-w-xl text-[13px] leading-relaxed text-moss">
                针对这份 JD 生成一份改写后的完整简历：保留你真实的任职与项目经历，只做措辞、结构与关键词优化，绝不虚构内容。
              </p>
            </div>
          </div>
          <Button
            onClick={handleOptimize}
            disabled={busy}
            className="h-10 gap-2 rounded-full bg-linear-to-br from-leaf-soft to-leaf px-6 font-display font-bold text-white shadow-lg shadow-leaf/30 hover:from-leaf-soft hover:to-leaf-deep"
          >
            {status === "loading" ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                正在提交…
              </>
            ) : status === "pending" ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                优化中…
              </>
            ) : result ? (
              <>
                <Sparkles className="size-4" />
                重新生成
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                AI 优化简历
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      {status === "pending" && (
        <CardContent>
          <Alert className="border-sprout-deep bg-sprout/60">
            <Loader2 className="size-4 animate-spin text-leaf" />
            <AlertTitle>正在后台优化中</AlertTitle>
            <AlertDescription>
              已提交后台处理，可先前往其他页面，完成后回到本页即可看到结果（页面会自动刷新）。
            </AlertDescription>
          </Alert>
        </CardContent>
      )}

      {status === "error" && error && (
        <CardContent>
          <Alert variant="destructive">
            <TriangleAlert className="size-4" />
            <AlertTitle>优化失败</AlertTitle>
            <AlertDescription className="flex flex-col items-start gap-3">
              <span>{error}</span>
              <Button size="sm" variant="outline" onClick={handleOptimize} disabled={busy}>
                重试
              </Button>
            </AlertDescription>
          </Alert>
        </CardContent>
      )}

      {status === "success" && result && (
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold">
                <FileText className="size-4 text-leaf" />
                优化后的完整简历
              </p>
              <p className="text-xs text-moss">
                已为你按这份 JD 改写；可复制或下载 PDF 后自行微调。
                {cached && "（相同简历与岗位已生成过，本次为复用结果，未重新调用 AI）"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <CopyButton text={copyText} label="复制简历" />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={downloading || !optimizationId}
                onClick={handleDownloadPdf}
                className="h-8 gap-1.5 rounded-full border border-sprout-deep bg-sprout text-xs font-semibold text-leaf hover:bg-sprout-deep hover:text-leaf-deep"
              >
                {downloading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Download className="size-3.5" />
                )}
                {downloading ? "生成中…" : "下载 PDF"}
              </Button>
            </div>
          </div>
          <ResumeTextBlock text={result.optimizedResume} />
          {error && (
            <p className="text-xs text-clay-deep" role="alert">
              {error}
            </p>
          )}
        </CardContent>
      )}

      <ConcurrencyLimitDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </Card>
  );
}
