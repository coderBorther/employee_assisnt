/** 供 IDE/tsc 使用的 Deno 全局最小声明（真实环境由 Supabase Edge Runtime 提供）。 */
declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};
