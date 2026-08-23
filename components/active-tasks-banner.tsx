"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

/**
 * 首页轻量横幅：挂载时一次性查询在途任务（pending/processing）数量，
 * 有任务在跑时提示可前往「我的历史」查看进度（不做连续轮询）。
 */
export function ActiveTasksBanner() {
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const [analysisRes, optimizationRes] = await Promise.all([
        supabase
          .from("analyses")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .in("status", ["pending", "processing"]),
        supabase
          .from("resume_optimizations")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .in("status", ["pending", "processing"]),
      ]);
      if (cancelled) return;
      setActive((analysisRes.count ?? 0) + (optimizationRes.count ?? 0));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!active || active <= 0) return null;

  return (
    <Link
      href="/history"
      className="mb-6 flex items-center gap-2.5 rounded-2xl border border-sprout-deep bg-sprout/70 px-4 py-3 text-sm font-semibold text-leaf transition-colors hover:bg-sprout"
    >
      <Loader2 className="size-4 shrink-0 animate-spin" />
      <span>
        有 {active} 个任务正在后台处理中，任务不会因离开页面而中断，可前往「我的历史」查看进度。
      </span>
    </Link>
  );
}
