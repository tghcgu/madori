import { execSync } from "node:child_process";
import { defineConfig } from "vite";

// ご意見・ご要望のフォームに自動で入れる、アプリの版（コミットの番号）。
// Cloudflare Pages と GitHub Actions では、ビルドするコミットが環境変数で渡される
function buildCommit(): string {
  const fromCi = process.env.CF_PAGES_COMMIT_SHA || process.env.GITHUB_SHA;
  if (fromCi) return fromCi.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim() || "dev";
  } catch {
    return "dev";
  }
}

export default defineConfig({
  base: process.env.DEPLOY_TARGET === "github" ? "/madori/" : "/",
  define: {
    __APP_COMMIT__: JSON.stringify(buildCommit()),
  },
});
