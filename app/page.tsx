"use client";

import { useMemo, useState } from "react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { FileText, Leaf, Loader2, Sparkles, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { ResumeUpload } from "@/components/resume-upload";
import { JobDescriptionInput } from "@/components/job-description-input";
import { MatchAnalysisCard } from "@/components/match-analysis-card";
import { ResumeSuggestionsCard } from "@/components/resume-suggestions-card";
import { CoverLetterCard } from "@/components/cover-letter-card";
import { InterviewQuestionsCard } from "@/components/interview-questions-card";
import { extractTextFromPdf } from "@/lib/pdf";
import { OCR_MIN_TEXT_CHARS, ocrPdfFromFile } from "@/lib/ocr";
import type { OcrProgress } from "@/lib/ocr";
import { createClient } from "@/lib/supabase/client";
import { UserMenu } from "@/components/user-menu";
import type { AnalysisResult } from "@/lib/types";

type Status = "idle" | "analyzing" | "success" | "error";

const STEPS = ["上传简历", "粘贴岗位描述", "生成求职材料"];

export default function Home() {
  const [fileName, setFileName] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [ocrActive, setOcrActive] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<OcrProgress | null>(null);

  /** 提取成功后，把原始 PDF 上传到私有桶并写入 resumes 表。 */
  const persistResume = async (file: File, text: string) => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("登录状态已失效，请重新登录");
    }

    const fileExt = file.name.split(".").pop() || "pdf";
    const storagePath = `resumes/${user.id}/${crypto.randomUUID()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("resumes")
      .upload(storagePath, file, {
        contentType: file.type || "application/pdf",
        upsert: false,
      });
    if (uploadError) {
      throw new Error("简历已解析，但保存到云端失败，请重新选择文件再试");
    }

    const { data: resume, error: insertError } = await supabase
      .from("resumes")
      .insert({
        user_id: user.id,
        file_name: file.name,
        file_size_bytes: file.size,
        storage_path: storagePath,
        parsed_text: text,
        parse_status: "success",
      })
      .select("id")
      .single();
    if (insertError || !resume) {
      throw new Error("简历保存失败，请重新选择文件再试");
    }
    setResumeId(resume.id);
  };

  /** 解析失败时记录一条 failed 状态的简历记录（不影响用户体验）。 */
  const recordFailedResume = async (file: File) => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("resumes").insert({
        user_id: user.id,
        file_name: file.name,
        file_size_bytes: file.size,
        parse_status: "failed",
      });
    } catch {
      // 记录失败不影响用户操作
    }
  };

  const handleFileSelected = async (file: File) => {
    setFileName(file.name);
    setExtractError(null);
    setError("");
    setResult(null);
    setAnalysisId(null);
    setStatus("idle");
    setIsExtracting(true);
    setResumeText("");
    setResumeId(null);

    let text = "";
    try {
      text = await extractTextFromPdf(file);
      if (text.trim().length < OCR_MIN_TEXT_CHARS) {
        // 扫描件/图片型 PDF 自动 OCR 兜底
        setOcrActive(true);
        setOcrProgress(null);
        try {
          text = await ocrPdfFromFile(file, (progress) => setOcrProgress(progress));
        } finally {
          setOcrActive(false);
          setOcrProgress(null);
        }
      }
      if (!text.trim()) {
        throw new Error(
          "未能从这份 PDF 中提取到文字：它可能是扫描件或图片型 PDF（没有文字层），自动 OCR 也未识别出内容。请尝试更清晰的扫描件，或改用带文字的 PDF（如从 Word 导出）。"
        );
      }
      setResumeText(text);
    } catch (e) {
      // 保留已选文件名，让「解析失败」的原因清晰可见，而不是让文件卡消失
      setExtractError(
        e instanceof Error ? e.message : "PDF 解析失败，请更换文件后重试"
      );
      setIsExtracting(false);
      await recordFailedResume(file);
      return;
    }

    try {
      await persistResume(file, text);
    } catch (e) {
      setResumeText("");
      setExtractError(
        e instanceof Error ? e.message : "简历保存失败，请重新选择文件再试"
      );
    } finally {
      setIsExtracting(false);
    }
  };

  const handleClearFile = () => {
    setFileName("");
    setResumeText("");
    setExtractError(null);
    setResult(null);
    setAnalysisId(null);
    setResumeId(null);
    setOcrActive(false);
    setOcrProgress(null);
    setStatus("idle");
  };

  const canAnalyze =
    resumeText.length > 0 &&
    jobDescription.trim().length > 0 &&
    !isExtracting &&
    status !== "analyzing";

  const handleAnalyze = async () => {
    if (!canAnalyze) return;
    setStatus("analyzing");
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeText,
          resumeId,
          jobDescription: jobDescription.trim(),
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        result?: AnalysisResult;
        analysisId?: string;
        error?: string;
      } | null;
      if (!res.ok) {
        throw new Error(data?.error || "分析失败，请稍后重试");
      }
      if (!data?.result) {
        throw new Error("服务返回结果异常，请重试");
      }
      setResult(data.result);
      setAnalysisId(data.analysisId ?? null);
      setStatus("success");
      requestAnimationFrame(() => {
        document
          .getElementById("results")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "分析失败，请稍后重试"
      );
      setStatus("error");
    }
  };

  const missingHint = useMemo(() => {
    if (isExtracting) return "正在提取简历文字…";
    if (!resumeText) return "请先上传简历 PDF 并等待文字提取成功";
    if (!jobDescription.trim()) return "请填写目标岗位描述";
    return "";
  }, [isExtracting, resumeText, jobDescription]);

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-line/70 bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3.5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-mint to-leaf text-white shadow-lg shadow-leaf/25">
            <Leaf className="size-5" />
          </div>
          <div>
            <h1 className="text-[17px] font-bold leading-tight">AI 求职助手</h1>
            <p className="text-xs text-moss">
              简历优化 · 求职信 · 面试准备
            </p>
          </div>
          <UserMenu />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-8">
        {/* hero */}
        <section className="reveal pt-12 pb-9 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-sprout-deep bg-white px-3.5 py-1.5 font-display text-xs font-bold tracking-[0.22em] text-leaf uppercase shadow-sm">
            <span className="size-1.5 rounded-full bg-mint ring-4 ring-mint/20" />
            AI JOB COPILOT
          </span>
          <h2 className="mt-5 text-[clamp(1.875rem,4.6vw,2.75rem)] leading-tight font-extrabold tracking-tight">
            让每一次投递，<em className="relative text-leaf after:absolute after:inset-x-0 after:-bottom-0.5 after:h-2 after:rounded-full after:bg-linear-to-r after:from-transparent after:via-mint/50 after:to-transparent after:-z-10">都更有把握</em>
          </h2>
          <p className="mx-auto mt-4 max-w-[38rem] text-[15px] leading-relaxed text-moss">
            上传简历、粘贴目标岗位描述，几分钟内获得岗位匹配度分析、简历优化建议、求职信与面试题参考回答——所有材料都围绕这一份 JD 量身生成。
          </p>

          <div className="mx-auto mt-8 flex max-w-[42rem] flex-wrap items-center justify-center gap-y-3">
            {STEPS.map((name, i) => (
              <div key={name} className="flex items-center">
                {i > 0 && (
                  <span
                    aria-hidden="true"
                    className="hidden h-0 border-t-2 border-dashed border-mint-soft sm:block sm:w-9 sm:mx-4"
                  />
                )}
                <span className="flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-full border-[1.5px] border-mint-soft bg-sprout font-display text-[13px] font-extrabold text-leaf">
                    {i + 1}
                  </span>
                  <span className="text-[13.5px] font-semibold whitespace-nowrap">
                    {name}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* input card */}
        <Card className="reveal reveal-1 rounded-2xl border-line shadow-[0_1px_2px_rgba(22,54,42,0.04),0_12px_32px_-12px_rgba(22,54,42,0.10)]">
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sprout text-leaf">
                <FileText className="size-4" />
              </div>
              <div>
                <CardTitle className="text-base font-bold">开始分析</CardTitle>
                <CardDescription>
                  把简历和目标岗位放在一起，剩下的交给 AI
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 lg:grid-cols-2">
              <ResumeUpload
                fileName={fileName}
                isExtracting={isExtracting}
                extractError={extractError}
                resumeText={resumeText}
                ocrActive={ocrActive}
                ocrProgress={ocrProgress}
                onFileSelected={handleFileSelected}
                onClear={handleClearFile}
              />

              <JobDescriptionInput
                value={jobDescription}
                onChange={setJobDescription}
              />
            </div>

            <Separator className="my-6" />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                onClick={handleAnalyze}
                disabled={!canAnalyze}
                className="h-11 gap-2 rounded-full bg-linear-to-br from-leaf-soft to-leaf px-7 font-display font-bold shadow-lg shadow-leaf/30 hover:from-leaf-soft hover:to-leaf-deep sm:min-w-44"
              >
                {status === "analyzing" ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    正在分析…
                  </>
                ) : result ? (
                  "重新分析"
                ) : (
                  <>
                    <Sparkles className="size-4" />
                    开始分析
                  </>
                )}
              </Button>
              {status === "idle" && missingHint && (
                <p className="text-xs text-moss">{missingHint}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {status === "analyzing" && <AnalysisSkeleton />}

        {status === "error" && (
          <Alert variant="destructive" className="mt-6">
            <TriangleAlert className="size-4" />
            <AlertTitle>分析失败</AlertTitle>
            <AlertDescription className="flex flex-col items-start gap-3">
              <span>{error}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={handleAnalyze}
                disabled={!canAnalyze}
              >
                重试
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {result && (
          <section id="results" className="space-y-6 pt-10">
            <h2 className="flex items-center gap-2.5 text-lg font-extrabold">
              <span
                aria-hidden="true"
                className="h-5 w-1.5 rounded-full bg-linear-to-b from-mint to-leaf"
              />
              分析结果
            </h2>
            {analysisId && (
              <p className="text-xs text-moss">
                已保存到{" "}
                <Link
                  href="/history"
                  className="font-semibold text-leaf hover:underline"
                >
                  我的历史
                </Link>
              </p>
            )}
            <MatchAnalysisCard data={result.matchAnalysis} />
            <ResumeSuggestionsCard suggestions={result.resumeSuggestions} />
            <CoverLetterCard text={result.coverLetter} />
            <InterviewQuestionsCard questions={result.interviewQuestions} />
            {result.interviewQuestions.length === 0 && (
              <Card className="rounded-2xl border-line">
                <CardContent className="py-10 text-center">
                  <p className="text-sm text-moss">
                    本次面试题未生成成功，可点击「重新分析」重试。
                  </p>
                </CardContent>
              </Card>
            )}
          </section>
        )}

        <footer className="mt-10 border-t border-line pt-6 pb-4 text-center">
          <p className="text-xs text-moss-light">
            🔒 您的简历与分析结果会安全保存到您的账号中，仅您本人可见，可在「我的历史」中随时删除。免费版每天可分析 5 次。生成内容仅供参考，不构成求职结果承诺。
          </p>
        </footer>
      </main>
    </div>
  );
}

function AnalysisSkeleton() {
  return (
    <div className="space-y-6 pt-6" aria-label="正在生成分析结果">
      {[0, 1, 2, 3].map((i) => (
        <Card key={i} className="rounded-2xl border-line">
          <CardHeader>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
