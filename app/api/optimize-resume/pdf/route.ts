import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateResumePdf } from "@/lib/resume-pdf";

/** 从用户输入的文件名里提取一个安全的文件名主体（不含路径/引号/控制字符）。 */
function sanitizeBaseName(input: string | null | undefined): string {
  if (!input) return "优化简历";
  const cleaned = input
    .replace(/[\\/:"*?<>|\u0000-\u001f]/g, "")
    .replace(/\.pdf$/i, "")
    .trim()
    .slice(0, 60);
  return cleaned.length > 0 ? cleaned : "优化简历";
}

/**
 * POST /api/optimize-resume/pdf
 * 根据优化记录（optimizationId）生成并下载简历 PDF（服务端 pdfkit）。
 * 不消耗配额：配额只针对 AI 生成环节。
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "请先登录后再使用" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求格式不正确" }, { status: 400 });
  }

  const data = (body ?? {}) as Record<string, unknown>;
  const optimizationId =
    typeof data.optimizationId === "string" ? data.optimizationId : "";
  if (!optimizationId) {
    return NextResponse.json({ error: "缺少优化记录 ID" }, { status: 400 });
  }

  const { data: optimization, error: optError } = await supabase
    .from("resume_optimizations")
    .select("status, result")
    .eq("id", optimizationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (optError || !optimization) {
    return NextResponse.json(
      { error: "优化记录不存在或无权访问" },
      { status: 404 }
    );
  }
  if (optimization.status !== "success") {
    return NextResponse.json(
      { error: "优化尚未完成，请稍后重试" },
      { status: 400 }
    );
  }

  const result = (optimization.result ?? {}) as Record<string, unknown>;
  const optimizedResume =
    typeof result.optimizedResume === "string" ? result.optimizedResume : "";
  if (!optimizedResume.trim()) {
    return NextResponse.json(
      { error: "优化结果内容为空，请重新生成" },
      { status: 400 }
    );
  }

  const baseName = sanitizeBaseName(
    typeof data.fileName === "string" ? data.fileName : null
  );
  const title = `${baseName}（AI 优化版）`;

  try {
    const pdf = await generateResumePdf(optimizedResume, title, request.nextUrl.origin);
    const fileName = `${baseName}-优化版.pdf`;

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(
          fileName
        )}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "PDF 生成失败，请稍后重试";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
