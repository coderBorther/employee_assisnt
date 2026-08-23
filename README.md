# AI 求职助手

根据目标岗位快速优化求职材料：上传简历 PDF、粘贴岗位描述，AI 生成**岗位匹配度分析、简历优化建议、求职信、10 个面试问题及参考回答**。

## 技术栈

- Next.js 16（App Router）+ TypeScript
- Tailwind CSS v4 + shadcn/ui
- pdfjs-dist（前端 PDF 文字提取）
- tesseract.js（扫描件自动 OCR，chi_sim + eng 自托管）
- DeepSeek API（服务端调用）
- Supabase（Auth 邮箱密码登录 + Postgres 存储 + Storage 私有桶）

## 本地启动

1. 安装依赖（需 Node.js 18.18+ 与 pnpm）：

   ```bash
   pnpm install
   ```

2. 配置环境变量：

   ```bash
   cp .env.example .env.local
   ```

   编辑 `.env.local`，填入 DeepSeek API Key 与 Supabase 项目信息：

   ```bash
   DEEPSEEK_API_KEY=sk-xxxxxxxx
   DEEPSEEK_MODEL=deepseek-v4-flash
   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxx
   FREE_DAILY_ANALYSIS_LIMIT=5
   FREE_DAILY_RESUME_OPTIMIZATION_LIMIT=2
   UNLIMITED_USER_EMAILS=mouringx@126.com
   ```

3. 启动开发服务器：

   ```bash
   pnpm dev
   ```

4. 浏览器打开 http://localhost:3000

## 使用说明

- 需先注册 / 登录（邮箱 + 密码，注册后需点击确认邮件）。
- 简历仅支持 PDF 格式，最大 10MB；扫描件/图片型 PDF 会自动触发 OCR 识别（浏览器端 tesseract.js，中文+英文，资源自托管于 `public/tessdata/`）。
- 岗位描述必填，最长 8000 字符。
- 评分采用固定 4 维度与分档规范，总分由服务端加权计算，采样使用低温度 + 固定 seed：同一简历 + 同一岗位重复分析，评分保持一致；服务端还会对相同输入复用已有成功结果（不重复调用 AI、不消耗配额）。
- 免费账号每天可「智能分析」5 次（`FREE_DAILY_ANALYSIS_LIMIT` 可调）、「AI 简历优化」2 次（`FREE_DAILY_RESUME_OPTIMIZATION_LIMIT` 可调）。
- 「AI 简历优化」：在分析结果或历史详情页点击按钮，AI 会针对该份 JD 改写一份完整简历——严格保留真实任职/项目经历，不虚构任何内容，并避免 AI 腔；结果支持复制与 PDF 下载。
- 白名单账号（`UNLIMITED_USER_EMAILS`，默认 `mouringx@126.com`）两个功能均不限次数。
- 简历 PDF 由服务端 `pdfkit` 生成（文本可选中、可被 ATS 解析），中文渲染使用 Noto Sans SC 子集字体（OFL 许可，见 `public/fonts/OFL.txt`）。
- 简历 PDF 会加密存储到 Supabase 私有桶，简历文字、岗位描述与分析结果会保存到你的账号（仅本人可见），可在「我的历史」中查看或删除。
- 顶部菜单提供「修改密码」（需验证当前密码）；忘记密码可走登录页的「忘记密码？」邮件重置。

## 环境变量

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `DEEPSEEK_API_KEY` | DeepSeek API Key（必填，仅服务端） | 无 |
| `DEEPSEEK_MODEL` | 模型名称 | `deepseek-v4-flash` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 API URL（发送到浏览器） | 无 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 发布密钥（发送到浏览器） | 无 |
| `FREE_DAILY_ANALYSIS_LIMIT` | 免费用户每日「智能分析」次数上限 | `5` |
| `FREE_DAILY_RESUME_OPTIMIZATION_LIMIT` | 免费用户每日「AI 简历优化」次数上限 | `2` |
| `UNLIMITED_USER_EMAILS` | 免限用户邮箱白名单（逗号分隔） | `mouringx@126.com` |

## 数据库

Schema 迁移位于 `supabase/migrations/`，包含 `profiles`、`resumes`、`job_descriptions`、`analyses`、`resume_optimizations`、`usage_events` 六张表与 `resumes` 私有存储桶，全部开启 RLS（仅本人可读写自己的数据）。

## 常用命令

```bash
pnpm dev      # 开发模式
pnpm build    # 生产构建
pnpm start    # 运行生产构建
pnpm lint     # ESLint 检查
```
