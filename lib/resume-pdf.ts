import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";

/** 简历 PDF 服务端生成（pdfkit）。输出含可选中中文字层（ToUnicode），可被 ATS 解析。 */

const FONT_FILE = "NotoSansSC-Regular.otf";
const FONT_SIZE = 11;
const HEADING_FONT_SIZE = 13.5;
const PAGE_MARGIN = 48;
const LINE_GAP = 4;

function isHeading(line: string): boolean {
  return line.startsWith("## ");
}

function stripHeading(line: string): string {
  return line.replace(/^##\s+/, "");
}

/**
 * 加载中文字体：优先从本地 public/ 读取（next dev / next start），
 * 否则回退到从部署站点静态资源获取（无服务器环境，如 Netlify Functions）。
 */
async function loadFontBytes(origin: string): Promise<Buffer> {
  try {
    const local = path.join(process.cwd(), "public", "fonts", FONT_FILE);
    return fs.readFileSync(local);
  } catch {
    // 继续走静态资源回退
  }
  const res = await fetch(new URL(`/fonts/${FONT_FILE}`, origin), {
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new Error("中文字体加载失败，请稍后重试");
  }
  return Buffer.from(await res.arrayBuffer());
}

/** 生成 A4 简历 PDF：「## 」开头的行作为分节标题放大显示，长行自动折行并分页。 */
export async function generateResumePdf(
  resumeText: string,
  title: string,
  origin: string
): Promise<Buffer> {
  const fontBytes = await loadFontBytes(origin);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      // font: null 跳过 pdfkit 默认的 Helvetica 标准字体加载：
      // 否则构造时就会读 node_modules/pdfkit/js/data/Helvetica.afm，
      // 而 Netlify 函数打包时不会带上这些数据文件（ENOENT）。
      font: null as unknown as string,
      margins: {
        top: PAGE_MARGIN,
        bottom: PAGE_MARGIN,
        left: PAGE_MARGIN,
        right: PAGE_MARGIN,
      },
      info: { Title: title },
      bufferPages: true,
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.registerFont("NotoSansSC", fontBytes);

    const contentWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const bottomLimit = doc.page.height - doc.page.margins.bottom;

    const ensureSpace = (needed: number) => {
      if (doc.y + needed > bottomLimit) {
        doc.addPage();
        doc.y = doc.page.margins.top;
      }
    };

    // 标题
    doc.font("NotoSansSC").fontSize(16);
    ensureSpace(24);
    doc.text(title, { width: contentWidth, lineGap: LINE_GAP });
    doc.moveDown(0.5);

    const lines = resumeText.split("\n");
    for (const rawLine of lines) {
      const line = rawLine.trimEnd();
      if (!line.trim()) {
        doc.moveDown(0.4);
        continue;
      }

      const heading = isHeading(line);
      const text = heading ? stripHeading(line) : line;
      doc.font("NotoSansSC").fontSize(heading ? HEADING_FONT_SIZE : FONT_SIZE);

      const height = doc.heightOfString(text, {
        width: contentWidth,
        lineGap: LINE_GAP,
      });
      ensureSpace(heading ? height + 4 : height);
      if (heading) doc.moveDown(0.35);
      doc.text(text, { width: contentWidth, lineGap: LINE_GAP });
    }

    doc.end();
  });
}
