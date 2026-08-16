import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { optimizeResumeWithDeepSeek } from "@/lib/deepseek";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_MODEL,
  EVENT_TYPE_RESUME_OPTIMIZATION,
  MAX_JOB_DESCRIPTION_LENGTH,
  MAX_RESUME_LENGTH,
} from "@/lib/constants";
import { countTodayEvents, getDailyLimit, isUnlimitedUser } from "@/lib/quota";
import type { OptimizedResumeResult } from "@/lib/types";

/**
 * POST /api/optimize-resume
 * 根据某次成功的「智能分析」记录（analysisId），用其保存的简历文字 + JD，
 * 调用 DeepSeek 生成针对该 JD 改写后的完整简历（禁止虚构、去 AI 味）。
 */
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
  const analysisId = typeof data.analysisId === "string" ? data.analysisId : "";
  if (!analysisId) {
    return NextResponse.json({ error: "缺少分析记录 ID" }, { status: 400 });
  }

  // 读取来源分析：必须属于当前用户且状态成功
  const { data: analysis, error: analysisError } = await supabase
    .from("analyses")
    .select(
      "resume_id, job_description_id, resume_text, job_description_text, status"
    )
    .eq("id", analysisId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (analysisError || !analysis) {
    return NextResponse.json(
      { error: "分析记录不存在或无权访问" },
      { status: 404 }
    );
  }
  if (analysis.status !== "success") {
    return NextResponse.json(
      { error: "仅对成功的分析结果进行简历优化" },
      { status: 400 }
    );
  }

  let resumeText =
    (analysis.resume_text as string | null | undefined)?.trim() ?? "";
  let jobDescription =
    (analysis.job_description_text as string | null | undefined)?.trim() ?? "";

  // 旧记录可能没有输入快照，回退到关联表
  if (!resumeText && analysis.resume_id) {
    const { data: resume } = await supabase
      .from("resumes")
      .select("parsed_text")
      .eq("id", analysis.resume_id)
      .maybeSingle();
    resumeText = (resume?.parsed_text as string | null | undefined)?.trim() ?? "";
  }
  if (!jobDescription && analysis.job_description_id) {
    const { data: jd } = await supabase
      .from("job_descriptions")
      .select("content")
      .eq("id", analysis.job_description_id)
      .maybeSingle();
    jobDescription = (jd?.content as string | null | undefined)?.trim() ?? "";
  }

  if (!resumeText) {
    return NextResponse.json(
      { error: "未找到简历文字，请重新分析后再试" },
      { status: 400 }
    );
  }
  if (!jobDescription) {
    return NextResponse.json(
      { error: "未找到岗位描述，请重新分析后再试" },
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

  // 相同输入复用：同一简历文字 + 同一岗位描述直接返回已有成功结果，
  // 不重复调用 AI、不消耗配额。
  const currentModel = process.env.DEEPSEEK_MODEL?.trim() || DEFAULT_MODEL;
  const inputHash = createHash("md5")
    .update(resumeText + jobDescription)
    .digest("hex");
  const { data: cached } = await supabase
    .from("resume_optimizations")
    .select("id, result")
    .eq("user_id", user.id)
    .eq("status", "success")
    .eq("model", currentModel)
    .eq("input_hash", inputHash)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cached?.result) {
    return NextResponse.json({
      result: cached.result,
      optimizationId: cached.id,
      cached: true,
    });
  }

  // 每日配额检查（只统计成功优化；白名单用户不限次）
  if (!isUnlimitedUser(user.email)) {
    const limit = getDailyLimit(EVENT_TYPE_RESUME_OPTIMIZATION);
    let count: number;
    try {
      count = await countTodayEvents(
        supabase,
        user.id,
        EVENT_TYPE_RESUME_OPTIMIZATION
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
          error: `今日免费简历优化次数已用完（每天 ${limit} 次），请明天再试`,
        },
        { status: 429 }
      );
    }
  }

  // 优化记录（先置为 processing）
  const { data: optimization, error: createError } = await supabase
    .from("resume_optimizations")
    .insert({
      user_id: user.id,
      analysis_id: analysisId,
      resume_id: analysis.resume_id ?? null,
      job_description_id: analysis.job_description_id ?? null,
      resume_text: resumeText,
      job_description_text: jobDescription,
      input_hash: inputHash,
      status: "processing",
    })
    .select("id")
    .single();
  if (createError || !optimization) {
    return NextResponse.json(
      { error: "优化记录创建失败，请重试" },
      { status: 500 }
    );
  }

  try {
    const { result, model, usage } = await optimizeResumeWithDeepSeek(
      resumeText,
      jobDescription
    );

    await supabase
      .from("resume_optimizations")
      .update({
        status: "success",
        result: result as unknown as Record<string, unknown>,
        model,
        updated_at: new Date().toISOString(),
      })
      .eq("id", optimization.id);

    await supabase.from("usage_events").insert({
      user_id: user.id,
      event_type: EVENT_TYPE_RESUME_OPTIMIZATION,
      model: model || DEFAULT_MODEL,
      input_tokens: usage?.inputTokens ?? null,
      output_tokens: usage?.outputTokens ?? null,
    });

    return NextResponse.json({
      result: result as OptimizedResumeResult,
      optimizationId: optimization.id,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "简历优化失败，请稍后重试";

    await supabase
      .from("resume_optimizations")
      .update({
        status: "error",
        error_message: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", optimization.id);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
