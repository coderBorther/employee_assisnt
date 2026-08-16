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
- 免费账号每天可分析 5 次（`FREE_DAILY_ANALYSIS_LIMIT` 可调）。
- 简历 PDF 会加密存储到 Supabase 私有桶，简历文字、岗位描述与分析结果会保存到你的账号（仅本人可见），可在「我的历史」中查看或删除。
- 顶部菜单提供「修改密码」（需验证当前密码）；忘记密码可走登录页的「忘记密码？」邮件重置。

## 环境变量

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `DEEPSEEK_API_KEY` | DeepSeek API Key（必填，仅服务端） | 无 |
| `DEEPSEEK_MODEL` | 模型名称 | `deepseek-v4-flash` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 API URL（发送到浏览器） | 无 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 发布密钥（发送到浏览器） | 无 |
| `FREE_DAILY_ANALYSIS_LIMIT` | 免费用户每日分析次数上限 | `5` |

## 数据库

Schema 迁移位于 `supabase/migrations/`，包含 `profiles`、`resumes`、`job_descriptions`、`analyses`、`usage_events` 五张表与 `resumes` 私有存储桶，全部开启 RLS（仅本人可读写自己的数据）。

## 常用命令

```bash
pnpm dev      # 开发模式
pnpm build    # 生产构建
pnpm start    # 运行生产构建
pnpm lint     # ESLint 检查
```
