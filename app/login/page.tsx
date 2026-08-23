"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toChineseAuthError } from "@/lib/auth-helpers";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Leaf, Loader2, TriangleAlert } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("请输入邮箱和密码");
      return;
    }
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);

    if (signInError) {
      setError(toChineseAuthError(signInError.message));
      return;
    }

    const next = searchParams.get("next");
    const target =
      next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
    router.push(target);
    router.refresh();
  };

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center px-4 py-14">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-linear-to-br from-mint to-leaf text-white shadow-lg shadow-leaf/25">
            <Leaf className="size-6" />
          </div>
          <h1 className="mt-4 text-xl font-extrabold">易小简 —— 一个省事靠谱的求职助手</h1>
          <p className="mt-1.5 text-sm text-moss">
            别再海投了，先测匹配度
          </p>
        </div>

        {searchParams.get("error") === "auth" && (
          <Alert variant="destructive" className="mb-4">
            <TriangleAlert className="size-4" />
            <AlertDescription>登录链接无效或已过期，请重新登录</AlertDescription>
          </Alert>
        )}

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
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-[13.5px] font-semibold">
                密码
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-moss hover:text-leaf hover:underline"
              >
                忘记密码？
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="请输入密码"
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
                登录中…
              </>
            ) : (
              "登录"
            )}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-moss">
          还没有账号？{" "}
          <Link href="/signup" className="font-semibold text-leaf hover:underline">
            注册
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
