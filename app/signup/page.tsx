"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toChineseAuthError } from "@/lib/auth-helpers";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Leaf, Loader2, TriangleAlert } from "lucide-react";

function SignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("请输入邮箱");
      return;
    }
    if (password.length < 6) {
      setError("密码至少需要 6 位");
      return;
    }
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);

    if (signUpError) {
      setError(toChineseAuthError(signUpError.message));
      return;
    }

    // 未开启邮箱确认时直接返回会话
    if (data.session) {
      router.push("/");
      router.refresh();
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
          <h1 className="mt-4 text-lg font-extrabold">确认邮件已发送</h1>
          <p className="mt-2 text-sm leading-relaxed text-moss">
            请前往 <span className="font-semibold text-foreground">{email}</span>{" "}
            查收确认邮件，点击邮件中的链接完成注册。
          </p>
          <p className="mt-3 rounded-xl bg-sprout/60 p-3 text-xs leading-relaxed text-moss">
            完成确认后系统会自动登录；若未自动登录，请用注册时的邮箱和密码登录。
            请牢记你的密码，忘记时可使用「忘记密码」找回。
          </p>
          <Link
            href="/login"
            className="mt-6 inline-flex h-11 items-center rounded-full bg-linear-to-br from-leaf-soft to-leaf px-7 font-display font-bold text-white shadow-lg shadow-leaf/30"
          >
            去登录
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
          <h1 className="mt-4 text-xl font-extrabold">注册易小简</h1>
          <p className="mt-1.5 text-sm text-moss">
            创建账号，保存你的简历与分析历史
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
          <div className="space-y-2">
            <label htmlFor="password" className="text-[13.5px] font-semibold">
              密码
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              placeholder="至少 6 位"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
                注册中…
              </>
            ) : (
              "注册"
            )}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-moss">
          已有账号？{" "}
          <Link href="/login" className="font-semibold text-leaf hover:underline">
            登录
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}
