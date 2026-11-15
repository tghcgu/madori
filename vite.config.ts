import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";

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

// ビルドするコミットの日付（YYYY-MM-DD）。git が使えなければ、ビルドした日
function buildDate(): string {
  try {
    const date = execSync("git log -1 --format=%cs", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  } catch {
    // 下のビルドした日にする
  }
  return new Date().toISOString().slice(0, 10);
}

// 公開するサイトマップの最終更新日を、ビルドするコミットの日付にする（public/sitemap.xml の日付は手で直さない）。
// Google が読み直す目安になる。いつも古い日付のままだと、当てにされなくなる
function sitemapLastmod(): Plugin {
  let outDir = "dist";
  return {
    name: "sitemap-lastmod",
    apply: "build",
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const file = resolve(outDir, "sitemap.xml");
      try {
        const xml = readFileSync(file, "utf8");
        writeFileSync(file, xml.replace(/<lastmod>[^<]*<\/lastmod>/g, `<lastmod>${buildDate()}</lastmod>`));
      } catch {
        // サイトマップがなければ何もしない
      }
    },
  };
}

export default defineConfig({
  base: process.env.DEPLOY_TARGET === "github" ? "/madori/" : "/",
  server: {
    // 作業用のフォルダ（.codex: テストの画像など）は見張らない。Windows では、書き込み中の画像を見張ろうとして
    // 開発用サーバーが止まり（EBUSY）、E2E が途中で落ちることがある
    watch: { ignored: ["**/.codex/**"] },
  },
  define: {
    __APP_COMMIT__: JSON.stringify(buildCommit()),
  },
  plugins: [sitemapLastmod()],
});
