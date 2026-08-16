export type Priority = "high" | "medium" | "low";

/** 固定评分维度的稳定标识（名称会随输出语言翻译，key 恒定）。 */
export type DimensionKey = "skill" | "experience" | "education" | "overall";

export interface DimensionScore {
  /** 维度标识（旧数据可能缺失，缺失时按简单平均兜底） */
  key?: DimensionKey;
  name: string;
  /** 0-100 的整数评分 */
  score: number;
  comment: string;
}

export interface MatchAnalysis {
  /** 0-100 的整数总评分 */
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
