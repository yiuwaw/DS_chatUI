// dsh-chat-avatar Node half：为头像图片提供静态文件服务。
// 浏览器 half 通过 /dsh-chat-avatar/assets/<文件名> 读取 avatars/ 目录下的图片。
import { readFileSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const name = "dsh-chat-avatar";
export const inject = ["webServer"];

const AVATARS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "avatars");

const CONTENT_TYPES = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

function contentTypeFor(file) {
  return CONTENT_TYPES[extname(file).toLowerCase()] ?? "application/octet-stream";
}

/** 只允许纯文件名（不含路径分隔符），防目录穿越。 */
function safeAvatarName(pathname) {
  const rel = pathname.replace(/^\/dsh-chat-avatar\/assets\//, "");
  if (rel === "" || rel.includes("..") || rel.includes("/") || rel.includes("\\")) return null;
  return rel;
}

export function apply(ctx) {
  ctx.webServer.register({
    kind: "prefix",
    path: "/dsh-chat-avatar/assets",
    handler: (req, res) => {
      if (req.method !== "GET" && req.method !== "HEAD") {
        res.writeHead(405);
        res.end();
        return;
      }
      let pathname;
      try {
        pathname = decodeURIComponent(new URL(req.url ?? "/", "http://dsh.internal").pathname);
      } catch {
        res.writeHead(400);
        res.end();
        return;
      }
      const name = safeAvatarName(pathname);
      if (name === null) {
        res.writeHead(403);
        res.end();
        return;
      }
      try {
        const data = readFileSync(join(AVATARS_DIR, name));
        res.writeHead(200, {
          "content-type": contentTypeFor(name),
          "cache-control": "no-cache",
        });
        res.end(data);
      } catch {
        res.writeHead(404);
        res.end();
      }
    },
  });
}
