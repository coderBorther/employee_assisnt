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
