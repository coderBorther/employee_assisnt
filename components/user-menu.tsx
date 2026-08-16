"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { History, KeyRound } from "lucide-react";
import { LogoutButton } from "@/components/logout-button";

/** 顶部用户菜单：我的历史 + 邮箱 + 退出登录。 */
export function UserMenu() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setEmail(data.user?.email ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="ml-auto flex items-center gap-2 sm:gap-3">
      <Link
        href="/history"
        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-card px-3 text-xs font-medium text-moss transition-colors hover:border-mint hover:text-leaf"
      >
        <History className="size-3.5" />
        我的历史
      </Link>
      <Link
        href="/change-password"
        className="hidden h-8 items-center gap-1.5 rounded-full border border-line bg-card px-3 text-xs font-medium text-moss transition-colors hover:border-mint hover:text-leaf sm:inline-flex"
      >
        <KeyRound className="size-3.5" />
        修改密码
      </Link>
      {email && (
        <span className="hidden max-w-44 truncate text-xs text-moss md:inline">
          {email}
        </span>
      )}
      <LogoutButton />
    </div>
  );
}
