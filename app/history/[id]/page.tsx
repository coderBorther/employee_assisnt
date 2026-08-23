import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { UserMenu } from "@/components/user-menu";
import { MatchAnalysisCard } from "@/components/match-analysis-card";
import { ResumeSuggestionsCard } from "@/components/resume-suggestions-card";
import { CoverLetterCard } from "@/components/cover-letter-card";
import { InterviewQuestionsCard } from "@/components/interview-questions-card";
import { ResumeOptimizer } from "@/components/resume-optimizer";
import { HistoryAutoRefresh } from "@/components/history-auto-refresh";
import { ArrowLeft, Briefcase, FileText, Leaf, Loader2, TriangleAlert } from "lucide-react";
import type { AnalysisResult } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HistoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: analysis } = await supabase
    .from("analyses")
    .select(
      "*, resumes(file_name), job_descriptions(title, content)"
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!analysis) notFound();

  const status = analysis.status as string;
  const hasActive = status === "pending" || status === "processing";
  const result = (analysis.result ?? null) as AnalysisResult | null;
  const errorMessage = (analysis.error_message as string | null) ?? "";

  const resumes = analysis.resumes as
    | { file_name?: string | null }
    | Array<{ file_name?: string | null }>
    | null
    | undefined;
  const resumeItem = Array.isArray(resumes) ? resumes[0] : resumes;
  const resumeFileName = resumeItem?.file_name?.trim() || "";

  const jdRel = analysis.job_descriptions as
    | { title?: string | null; content?: string | null }
    | Array<{ title?: string | null; content?: string | null }>
    | null
    | undefined;
  const jdItem = Array.isArray(jdRel) ? jdRel[0] : jdRel;
  const jdTitle = jdItem?.title?.trim() || "";
  const jdContent =
    (analysis.job_description_text as string | null)?.trim() ||
    jdItem?.content?.trim() ||
    "";

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-line/70 bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3.5">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-mint to-leaf text-white shadow-lg shadow-leaf/25">
              <Leaf className="size-5" />
            </div>
            <div>
              <h1 className="text-[17px] font-bold leading-tight">易小简</h1>
              <p className="text-xs text-moss">简历开挂，从一次 AI 分析开始</p>
            </div>
          </Link>
          <Link
            href="/"
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-card px-3 text-xs font-medium text-moss transition-colors hover:border-mint hover:text-leaf"
          >
            <ArrowLeft className="size-3.5" />
            返回首页
          </Link>
          <UserMenu />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
        <HistoryAutoRefresh hasActive={hasActive} />
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/history"
            className="inline-flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-xs font-medium text-moss transition-colors hover:border-mint hover:text-leaf"
          >
            <ArrowLeft className="size-3.5" />
            返回历史列表
          </Link>
          <div className="flex items-center gap-2 text-xs text-moss">
            分析时间：{formatDate(analysis.created_at)}
            {status === "success" && (
              <Badge variant="secondary" className="bg-sprout text-leaf hover:bg-sprout">
                成功
              </Badge>
            )}
          </div>
        </div>

        {(resumeFileName || jdContent) && (
          <Card className="mb-6 rounded-2xl border-line">
            <CardContent className="space-y-4 py-5">
              <div className="flex items-center gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sprout text-leaf">
                  <FileText className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-moss-light">本次分析的简历</p>
                  <p className="truncate text-sm font-semibold">
                    {resumeFileName || "未命名简历"}
                  </p>
                </div>
              </div>

              {jdContent && (
                <>
                  <Separator />
                  <div>
                    <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                      <Briefcase className="size-4 shrink-0 text-leaf" />
                      本次分析的岗位描述
                      {jdTitle && (
                        <span className="ml-auto truncate text-xs font-normal text-moss-light">
                          {jdTitle}
                        </span>
                      )}
                    </div>
                    <div className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-mist/40 p-4 text-[13px] leading-relaxed text-moss">
                      {jdContent}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {hasActive && (
          <Alert className="mb-6 border-sprout-deep bg-sprout/60">
            <Loader2 className="size-4 animate-spin text-leaf" />
            <AlertTitle>正在后台处理中</AlertTitle>
            <AlertDescription>
              任务正在后台运行，页面每 3 秒自动刷新，完成后会直接展示结果；期间你可以自由浏览其他页面，任务不会中断。
            </AlertDescription>
          </Alert>
        )}

        {status === "error" && (
          <Alert variant="destructive" className="mb-6">
            <TriangleAlert className="size-4" />
            <AlertTitle>分析失败</AlertTitle>
            <AlertDescription>
              {errorMessage || "未知错误，请返回重新分析。"}
            </AlertDescription>
          </Alert>
        )}

        {status === "success" && result && (
          <div className="space-y-6">
            <h2 className="flex items-center gap-2.5 text-lg font-extrabold">
              <span
                aria-hidden="true"
                className="h-5 w-1.5 rounded-full bg-linear-to-b from-mint to-leaf"
              />
              分析结果
            </h2>
            <MatchAnalysisCard data={result.matchAnalysis} />
            <ResumeSuggestionsCard suggestions={result.resumeSuggestions} />
            <CoverLetterCard text={result.coverLetter} />
            <InterviewQuestionsCard questions={result.interviewQuestions} />
            <ResumeOptimizer
              analysisId={analysis.id}
              resumeFileName={resumeFileName}
            />
          </div>
        )}

        {status === "success" && !result && (
          <Alert>
            <TriangleAlert className="size-4" />
            <AlertTitle>结果数据缺失</AlertTitle>
            <AlertDescription>这条记录没有可展示的结果，请返回重新分析。</AlertDescription>
          </Alert>
        )}
      </main>
    </div>
  );
}
