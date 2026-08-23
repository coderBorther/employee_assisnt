import {
  SYSTEM_PROMPT,
  OPTIMIZE_SYSTEM_PROMPT,
  buildUserPrompt,
  buildOptimizeUserPrompt,
} from "./prompt";
import type {
  AnalysisResult,
  DimensionKey,
  DimensionScore,
  InterviewQuestion,
  OptimizedResumeResult,
  Priority,
  ResumeSuggestion,
} from "./types";

// 注意：本文件与 supabase/functions/_shared/deepseek.ts 保持同步（本地同步模式用本文件，
// 生产后台 worker 用 _shared 副本，其超时为 100s）。修改逻辑时务必同时更新两处。

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
const DEFAULT_MODEL = "deepseek-v4-flash";
const REQUEST_TIMEOUT_MS = 120_000;

/** 采样温度：越低越确定（配合固定 seed，同输入结果基本一致）。 */
const SAMPLING_TEMPERATURE = 0.2;

/** 服务端计算总分的固定权重（key -> 权重）。 */
const DIMENSION_WEIGHTS: Record<DimensionKey, number> = {
  skill: 0.35,
  experience: 0.35,
  education: 0.15,
  overall: 0.15,
};

/**
 * 由输入内容派生稳定的 seed（FNV-1a 32 位）：同输入恒同 seed，不同输入不同 seed。
 */
function deriveSeed(...inputs: string[]): number {
  let hash = 0x811c9dc5;
  for (const s of inputs) {
    for (let i = 0; i < s.length; i++) {
      hash ^= s.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    hash ^= 0xff;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function normalizeDimensionKey(value: unknown): DimensionKey | undefined {
  const k = typeof value === "string" ? value : "";
  if (k === "skill" || k === "experience" || k === "education" || k === "overall") {
    return k;
  }
  return undefined;
}

/**
 * 按固定权重计算总分；没有带 key 的维度时返回 null（走旧回退逻辑）。
 */
function computeWeightedTotal(dimensions: DimensionScore[]): number | null {
  const weighted = dimensions.filter(
    (d): d is DimensionScore & { key: DimensionKey } =>
      d.key !== undefined && DIMENSION_WEIGHTS[d.key] !== undefined
  );
  if (weighted.length === 0) return null;
  const totalWeight = weighted.reduce((sum, d) => sum + DIMENSION_WEIGHTS[d.key], 0);
  const weightedSum = weighted.reduce(
    (sum, d) => sum + d.score * DIMENSION_WEIGHTS[d.key],
    0
  );
  return Math.round(weightedSum / totalWeight);
}

export class DeepSeekError extends Error {}

export interface DeepSeekUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface DeepSeekAnalysis {
  result: AnalysisResult;
  model: string;
  usage?: DeepSeekUsage;
}

/** 主分析结果缺面试题时，用一次聚焦请求补齐。 */
const REPAIR_SYSTEM_PROMPT = `你是一名求职面试官。请根据用户的简历与目标岗位描述，生成该岗位最可能被问到的面试问题及参考回答。

规则：
1. 输出语言必须跟随「目标岗位描述」的语言。
2. 只输出一个合法 JSON 对象，不要输出任何其他内容。
3. 必须严格按照以下结构返回：
{
  "interviewQuestions": [{ "question": "问题", "referenceAnswer": "参考回答" }]
}
4. interviewQuestions 必须恰好 10 条，绝不能为空；实在无法生成针对该岗位的问题时，给出该岗位通用的高频面试题兜底。`;

function buildRepairUserPrompt(
  resumeText: string,
  jobDescription: string
): string {
  return `【目标岗位描述】
${jobDescription}

【我的简历文字】
${resumeText}

请只输出 interviewQuestions（10 条），不要输出其他内容。`;
}

function getConfig(): { apiKey: string; model: string } {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new DeepSeekError(
      "未配置 DEEPSEEK_API_KEY，请在 .env.local 中设置后重启服务。"
    );
  }
  const model = process.env.DEEPSEEK_MODEL?.trim() || DEFAULT_MODEL;
  return { apiKey, model };
}

function clampScore(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function toPriority(value: unknown): Priority {
  const s = String(value ?? "").toLowerCase();
  if (s === "high") return "high";
  if (s === "low") return "low";
  return "medium";
}

function toString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function parseJsonContent(content: string): unknown {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1].trim() : trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    // 继续尝试下面的兜底解析
  }

  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(candidate.slice(start, end + 1));
    } catch {
      // 继续抛出下面的错误
    }
  }

  throw new DeepSeekError("AI 返回内容无法解析为有效结果，请重试。");
}

function normalizeQuestions(value: unknown): InterviewQuestion[] {
  return Array.isArray(value)
    ? value
        .slice(0, 10)
        .map((q) => {
          const item = (q ?? {}) as Record<string, unknown>;
          return {
            question: toString(item.question),
            referenceAnswer: toString(item.referenceAnswer),
          };
        })
        .filter((q) => q.question.length > 0)
    : [];
}

function normalizeResult(raw: unknown): AnalysisResult {
  const data = (raw ?? {}) as Record<string, unknown>;
  const match = (data.matchAnalysis ?? {}) as Record<string, unknown>;

  const dimensions: DimensionScore[] = Array.isArray(match.dimensions)
    ? match.dimensions
        .slice(0, 6)
        .map((d) => {
          const item = (d ?? {}) as Record<string, unknown>;
          return {
            key: normalizeDimensionKey(item.key),
            name: toString(item.name, "维度"),
            score: clampScore(item.score),
            comment: toString(item.comment),
          };
        })
        .filter((d) => d.name && d.comment !== undefined)
    : [];

  const weightedTotal = computeWeightedTotal(dimensions);
  const modelTotal = clampScore(match.totalScore);
  const totalScore =
    weightedTotal ??
    (modelTotal > 0
      ? modelTotal
      : dimensions.length > 0
        ? Math.round(
            dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length
          )
        : 0);

  const suggestions: ResumeSuggestion[] = Array.isArray(data.resumeSuggestions)
    ? data.resumeSuggestions
        .slice(0, 20)
        .map((s) => {
          const item = (s ?? {}) as Record<string, unknown>;
          return {
            category: toString(item.category, "其他"),
            priority: toPriority(item.priority),
            suggestion: toString(item.suggestion),
          };
        })
        .filter((s) => s.suggestion.length > 0)
    : [];

  const coverLetter = toString(data.coverLetter).trim();

  const hasContent =
    dimensions.length > 0 ||
    suggestions.length > 0 ||
    normalizeQuestions(data.interviewQuestions).length > 0 ||
    coverLetter.length > 0;

  if (!hasContent) {
    throw new DeepSeekError("AI 返回内容不完整，请重试。");
  }

  return {
    matchAnalysis: {
      totalScore,
      dimensions,
      summary: toString(match.summary),
      gapAnalysis: toString(match.gapAnalysis),
    },
    resumeSuggestions: suggestions,
    coverLetter,
    interviewQuestions: normalizeQuestions(data.interviewQuestions),
  };
}

interface DeepSeekRawResponse {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

async function callDeepSeek(
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  seed: number
): Promise<{ content: string; usage?: DeepSeekUsage }> {
  let response: Response;
  try {
    response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: SAMPLING_TEMPERATURE,
        seed,
        response_format: { type: "json_object" },
        messages,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    const message = err instanceof Error ? err.message : String(err);
    if (name === "TimeoutError" || /timeout|abort/i.test(message)) {
      throw new DeepSeekError("AI 生成超时（服务响应较慢），请稍后重试。");
    }
    throw new DeepSeekError(`DeepSeek API 请求失败（${message}）。请检查网络后重试。`);
  }

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as {
        error?: { message?: string };
      };
      if (body.error?.message) detail = body.error.message;
    } catch {
      // 忽略响应体解析失败
    }
    throw new DeepSeekError(
      `DeepSeek API 调用失败（${detail}）。请检查 API Key 与模型配置后重试。`
    );
  }

  const data = (await response.json()) as DeepSeekRawResponse;
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new DeepSeekError("DeepSeek API 未返回内容，请重试。");
  }

  const usage: DeepSeekUsage | undefined =
    typeof data.usage?.prompt_tokens === "number" &&
    typeof data.usage?.completion_tokens === "number"
      ? {
          inputTokens: data.usage.prompt_tokens,
          outputTokens: data.usage.completion_tokens,
        }
      : undefined;

  return { content, usage };
}

export async function analyzeResumeWithDeepSeek(
  resumeText: string,
  jobDescription: string
): Promise<DeepSeekAnalysis> {
  const { apiKey, model } = getConfig();
  const seed = deriveSeed(resumeText, jobDescription);

  const main = await callDeepSeek(apiKey, model, [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: buildUserPrompt(resumeText, jobDescription) },
  ], seed);
  const result = normalizeResult(parseJsonContent(main.content));
  let usage = main.usage;

  // deepseek-v4-flash 偶发会把 interviewQuestions 输出为空数组，用一次聚焦请求补齐
  if (result.interviewQuestions.length === 0) {
    try {
      const repair = await callDeepSeek(apiKey, model, [
        { role: "system", content: REPAIR_SYSTEM_PROMPT },
        {
          role: "user",
          content: buildRepairUserPrompt(resumeText, jobDescription),
        },
      ], seed);
      const raw = (parseJsonContent(repair.content) ?? {}) as Record<
        string,
        unknown
      >;
      const questions = normalizeQuestions(raw.interviewQuestions);
      if (questions.length > 0) {
        result.interviewQuestions = questions;
        if (repair.usage && usage) {
          usage = {
            inputTokens: usage.inputTokens + repair.usage.inputTokens,
            outputTokens: usage.outputTokens + repair.usage.outputTokens,
          };
        } else if (repair.usage) {
          usage = repair.usage;
        }
      }
    } catch {
      // 补齐失败不阻塞主结果，前端会显示兜底提示
    }
  }

  return { result, model, usage };
}

export interface DeepSeekOptimization {
  result: OptimizedResumeResult;
  model: string;
  usage?: DeepSeekUsage;
}

/**
 * 针对 JD 优化简历：返回改写后的完整简历全文。
 * 提示词严格约束：不虚构经历/项目/数字，避免 AI 腔；语言跟随简历原文。
 */
export async function optimizeResumeWithDeepSeek(
  resumeText: string,
  jobDescription: string
): Promise<DeepSeekOptimization> {
  const { apiKey, model } = getConfig();
  const seed = deriveSeed(resumeText, jobDescription);

  const response = await callDeepSeek(
    apiKey,
    model,
    [
      { role: "system", content: OPTIMIZE_SYSTEM_PROMPT },
      {
        role: "user",
        content: buildOptimizeUserPrompt(resumeText, jobDescription),
      },
    ],
    seed
  );

  const raw = (parseJsonContent(response.content) ?? {}) as Record<
    string,
    unknown
  >;
  const optimizedResume = toString(raw.optimizedResume).trim();
  if (!optimizedResume) {
    throw new DeepSeekError("AI 未返回优化后的简历，请重试。");
  }

  return {
    result: { optimizedResume },
    model,
    usage: response.usage,
  };
}
