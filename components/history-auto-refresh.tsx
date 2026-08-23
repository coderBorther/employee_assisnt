"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * 历史列表/详情页的轻量自动刷新：只要还有在途任务（pending/processing），
 * 每 3 秒调用 router.refresh() 重新拉取服务端数据；全部终态后停止。
 */
export function HistoryAutoRefresh({ hasActive }: { hasActive: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!hasActive) return;
    const timer = setInterval(() => {
      router.refresh();
    }, 3000);
    return () => clearInterval(timer);
  }, [hasActive, router]);

  return null;
}
