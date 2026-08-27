// dsh-chat-avatar Node half：
// - 通过 /dsh-chat-avatar/assets/<文件名> 服务 avatars/ 目录下的本地头像图片。
// - 通过 /dsh-chat-avatar/upload/<角色> 接收设置页选择的电脑图片。
import { readFileSync, existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const name = "dsh-chat-avatar";
// settings 是可选能力：没有设置服务时仍可使用本地/默认头像。
export const inject = ["webServer"];

const AVATARS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "avatars");
let UPLOADED_AVATARS_DIR = AVATARS_DIR;

const CONTENT_TYPES = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const UPLOAD_TYPES = Object.freeze({
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
});
const ALLOWED_UPLOAD_EXTENSIONS = new Set(Object.values(UPLOAD_TYPES));

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
  if (rel === "user" || rel === "ai") {
    for (const ext of ALLOWED_UPLOAD_EXTENSIONS) {
      const custom = join(UPLOADED_AVATARS_DIR, `${rel}.custom${ext}`);
      if (existsSync(custom)) return custom;
    }
  }
  const full = join(AVATARS_DIR, rel);
  if (extname(rel) !== "") return full;
  for (const ext of [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"]) {
    const candidate = full + ext;
    if (existsSync(candidate)) return candidate;
  }
  return full;
}

function uploadExtension(req) {
  const contentType = String(req.headers["content-type"] ?? "").split(";", 1)[0].trim().toLowerCase();
  if (UPLOAD_TYPES[contentType] !== undefined) return UPLOAD_TYPES[contentType];
  const headerExt = String(req.headers["x-avatar-extension"] ?? "").trim().toLowerCase();
  return ALLOWED_UPLOAD_EXTENSIONS.has(headerExt) ? headerExt : null;
}

function readUpload(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_UPLOAD_BYTES) {
        tooLarge = true;
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (tooLarge) reject(Object.assign(new Error("image too large"), { code: "TOO_LARGE" }));
      else resolve(Buffer.concat(chunks));
    });
    req.on("error", reject);
  });
}

function matchesImageType(data, ext) {
  if (ext === ".png") return data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (ext === ".jpg") return data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  if (ext === ".gif") return data.subarray(0, 6).toString("ascii") === "GIF87a" || data.subarray(0, 6).toString("ascii") === "GIF89a";
  if (ext === ".webp") return data.length >= 12 && data.subarray(0, 4).toString("ascii") === "RIFF" && data.subarray(8, 12).toString("ascii") === "WEBP";
  return false;
}

function removeCustomAvatars(base, keep = null) {
  if (!existsSync(UPLOADED_AVATARS_DIR)) return;
  for (const name of readdirSync(UPLOADED_AVATARS_DIR)) {
    if (!name.startsWith(`${base}.custom.`)) continue;
    const file = join(UPLOADED_AVATARS_DIR, name);
    if (file !== keep) unlinkSync(file);
  }
}

function json(res, status, body, extra = {}) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra });
  res.end(JSON.stringify(body));
}

export function apply(ctx) {
  // 上传图片放在当前 DSH 设置文件旁，避免插件更新覆盖；无本地文件设置时回退到包目录。
  ctx.inject(["settings"], (settingsCtx) => {
    if (typeof settingsCtx.settings.documentPath === "string") {
      UPLOADED_AVATARS_DIR = join(dirname(settingsCtx.settings.documentPath), "dsh-chat-avatar");
      mkdirSync(UPLOADED_AVATARS_DIR, { recursive: true });
    }
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

  // ---- 从设置卡片上传电脑图片；保存为 user.custom.* / ai.custom.* ----
  ctx.webServer.register({
    kind: "prefix",
    path: "/dsh-chat-avatar/upload",
    handler: (req, res) => {
      void (async () => {
        let pathname;
        try {
          pathname = decodeURIComponent(new URL(req.url ?? "/", "http://dsh.internal").pathname);
        } catch {
          json(res, 400, { error: "invalid request URL" });
          return;
        }
        const match = /^\/dsh-chat-avatar\/upload\/(user|assistant)$/.exec(pathname);
        if (match === null) {
          json(res, 404, { error: "avatar role not found" });
          return;
        }
        const role = match[1];
        const base = role === "user" ? "user" : "ai";

        if (req.method === "DELETE") {
          removeCustomAvatars(base);
          json(res, 200, { url: `/dsh-chat-avatar/assets/${base}?v=${Date.now()}` });
          return;
        }
        if (req.method !== "POST") {
          json(res, 405, { error: "method not allowed; use POST or DELETE" }, { allow: "POST, DELETE" });
          return;
        }

        const ext = uploadExtension(req);
        if (ext === null) {
          json(res, 415, { error: "supported formats: png, jpg, webp, gif" });
          return;
        }
        try {
          const data = await readUpload(req);
          if (!matchesImageType(data, ext)) {
            json(res, 415, { error: "file content does not match its image format" });
            return;
          }
          mkdirSync(UPLOADED_AVATARS_DIR, { recursive: true });
          const target = join(UPLOADED_AVATARS_DIR, `${base}.custom${ext}`);
          writeFileSync(target, data);
          removeCustomAvatars(base, target);
          json(res, 200, { url: `/dsh-chat-avatar/assets/${base}?v=${Date.now()}` });
        } catch (error) {
          if (error?.code === "TOO_LARGE") {
            json(res, 413, { error: "image must be 5 MB or smaller" });
          } else {
            json(res, 500, { error: "failed to save avatar image" });
          }
        }
      })().catch(() => {
        if (!res.headersSent) json(res, 500, { error: "avatar request failed" });
      });
    },
  });

}
