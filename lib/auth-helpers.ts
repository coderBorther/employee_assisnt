/** 把 Supabase Auth 的英文错误转成用户可理解的中文提示。 */
export function toChineseAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) {
    return "邮箱或密码错误";
  }
  if (m.includes("not confirmed")) {
    return "邮箱尚未确认，请先点击确认邮件中的链接";
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return "请求过于频繁，请稍后再试";
  }
  if (m.includes("already registered") || m.includes("already exists")) {
    return "该邮箱已注册，请直接登录";
  }
  if (m.includes("password")) {
    return "密码不符合要求（至少 6 位）";
  }
  return message;
}
