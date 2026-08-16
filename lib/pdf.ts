export const MAX_PDF_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * pdf.js worker 静态文件（public/pdf.worker.min.mjs）。
 * 直接使用静态路径可避免打包器对 ?url 导入的处理差异。
 */
export const PDF_WORKER_SRC = "/pdf.worker.min.mjs";

export function validatePdfFile(file: File): string | null {
  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) return "仅支持 PDF 格式的简历文件";
  if (file.size > MAX_PDF_SIZE) return "文件大小不能超过 10MB";
  return null;
}

let workerConfigured = false;

/**
 * 在前端用 pdfjs-dist 提取 PDF 文字。仅在浏览器端调用。
 * 使用动态 import，避免在服务端预渲染时执行 pdf.js 代码。
 */
export async function extractTextFromPdf(file: File): Promise<string> {
  const invalid = validatePdfFile(file);
  if (invalid) throw new Error(invalid);

  const pdfjs = await import("pdfjs-dist");
  if (!workerConfigured) {
    pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;
    workerConfigured = true;
  }

  const data = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? (item as { str: string }).str : ""))
      .join(" ");
    pages.push(pageText);
  }
  await doc.loadingTask.destroy();

  return pages
    .join("\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
