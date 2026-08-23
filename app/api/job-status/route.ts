import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/job-status?kind=analysis|optimization&id=<id>
 * 查询后台任务状态（毫秒级，供前端轮询）。
 * 返回 { status: pending|processing|success|error, result?, errorMessage? }。
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "请先登录后再使用" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("kind");
  const id = searchParams.get("id") ?? "";

  if (kind !== "analysis" && kind !== "optimization") {
    return NextResponse.json({ error: "kind 参数不合法" }, { status: 400 });
  }
  if (!id) {
    return NextResponse.json({ error: "缺少任务 ID" }, { status: 400 });
  }

  const table = kind === "analysis" ? "analyses" : "resume_optimizations";
  const { data, error } = await supabase
    .from(table)
    .select("status, result, error_message")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { error: "任务不存在或无权访问" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    status: data.status,
    result: data.result ?? null,
    errorMessage: data.error_message ?? null,
  });
}
