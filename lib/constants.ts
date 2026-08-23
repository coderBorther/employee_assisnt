/** 共享常量：长度限制、默认模型、用量事件类型。 */

export const MAX_RESUME_LENGTH = 30_000;
export const MAX_JOB_DESCRIPTION_LENGTH = 8_000;

export const DEFAULT_MODEL = "deepseek-v4-flash";

export const EVENT_TYPE_ANALYSIS = "analysis";
export const EVENT_TYPE_RESUME_OPTIMIZATION = "resume_optimization";

/** 免费用户每日配额的环境变量名。 */
export const FREE_DAILY_ANALYSIS_LIMIT_ENV = "FREE_DAILY_ANALYSIS_LIMIT";
export const FREE_DAILY_RESUME_OPTIMIZATION_LIMIT_ENV =
  "FREE_DAILY_RESUME_OPTIMIZATION_LIMIT";

/** 免限用户邮箱白名单环境变量（逗号分隔，大小写不敏感）。 */
export const UNLIMITED_USER_EMAILS_ENV = "UNLIMITED_USER_EMAILS";

/** 后台 worker（Supabase Edge Function）的完整 URL；设置后走异步入队，未设置则本地同步调用。 */
export const RESUME_WORKER_URL_ENV = "RESUME_WORKER_URL";

/** 每用户「智能分析 + 简历优化」在途任务（pending+processing）合计上限。 */
export const MAX_CONCURRENT_JOBS = 3;

/** 超过并发上限时的友好提示（前端弹窗文案，精确保持一致）。 */
export const CONCURRENCY_LIMIT_MESSAGE = "小简八百里加急处理简历中,大人请稍等片刻~";

/** 并发超限响应的错误码，前端据此弹出对话框。 */
export const CONCURRENCY_LIMIT_CODE = "CONCURRENCY_LIMIT";
