import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatDate, totalScoreFromResult } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DeleteAnalysisButton } from "@/components/delete-analysis-button";
import { HistoryAutoRefresh } from "@/components/history-auto-refresh";
import { UserMenu } from "@/components/user-menu";
import { ArrowLeft, History, Leaf, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

interface HistoryRow {
  id: string;
  created_at: string;
  status: "pending" | "processing" | "success" | "error";
  result: unknown;
  job_descriptions: unknown;
  resumes: unknown;
}

const STATUS_META: Record<
  HistoryRow["status"],
  { label: string; className: string }
> = {
  success: { label: "成功", className: "bg-sprout text-leaf hover:bg-sprout" },
  pending: {
    label: "排队中",
    className: "bg-sand text-sand-deep hover:bg-sand",
  },
  processing: {
    label: "处理中",
    className: "bg-sand text-sand-deep hover:bg-sand",
  },
  error: { label: "失败", className: "bg-clay text-clay-deep hover:bg-clay" },
};

/** 列表标题：简历文件名。 */
function resumeName(row: HistoryRow): string {
  const resumes = row.resumes;
  const item = Array.isArray(resumes) ? resumes[0] : resumes;
  const name = (item as { file_name?: string | null } | undefined)?.file_name?.trim();
  return name || "未命名简历";
}

/** 岗位标签：优先 JD 标题，其次 JD 内容前 40 字。 */
function jdLabel(row: HistoryRow): string | null {
  const jd = row.job_descriptions;
  const item = Array.isArray(jd) ? jd[0] : jd;
  const title = (item as { title?: string | null } | undefined)?.title?.trim();
  if (title) return title;
  const content = (item as { content?: string } | undefined)?.content?.trim();
  if (content) return content.slice(0, 40);
  return null;
}

export default async function HistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("analyses")
    .select(
      "id, created_at, status, result, job_descriptions(title, content), resumes(file_name)"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const analyses = (data ?? []) as unknown as HistoryRow[];

  const hasActive = analyses.some(
    (r) => r.status === "pending" || r.status === "processing"
  );

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-line/70 bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3.5">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-mint to-leaf text-white shadow-lg shadow-leaf/25">
              <Leaf className="size-5" />
            </div>
            <div>
              <h1 className="text-[17px] font-bold leading-tight">AI 求职助手</h1>
              <p className="text-xs text-moss">简历优化 · 求职信 · 面试准备</p>
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
        <div className="mb-6 flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="h-5 w-1.5 rounded-full bg-linear-to-b from-mint to-leaf"
          />
          <h2 className="flex items-center gap-2 text-lg font-extrabold">
            <History className="size-5" />
            我的历史
          </h2>
        </div>

        {analyses.length === 0 ? (
          <Card className="rounded-2xl border-line py-14 text-center">
            <CardContent>
              <p className="text-sm text-moss">还没有分析记录</p>
              <Link
                href="/"
                className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-linear-to-br from-leaf-soft to-leaf px-7 font-display font-bold text-white shadow-lg shadow-leaf/30"
              >
                <Sparkles className="size-4" />
                去生成第一份分析
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {analyses.map((row) => {
              const score = totalScoreFromResult(row.result);
              const statusMeta = STATUS_META[row.status] ?? STATUS_META.processing;
              return (
                <Card key={row.id} className="rounded-2xl border-line">
                  <CardContent className="flex items-center gap-4 py-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/history/${row.id}`}
                          className="truncate text-sm font-semibold hover:text-leaf"
                        >
                          {resumeName(row)}
                        </Link>
                        <Badge
                          variant="secondary"
                          className={statusMeta.className}
                        >
                          {statusMeta.label}
                        </Badge>
                      </div>
                      <p className="mt-1 truncate text-xs text-moss">
                        {formatDate(row.created_at)}
                        {jdLabel(row)
                          ? ` · 岗位：${jdLabel(row)}`
                          : ""}
                      </p>
                    </div>
                    {score !== null && row.status === "success" && (
                      <div className="shrink-0 text-right">
                        <p className="font-display text-lg font-extrabold text-leaf">
                          {score}
                          <span className="text-xs font-semibold text-moss-light">
                            {" "}
                            分
                          </span>
                        </p>
                        <p className="text-[11px] text-moss-light">匹配度</p>
                      </div>
                    )}
                    <Link
                      href={`/history/${row.id}`}
                      className="shrink-0 rounded-full border border-line px-3.5 py-1.5 text-xs font-medium text-moss transition-colors hover:border-mint hover:text-leaf"
                    >
                      查看
                    </Link>
                    <DeleteAnalysisButton id={row.id} />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
