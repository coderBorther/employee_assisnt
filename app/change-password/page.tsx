"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toChineseAuthError } from "@/lib/auth-helpers";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, KeyRound, Loader2, TriangleAlert } from "lucide-react";

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      setError("请输入当前密码");
      return;
    }
    if (newPassword.length < 6) {
      setError("新密码至少需要 6 位");
      return;
    }
    if (newPassword !== confirm) {
      setError("两次输入的新密码不一致");
      return;
    }
    if (newPassword === currentPassword) {
      setError("新密码不能与当前密码相同");
      return;
    }

    setLoading(true);
    setError("");

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) {
      setLoading(false);
      setError("登录状态已失效，请重新登录");
      return;
    }

    // 1) 用当前密码重新登录，验证身份
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (verifyError) {
      setLoading(false);
      const msg = verifyError.message.toLowerCase();
      if (msg.includes("invalid login credentials")) {
        setError("当前密码错误");
      } else {
        setError(toChineseAuthError(verifyError.message));
      }
      return;
    }

    // 2) 设置新密码
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (updateError) {
      setLoading(false);
      setError(toChineseAuthError(updateError.message));
      return;
    }

    // 3) 退出登录，回到登录页用新密码重新登录
    await supabase.auth.signOut();
    setLoading(false);
    setDone(true);
  };

  if (done) {
    return (
      <div className="flex min-h-full flex-1 flex-col items-center justify-center px-4 py-14">
        <div className="w-full max-w-sm rounded-2xl border border-line bg-card p-8 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-sprout text-leaf">
            <CheckCircle2 className="size-6" />
          </div>
          <h1 className="mt-4 text-lg font-extrabold">密码已修改</h1>
          <p className="mt-2 text-sm text-moss">请使用新密码重新登录。</p>
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
            <KeyRound className="size-6" />
          </div>
          <h1 className="mt-4 text-xl font-extrabold">修改密码</h1>
          <p className="mt-1.5 text-sm text-moss">先验证当前密码，再设置新密码</p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <TriangleAlert className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="current-password" className="text-[13.5px] font-semibold">
              当前密码
            </label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="请输入当前密码"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="h-10 rounded-xl border-line bg-card px-3.5 text-sm"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="new-password" className="text-[13.5px] font-semibold">
              新密码
            </label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              placeholder="至少 6 位"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="h-10 rounded-xl border-line bg-card px-3.5 text-sm"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="confirm-password" className="text-[13.5px] font-semibold">
              确认新密码
            </label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              required
              placeholder="再次输入新密码"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
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
                提交中…
              </>
            ) : (
              "确认修改"
            )}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-moss">
          <Link href="/history" className="font-semibold text-leaf hover:underline">
            返回我的历史
          </Link>
        </p>
      </div>
    </div>
  );
}
