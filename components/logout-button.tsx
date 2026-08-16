"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8 gap-1.5 rounded-full text-xs"
      onClick={handleLogout}
    >
      <LogOut className="size-3.5" />
      退出登录
    </Button>
  );
}
