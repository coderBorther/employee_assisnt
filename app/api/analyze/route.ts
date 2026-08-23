import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { analyzeResumeWithDeepSeek } from "@/lib/deepseek";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_MODEL,
  EVENT_TYPE_ANALYSIS,
  MAX_JOB_DESCRIPTION_LENGTH,
  MAX_RESUME_LENGTH,
} from "@/lib/constants";
import {
  countTodayEvents,
  getDailyLimit,
  isUnlimitedUser,
} from "@/lib/quota";
import {
  concurrencyLimitError,
  countActiveJobs,
  findInFlightByInputHash,
  isWorkerEnabled,
} from "@/lib/jobs";
import type { AnalysisResult } from "@/lib/types";

/** 从 JD 首行提取一个简短标题，便于历史列表展示。 */
function deriveJobTitle(content: string): string | null {
  const firstLine = content
    .split("\n")
    .map((s) => s.trim())
    .find((s) => s.length > 0);
  if (!firstLine) return null;
  const title = firstLine.replace(/^#+\s*/, "").slice(0, 40).trim();
  return title.length > 0 ? title : null;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "请先登录后再使用" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求格式不正确" }, { status: 400 });
  }

  const data = (body ?? {}) as Record<string, unknown>;
  const resumeText =
    typeof data.resumeText === "string" ? data.resumeText.trim() : "";
  const jobDescription =
    typeof data.jobDescription === "string" ? data.jobDescription.trim() : "";
  const resumeId = typeof data.resumeId === "string" ? data.resumeId : null;

  if (!resumeText) {
    return NextResponse.json(
      { error: "未获取到简历文字，请重新上传简历 PDF" },
      { status: 400 }
    );
  }
  if (!jobDescription) {
    return NextResponse.json(
      { error: "请填写目标岗位描述" },
      { status: 400 }
    );
  }
  if (resumeText.length > MAX_RESUME_LENGTH) {
    return NextResponse.json(
      { error: `简历文字过长（超过 ${MAX_RESUME_LENGTH} 字符），请精简后重试` },
      { status: 400 }
    );
  }
  if (jobDescription.length > MAX_JOB_DESCRIPTION_LENGTH) {
    return NextResponse.json(
      {
        error: `岗位描述过长（超过 ${MAX_JOB_DESCRIPTION_LENGTH} 字符），请精简后重试`,
      },
      { status: 400 }
    );
  }

  // 相同输入复用：同一简历文字 + 同一岗位描述（同模型）直接返回已有成功结果，
  // 保证评分稳定，且不重复调用 AI、不消耗配额。用 input_hash（短值）做查询，
  // 避免把长文本放进 URL 导致连接失败。
  const currentModel = process.env.DEEPSEEK_MODEL?.trim() || DEFAULT_MODEL;
  const inputHash = createHash("md5")
    .update(resumeText + jobDescription)
    .digest("hex");
  const { data: cachedAnalysis } = await supabase
    .from("analyses")
    .select("id, result")
    .eq("user_id", user.id)
    .eq("status", "success")
    .eq("model", currentModel)
    .eq("input_hash", inputHash)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cachedAnalysis?.result) {
    return NextResponse.json({
      result: cachedAnalysis.result,
      analysisId: cachedAnalysis.id,
      cached: true,
    });
  }

  // 每日配额检查（只统计成功分析；白名单用户不限次）
  if (!isUnlimitedUser(user.email)) {
    const limit = getDailyLimit(EVENT_TYPE_ANALYSIS);
    let count: number;
    try {
      count = await countTodayEvents(
        supabase,
        user.id,
        EVENT_TYPE_ANALYSIS
      );
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "用量查询失败，请稍后重试" },
        { status: 500 }
      );
    }
    if (count >= limit) {
      return NextResponse.json(
        {
          error: `今日免费分析次数已用完（每天 ${limit} 次），请明天再试`,
        },
        { status: 429 }
      );
    }
  }

  // 并发检查：每用户「智能分析 + 简历优化」在途任务（pending+processing）合计最多 3 个
  if (isWorkerEnabled()) {
    let active: number;
    try {
      active = await countActiveJobs(supabase, user.id);
    } catch {
      return NextResponse.json(
        { error: "任务状态查询失败，请稍后重试" },
        { status: 500 }
      );
    }
    if (active >= 3) {
      return NextResponse.json(concurrencyLimitError(), { status: 429 });
    }

    // 同输入已在途（pending/processing）则直接复用，避免重复入队
    const inFlight = await findInFlightByInputHash(
      supabase,
      user.id,
      "analyses",
      inputHash
    );
    if (!inFlight.error && inFlight.data) {
      return NextResponse.json({
        analysisId: inFlight.data.id,
        status: "pending",
      });
    }
  }

  // 校验简历归属；客户端未传或校验失败时，用文字重建一条记录
  let finalResumeId: string | null = null;
  if (resumeId) {
    const { data: resume } = await supabase
      .from("resumes")
      .select("id")
      .eq("id", resumeId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (resume) finalResumeId = resume.id;
  }
  if (!finalResumeId) {
    const { data: createdResume, error: resumeError } = await supabase
      .from("resumes")
      .insert({
        user_id: user.id,
        file_name: "直接粘贴的简历文字",
        parse_status: "success",
        parsed_text: resumeText,
      })
      .select("id")
      .single();
    if (resumeError || !createdResume) {
      return NextResponse.json(
        { error: "简历保存失败，请重试" },
        { status: 500 }
      );
    }
    finalResumeId = createdResume.id;
  }

  // 岗位描述记录
  const { data: jd, error: jdError } = await supabase
    .from("job_descriptions")
    .insert({
      user_id: user.id,
      title: deriveJobTitle(jobDescription),
      content: jobDescription,
    })
    .select("id")
    .single();
  if (jdError || !jd) {
    return NextResponse.json(
      { error: "岗位描述保存失败，请重试" },
      { status: 500 }
    );
  }

  // 分析记录（入队：status=pending，由后台 worker 处理）
  const { data: analysis, error: analysisError } = await supabase
    .from("analyses")
    .insert({
      user_id: user.id,
      resume_id: finalResumeId,
      job_description_id: jd.id,
      resume_text: resumeText,
      job_description_text: jobDescription,
      input_hash: inputHash,
      status: "pending",
    })
    .select("id")
    .single();
  if (analysisError || !analysis) {
    return NextResponse.json(
      { error: "分析记录创建失败，请重试" },
      { status: 500 }
    );
  }

  // 后台模式：立即返回，AI 由 worker 处理（前端轮询 /api/job-status）
  if (isWorkerEnabled()) {
    return NextResponse.json({
      analysisId: analysis.id,
      status: "pending",
    });
  }

  // 本地开发兜底（未配置 RESUME_WORKER_URL）：同步调用 AI，行为与旧版一致
  try {
    const { result, model, usage } = await analyzeResumeWithDeepSeek(
      resumeText,
      jobDescription
    );

    await supabase
      .from("analyses")
      .update({
        status: "success",
        result: result as unknown as Record<string, unknown>,
        model,
        updated_at: new Date().toISOString(),
      })
      .eq("id", analysis.id);

    await supabase.from("usage_events").insert({
      user_id: user.id,
      event_type: EVENT_TYPE_ANALYSIS,
      model: model || DEFAULT_MODEL,
      input_tokens: usage?.inputTokens ?? null,
      output_tokens: usage?.outputTokens ?? null,
    });

    return NextResponse.json({ result, analysisId: analysis.id });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "分析失败，请稍后重试";

    await supabase
      .from("analyses")
      .update({
        status: "error",
        error_message: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", analysis.id);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export type { AnalysisResult };
