"use client";

import {
  Dialog,
  DialogPortal,
  DialogBackdrop,
  DialogPopup,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { CONCURRENCY_LIMIT_MESSAGE } from "@/lib/constants";

/**
 * 并发超限弹窗：同一账号在途任务（分析/优化合计）已达 3 个时弹出。
 * 文案精确为「小简八百里加急处理简历中,大人请稍等片刻~」。
 */
export function ConcurrencyLimitDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup>
          <DialogTitle>任务繁忙</DialogTitle>
          <DialogDescription className="mt-3 text-[15px]">
            {CONCURRENCY_LIMIT_MESSAGE}
          </DialogDescription>
          <div className="mt-6 flex justify-end">
            <DialogClose className="inline-flex h-9 items-center gap-1.5 rounded-full bg-linear-to-br from-leaf-soft to-leaf px-5 text-sm font-bold text-white shadow-lg shadow-leaf/30 transition-colors hover:from-leaf-soft hover:to-leaf-deep">
              好的
            </DialogClose>
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}
