export type Priority = "high" | "medium" | "low";

export interface DimensionScore {
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
