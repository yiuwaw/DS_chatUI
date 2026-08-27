// dsh-chat-avatar Node half：
// - 注册 settings namespace（dsh-chat-avatar），在「设置 → 插件 → 插件配置」里可编辑头像 URL；
// - 通过 /dsh-chat-avatar/config 把当前配置暴露给浏览器 half；
// - 通过 /dsh-chat-avatar/assets/<文件名> 服务 avatars/ 目录下的本地头像图片。
import { readFileSync, existsSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import z from "schemastery";

export const name = "dsh-chat-avatar";
// settings 是可选能力：没有设置服务时仍可使用本地/默认头像。
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

const NAMESPACE = "dsh-chat-avatar";
const DEFAULTS = Object.freeze({
  userAvatar: "",
  assistantAvatar: "",
});

function contentTypeFor(file) {
  return CONTENT_TYPES[extname(file).toLowerCase()] ?? "application/octet-stream";
}

/** 纯文件名（不含路径分隔符），防目录穿越。 */
function avatarRel(pathname) {
  const rel = pathname.replace(/^\/dsh-chat-avatar\/assets\//, "");
  if (rel === "" || rel.includes("..") || rel.includes("/") || rel.includes("\\")) return null;
  return rel;
}

/** 解析实际文件：带扩展名直接找；不带扩展名自动匹配 user.png / ai.jpg 等。 */
function resolveAvatarFile(rel) {
  const full = join(AVATARS_DIR, rel);
  if (extname(rel) !== "") return full;
  for (const ext of [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"]) {
    const candidate = full + ext;
    if (existsSync(candidate)) return candidate;
  }
  return full;
}

function json(res, status, body, extra = {}) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra });
  res.end(JSON.stringify(body));
}

export function apply(ctx) {
  // ---- settings 配置（「设置 → 插件 → 插件配置」里的卡片会写这里）----
  let config = { ...DEFAULTS };
  ctx.inject(["settings"], (settingsCtx) => {
    const scope = settingsCtx.settings.register(
      NAMESPACE,
      z.object({
        userAvatar: z.string().default(DEFAULTS.userAvatar),
        assistantAvatar: z.string().default(DEFAULTS.assistantAvatar),
      }),
      { applies: "live" },
    );
    config = { ...DEFAULTS, ...scope.get() };
    settingsCtx.effect(() =>
      scope.watch((next) => {
        config = { ...DEFAULTS, ...next };
      }),
    );
  });

  // ---- 本地头像文件服务（保留：把图片放进 avatars/ 目录仍可用）----
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
      const rel = avatarRel(pathname);
      if (rel === null) {
        res.writeHead(403);
        res.end();
        return;
      }
      const file = resolveAvatarFile(rel);
      try {
        const data = readFileSync(file);
        res.writeHead(200, {
          "content-type": contentTypeFor(file),
          "cache-control": "no-cache",
        });
        res.end(data);
      } catch {
        res.writeHead(404);
        res.end();
      }
    },
  });

  // ---- 当前配置端点（浏览器 half 拉取后覆盖 CSS 变量）----
  ctx.webServer.register({
    kind: "exact",
    path: "/dsh-chat-avatar/config",
    handler: (req, res) => {
      if (req.method !== "GET") {
        json(res, 405, { error: "method not allowed; use GET" }, { allow: "GET" });
        return;
      }
      json(res, 200, config);
    },
  });
}
