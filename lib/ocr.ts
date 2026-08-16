import { PDF_WORKER_SRC } from "./pdf";

/** 提取到的文字少于该字符数时，判定为扫描件/图片型 PDF，自动触发 OCR。 */
export const OCR_MIN_TEXT_CHARS = 30;

/** OCR 最多处理的页数，防止超大扫描件耗时过长。 */
export const OCR_MAX_PAGES = 10;

/** 单页渲染缩放（约 2x，兼顾清晰度与内存）。 */
const OCR_RENDER_SCALE = 2;

/** 渲染画布长边上限（像素），防止超大页面导致内存溢出。 */
const OCR_MAX_CANVAS_SIDE = 4096;

/** 自托管于 public/tessdata 的 tesseract.js 资源路径。 */
const TESS_OPTIONS = {
  workerPath: "/tessdata/worker.min.js",
  corePath: "/tessdata/tesseract-core-simd.wasm.js",
  langPath: "/tessdata",
};

export interface OcrProgress {
  currentPage: number;
  totalPages: number;
}

/** 结构最小化，避免依赖包版本差异导致类型摩擦。 */
interface OcrWorker {
  recognize: (
    image: unknown
  ) => Promise<{ data?: { text?: string } }>;
}

let workerPromise: Promise<OcrWorker> | null = null;

async function getWorker(): Promise<OcrWorker> {
  if (!workerPromise) {
    const { createWorker } = await import("tesseract.js");
    workerPromise = (
      createWorker(["chi_sim", "eng"], 1, TESS_OPTIONS) as unknown as Promise<OcrWorker>
    ).catch((err: unknown) => {
      workerPromise = null;
      throw err;
    });
  }
  return workerPromise;
}

/**
 * 对扫描件/图片型 PDF 做客户端 OCR：逐页渲染到 canvas 后交给 tesseract.js 识别。
 * 仅在浏览器端调用（事件处理器中动态加载 pdfjs 与 tesseract.js）。
 */
export async function ocrPdfFromFile(
  file: File,
  onProgress?: (progress: OcrProgress) => void
): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;

  const data = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data });
  const doc = await loadingTask.promise;
  const worker = await getWorker();

  const totalPages = Math.min(doc.numPages, OCR_MAX_PAGES);
  const texts: string[] = [];

  try {
    for (let i = 1; i <= totalPages; i++) {
      onProgress?.({ currentPage: i, totalPages });
      const page = await doc.getPage(i);

      // 计算缩放：默认 2x，长边超过上限时按比例缩小
      const baseViewport = page.getViewport({ scale: 1 });
      const maxSide = Math.max(baseViewport.width, baseViewport.height);
      const scale = Math.min(OCR_RENDER_SCALE, OCR_MAX_CANVAS_SIDE / maxSide);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        throw new Error("无法创建画布，OCR 识别失败");
      }

      await page.render({ canvasContext: ctx, canvas, viewport }).promise;

      const result = await worker.recognize(canvas);
      const text = (result.data?.text ?? "").trim();
      if (text) texts.push(text);

      canvas.width = 0;
      canvas.height = 0;
      page.cleanup();
    }
  } finally {
    await loadingTask.destroy();
  }

  const combined = texts.join("\n\n").trim();
  if (!combined) {
    throw new Error(
      "自动 OCR 未能识别出文字：这份 PDF 可能是低清晰度扫描件或图片型 PDF，请尝试更清晰的版本。"
    );
  }
  return combined;
}
