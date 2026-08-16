"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2 } from "lucide-react";

export function DeleteAnalysisButton({ id }: { id: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm("确定删除这条分析记录吗？删除后不可恢复。")) return;
    setDeleting(true);
    const supabase = createClient();
    const { error } = await supabase.from("analyses").delete().eq("id", id);
    setDeleting(false);
    if (error) {
      window.alert("删除失败，请重试");
      return;
    }
    router.refresh();
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-8 gap-1.5 rounded-full text-xs text-clay-deep hover:bg-clay/10"
      onClick={handleDelete}
      disabled={deleting}
    >
      {deleting ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Trash2 className="size-3.5" />
      )}
      删除
    </Button>
  );
}
