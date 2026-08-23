// AI 求职助手：后台任务 worker（Supabase Edge Function）
//
// 职责：由 Supabase Cron 每 5 秒调用一次，从 analyses / resume_optimizations
// 两张「任务队列」表中原子领取任务，调用 DeepSeek 生成结果并写回。
//
// 为什么这样做：Netlify 免费套餐同步函数约 10s 硬超时，无法同步等待 AI；
// 而 Supabase Edge Function 免费套餐 wall-clock 上限 150s，足以完成一次 AI 调用。
//
// 并发控制：入队（/api/analyze、/api/optimize-resume）时已按用户限制
// pending+processing 合计最多 3 个，本 worker 只需领取并处理即可。
//
// 环境变量（Supabase Function Secrets）：
//   RESUME_WORKER_SECRET       调用鉴权密钥（请求头 x-worker-secret）
//   SUPABASE_SERVICE_ROLE_KEY  服务端写库（仅服务端使用，绝不暴露到客户端）
//   DEEPSEEK_API_KEY           DeepSeek API Key
//   DEEPSEEK_MODEL             （可选）模型名，默认 deepseek-v4-flash

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  analyzeResumeWithDeepSeek,
  optimizeResumeWithDeepSeek,
} from "../_shared/deepseek.ts";


/** 每次调用最多并行处理的任务数（两表各最多 3，合计 6）。 */
const CLAIM_ANALYSES_LIMIT = 3;
const CLAIM_OPTIMIZATIONS_LIMIT = 3;
/** 单任务最大尝试次数（超过后转 error）。 */
const MAX_ATTEMPTS = 3;

interface ClaimedAnalysis {
  id: string;
  user_id: string;
  resume_text: string | null;
  job_description_text: string | null;
  attempts: number;
}

interface ClaimedOptimization {
  id: string;
  user_id: string;
  resume_text: string | null;
  job_description_text: string | null;
  attempts: number;
}



interface Env {
  workerSecret: string;
  supabaseUrl: string;
  serviceRoleKey: string;
}

function readEnv(): Env {
  return {
    workerSecret: Deno.env.get("RESUME_WORKER_SECRET") ?? "",
    supabaseUrl: Deno.env.get("SUPABASE_URL") ?? "",
    serviceRoleKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  };
}

function json(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "Content-Type": "application/json" },
  });
}

/** 创建一个仅服务端使用的 client（service_role 旁路 RLS）。 */
function makeClient(env: Env) {
  return createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function claimJobs(
  supabase: ReturnType<typeof makeClient>
): Promise<{ analyses: ClaimedAnalysis[]; optimizations: ClaimedOptimization[] }> {
  const [analysesRes, optimizationsRes] = await Promise.all([
    supabase.rpc("claim_analysis_jobs", { p_limit: CLAIM_ANALYSES_LIMIT }),
    supabase.rpc("claim_resume_optimization_jobs", {
      p_limit: CLAIM_OPTIMIZATIONS_LIMIT,
    }),
  ]);

  if (analysesRes.error) {
    throw new Error(`领取分析任务失败：${analysesRes.error.message}`);
  }
  if (optimizationsRes.error) {
    throw new Error(`领取优化任务失败：${optimizationsRes.error.message}`);
  }

  return {
    analyses: (analysesRes.data ?? []) as ClaimedAnalysis[],
    optimizations: (optimizationsRes.data ?? []) as ClaimedOptimization[],
  };
}

async function recordUsage(
  supabase: ReturnType<typeof makeClient>,
  userId: string,
  eventType: string,
  model: string,
  usage?: { inputTokens?: number; outputTokens?: number }
): Promise<void> {
  const { error } = await supabase.from("usage_events").insert({
    user_id: userId,
    event_type: eventType,
    model,
    input_tokens: usage?.inputTokens ?? null,
    output_tokens: usage?.outputTokens ?? null,
  });
  if (error) {
    console.error(`usage_events 写入失败：${error.message}`);
  }
}

async function processAnalysis(
  supabase: ReturnType<typeof makeClient>,
  job: ClaimedAnalysis
): Promise<{ id: string; ok: boolean }> {
  try {
    if (!job.resume_text || !job.job_description_text) {
      throw new Error("分析任务缺少简历文字或岗位描述");
    }
    const { result, model, usage } = await analyzeResumeWithDeepSeek(
      job.resume_text,
      job.job_description_text
    );
    const { error } = await supabase
      .from("analyses")
      .update({
        status: "success",
        result: result as unknown as Record<string, unknown>,
        model,
        locked_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    if (error) throw new Error(`结果写回失败：${error.message}`);
    await recordUsage(supabase, job.user_id, "analysis", model, usage);
    return { id: job.id, ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "分析失败，请稍后重试";
    const terminal = job.attempts >= MAX_ATTEMPTS;
    const { error } = await supabase
      .from("analyses")
      .update({
        status: terminal ? "error" : "pending",
        error_message: message,
        locked_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    if (error) {
      console.error(`分析任务状态回写失败（${job.id}）：${error.message}`);
    }
    return { id: job.id, ok: false };
  }
}

async function processOptimization(
  supabase: ReturnType<typeof makeClient>,
  job: ClaimedOptimization
): Promise<{ id: string; ok: boolean }> {
  try {
    if (!job.resume_text || !job.job_description_text) {
      throw new Error("优化任务缺少简历文字或岗位描述");
    }
    const { result, model, usage } = await optimizeResumeWithDeepSeek(
      job.resume_text,
      job.job_description_text
    );
    const { error } = await supabase
      .from("resume_optimizations")
      .update({
        status: "success",
        result: result as unknown as Record<string, unknown>,
        model,
        locked_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    if (error) throw new Error(`结果写回失败：${error.message}`);
    await recordUsage(supabase, job.user_id, "resume_optimization", model, usage);
    return { id: job.id, ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "简历优化失败，请稍后重试";
    const terminal = job.attempts >= MAX_ATTEMPTS;
    const { error } = await supabase
      .from("resume_optimizations")
      .update({
        status: terminal ? "error" : "pending",
        error_message: message,
        locked_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    if (error) {
      console.error(`优化任务状态回写失败（${job.id}）：${error.message}`);
    }
    return { id: job.id, ok: false };
  }
}

Deno.serve(async (req) => {
  const startedAt = Date.now();
  const env = readEnv();

  if (!env.workerSecret) {
    return json({ error: "worker 未配置 RESUME_WORKER_SECRET" }, { status: 500 });
  }
  if (req.headers.get("x-worker-secret") !== env.workerSecret) {
    return json({ error: "unauthorized" }, { status: 401 });
  }
  if (!env.supabaseUrl || !env.serviceRoleKey) {
    return json(
      { error: "worker 未配置 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY" },
      { status: 500 }
    );
  }

  const supabase = makeClient(env);

  try {
    const { analyses, optimizations } = await claimJobs(supabase);
    const results = await Promise.all([
      ...analyses.map((job) => processAnalysis(supabase, job)),
      ...optimizations.map((job) => processOptimization(supabase, job)),
    ]);

    const okCount = results.filter((r) => r.ok).length;
    console.log(
      `[resume-worker] 领取分析 ${analyses.length}、优化 ${optimizations.length}，` +
        `成功 ${okCount}，耗时 ${Date.now() - startedAt}ms`
    );

    return json({
      ok: true,
      claimedAnalyses: analyses.length,
      claimedOptimizations: optimizations.length,
      succeeded: okCount,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "worker 处理失败";
    console.error(`[resume-worker] ${message}`);
    return json({ ok: false, error: message }, { status: 500 });
  }
});
