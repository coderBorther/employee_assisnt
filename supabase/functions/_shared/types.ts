// 与 lib/types.ts 保持同步（两处需一致）。
// Edge Function（Deno）无法直接复用 Next.js 的 lib/，故独立维护一份副本。
export type Priority = "high" | "medium" | "low";

/** 固定评分维度的稳定标识（名称会随输出语言翻译，key 恒定）。 */
export type DimensionKey = "skill" | "experience" | "education" | "overall";

export interface DimensionScore {
  key?: DimensionKey;
  name: string;
  score: number;
  comment: string;
}

export interface MatchAnalysis {
  totalScore: number;
  dimensions: DimensionScore[];
  summary: string;
  gapAnalysis: string;
}

export interface ResumeSuggestion {
  category: string;
  priority: Priority;
  suggestion: string;
}

export interface InterviewQuestion {
  question: string;
  referenceAnswer: string;
}

export interface AnalysisResult {
  matchAnalysis: MatchAnalysis;
  resumeSuggestions: ResumeSuggestion[];
  coverLetter: string;
  interviewQuestions: InterviewQuestion[];
}

/** 「AI 简历优化」的输出：针对 JD 改写后的完整简历全文。 */
export interface OptimizedResumeResult {
  optimizedResume: string;
}
