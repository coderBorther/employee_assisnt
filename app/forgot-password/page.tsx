"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toChineseAuthError } from "@/lib/auth-helpers";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Leaf, Loader2, TriangleAlert } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("请输入邮箱");
      return;
    }
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      }
    );
    setLoading(false);
    if (resetError) {
      const msg = resetError.message.toLowerCase();
      if (msg.includes("rate limit") || msg.includes("too many")) {
        setError("邮件发送过于频繁（服务商限流），请约 1 小时后再试");
      } else {
        setError(toChineseAuthError(resetError.message));
      }
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <div className="flex min-h-full flex-1 flex-col items-center justify-center px-4 py-14">
        <div className="w-full max-w-sm rounded-2xl border border-line bg-card p-8 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-sprout text-leaf">
            <CheckCircle2 className="size-6" />
          </div>
          <h1 className="mt-4 text-lg font-extrabold">重置邮件已发送</h1>
          <p className="mt-2 text-sm leading-relaxed text-moss">
            请前往 <span className="font-semibold text-foreground">{email}</span>{" "}
            查收邮件，点击邮件中的链接设置新密码。
          </p>
          <p className="mt-3 text-xs text-moss-light">
            如果几分钟内没有收到，请检查垃圾邮件，或确认邮箱地址是否正确。
          </p>
          <Link
            href="/login"
            className="mt-6 inline-flex h-11 items-center rounded-full bg-linear-to-br from-leaf-soft to-leaf px-7 font-display font-bold text-white shadow-lg shadow-leaf/30"
          >
            返回登录
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center px-4 py-14">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-linear-to-br from-mint to-leaf text-white shadow-lg shadow-leaf/25">
            <Leaf className="size-6" />
          </div>
          <h1 className="mt-4 text-xl font-extrabold">忘记密码</h1>
          <p className="mt-1.5 text-sm text-moss">
            输入注册邮箱，我们会发送一封重置密码的邮件
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <TriangleAlert className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-[13.5px] font-semibold">
              邮箱
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 rounded-xl border-line bg-card px-3.5 text-sm"
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="h-11 w-full gap-2 rounded-full bg-linear-to-br from-leaf-soft to-leaf font-display font-bold shadow-lg shadow-leaf/30"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                发送中…
              </>
            ) : (
              "发送重置邮件"
            )}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-moss">
          想起密码了？{" "}
          <Link href="/login" className="font-semibold text-leaf hover:underline">
            返回登录
          </Link>
        </p>
      </div>
    </div>
  );
}
