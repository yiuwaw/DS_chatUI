// dsh-chat-avatar browser half：
// - 注入聊天头像 CSS（默认本地 avatars 路由，可用设置覆盖为任意图片 URL）；
// - 注册「设置 → 插件 → 插件配置」卡片，从电脑选择并上传头像图片。
window.__ModuleLoader__.load({
  id: "dsh-chat-avatar",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    const react = require("react");
    const jsx = require("react/jsx-runtime");
    const { createSnapshotStore } = require("@deepseek-ai/dsh-client-runtime/client");

    const STYLE_ATTR = "data-dsh-chat-avatar";
    const NAMESPACE = "dsh-chat-avatar";

    // 默认用户头像 fallback：浅灰底 + 人形剪影
    const USER_AVATAR_FALLBACK =
      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'>" +
      "<rect width='40' height='40' rx='8' fill='#e8ecf3'/>" +
      "<circle cx='20' cy='15' r='6' fill='#8b93a7'/>" +
      "<path d='M7 35c2.6-7.2 7-10.8 13-10.8s10.4 3.6 13 10.8Z' fill='#8b93a7'/>" +
      "</svg>";

    // 默认 AI 头像 fallback：DeepSeek 风格渐变 + "AI" 字样
    const AI_AVATAR_FALLBACK =
      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'>" +
      "<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>" +
      "<stop offset='0' stop-color='#4d6bfe'/>" +
      "<stop offset='1' stop-color='#7c3aed'/>" +
      "</linearGradient></defs>" +
      "<rect width='40' height='40' rx='8' fill='url(#g)'/>" +
      "<text x='20' y='26' font-family='Arial, sans-serif' font-size='14' font-weight='700' " +
      "fill='#ffffff' text-anchor='middle'>AI</text>" +
      "</svg>";

    const CSS = `
:root {
  --dsh-chat-avatar-user: url("/dsh-chat-avatar/assets/user"), url("data:image/svg+xml,${encodeURIComponent(USER_AVATAR_FALLBACK)}");
  --dsh-chat-avatar-assistant: url("/dsh-chat-avatar/assets/ai"), url("data:image/svg+xml,${encodeURIComponent(AI_AVATAR_FALLBACK)}");
  --dsh-chat-avatar-size: 36px;
  --dsh-chat-avatar-radius: 8px;
}

/* 用户消息（含 steering）：头像在整行右上角 */
[data-chat-flow-kind="user"],
[data-chat-flow-kind="steering"] {
  position: relative;
  padding-right: calc(var(--dsh-chat-avatar-size) + 12px);
  min-height: var(--dsh-chat-avatar-size);
}
[data-chat-flow-kind="user"]::after,
[data-chat-flow-kind="steering"]::after {
  content: "";
  position: absolute;
  right: 0;
  top: 2px;
  width: var(--dsh-chat-avatar-size);
  height: var(--dsh-chat-avatar-size);
  border-radius: var(--dsh-chat-avatar-radius);
  background: var(--dsh-chat-avatar-user);
  background-size: cover;
  background-repeat: no-repeat;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18);
}

/* AI 消息：头像在整行左上角 */
[data-chat-flow-kind="assistant-step"] {
  position: relative;
  padding-left: calc(var(--dsh-chat-avatar-size) + 12px);
  min-height: var(--dsh-chat-avatar-size);
}
[data-chat-flow-kind="assistant-step"]::before {
  content: "";
  position: absolute;
  left: 0;
  top: 2px;
  width: var(--dsh-chat-avatar-size);
  height: var(--dsh-chat-avatar-size);
  border-radius: var(--dsh-chat-avatar-radius);
  background: var(--dsh-chat-avatar-assistant);
  background-size: cover;
  background-repeat: no-repeat;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18);
}

@media (max-width: 640px) {
  :root {
    --dsh-chat-avatar-size: 30px;
  }
}
`;

    /** 把 URL 安全地写进 CSS 变量；空值恢复默认。 */
    function applyAvatarUrl(variable, value) {
      const root = document.documentElement;
      const trimmed = typeof value === "string" ? value.trim() : "";
      if (trimmed === "") {
        root.style.removeProperty(variable);
        return;
      }
      const safe = trimmed.replace(/["\\\n\r]/g, "");
      root.style.setProperty(variable, `url("${safe}")`);
    }

    function applyRemoteConfig(config) {
      if (config === null || typeof config !== "object") return;
      applyAvatarUrl("--dsh-chat-avatar-user", config.userAvatar);
      applyAvatarUrl("--dsh-chat-avatar-assistant", config.assistantAvatar);
    }

    /** 设置卡片控制器：保留旧 URL 配置读取，并提供本地图片上传。 */
    function createCardController(scope, onConfig) {
      function read() {
        const s = scope.getSnapshot();
        return {
          available: s.status === "ready",
          writable: s.writable !== false,
          userAvatar: typeof s.value?.userAvatar === "string" ? s.value.userAvatar : "",
          assistantAvatar: typeof s.value?.assistantAvatar === "string" ? s.value.assistantAvatar : "",
        };
      }
      const store = createSnapshotStore(read());
      function publish() {
        const state = read();
        store.set(state);
        if (state.available) {
          onConfig({
            userAvatar: state.userAvatar,
            assistantAvatar: state.assistantAvatar,
          });
        }
      }
      scope.subscribe(publish);
      publish();
      return {
        scope,
        store,
        inject() {
          return {
            hooks: { chatAvatarCard: store },
            async uploadAvatar(role, file) {
              const extMatch = /\.[^.]+$/.exec(file.name);
              const response = await fetch(`/dsh-chat-avatar/upload/${role}`, {
                method: "POST",
                headers: {
                  "content-type": file.type || "application/octet-stream",
                  "x-avatar-extension": extMatch === null ? "" : extMatch[0].toLowerCase(),
                },
                body: file,
              });
              const result = await response.json().catch(() => ({}));
              if (!response.ok) throw new Error(result.error || "上传失败");
              applyAvatarUrl(
                role === "user" ? "--dsh-chat-avatar-user" : "--dsh-chat-avatar-assistant",
                result.url,
              );
              return result.url;
            },
            async resetAvatar(role) {
              const response = await fetch(`/dsh-chat-avatar/upload/${role}`, { method: "DELETE" });
              const result = await response.json().catch(() => ({}));
              if (!response.ok) throw new Error(result.error || "恢复默认头像失败");
              applyAvatarUrl(
                role === "user" ? "--dsh-chat-avatar-user" : "--dsh-chat-avatar-assistant",
                result.url,
              );
              return result.url;
            },
          };
        },
      };
    }

    /** 「插件配置」里的卡片组件。 */
    function ChatAvatarCard(props) {
      const state = props.useChatAvatarCard((s) => s);
      const [preview, setPreview] = react.useState({
        user: `/dsh-chat-avatar/assets/user?v=${Date.now()}`,
        assistant: `/dsh-chat-avatar/assets/ai?v=${Date.now()}`,
      });
      const [busy, setBusy] = react.useState("");
      const [message, setMessage] = react.useState("");

      if (!state.available) return null;

      const pickerStyle = {
        display: "flex",
        alignItems: "center",
        gap: "12px",
        margin: "14px 0",
        padding: "12px",
        border: "1px solid var(--dsw-alias-border-l1, #ddd)",
        borderRadius: "10px",
      };
      const buttonStyle = {
        padding: "7px 14px",
        fontSize: "13px",
        borderRadius: "8px",
        border: "1px solid var(--dsw-alias-border-l1, #ccc)",
        background: "transparent",
        color: "var(--dsw-alias-label-primary, #111)",
        cursor: busy === "" ? "pointer" : "not-allowed",
        opacity: busy === "" ? 1 : 0.5,
      };

      async function upload(role, file, input) {
        if (file.size > 5 * 1024 * 1024) {
          setMessage("图片不能超过 5 MB");
          input.value = "";
          return;
        }
        setBusy(role);
        setMessage("");
        try {
          const url = await props.uploadAvatar(role, file);
          setPreview((current) => ({ ...current, [role]: url }));
          setMessage("头像已保存并立即生效");
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "上传失败");
        } finally {
          setBusy("");
          input.value = "";
        }
      }

      async function reset(role) {
        setBusy(role);
        setMessage("");
        try {
          const url = await props.resetAvatar(role);
          setPreview((current) => ({ ...current, [role]: url }));
          setMessage("已恢复本地或插件内置头像");
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "恢复失败");
        } finally {
          setBusy("");
        }
      }

      function picker(role, label) {
        return jsx("div", {
          key: role,
          style: pickerStyle,
          children: [
            jsx("img", {
              key: "preview",
              src: preview[role],
              alt: label,
              style: { width: "48px", height: "48px", objectFit: "cover", borderRadius: "10px" },
            }),
            jsx("div", {
              key: "content",
              style: { flex: 1, minWidth: 0 },
              children: [
                jsx("div", { key: "label", style: { fontSize: "14px", marginBottom: "8px" }, children: label }),
                jsx("div", {
                  key: "actions",
                  style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" },
                  children: [
                    jsx("input", {
                      key: "file",
                      type: "file",
                      accept: "image/png,image/jpeg,image/webp,image/gif",
                      disabled: busy !== "",
                      onChange: (event) => {
                        const file = event.currentTarget.files?.[0];
                        if (file !== undefined) void upload(role, file, event.currentTarget);
                      },
                    }),
                    jsx("button", {
                      key: "reset",
                      type: "button",
                      disabled: busy !== "",
                      style: buttonStyle,
                      onClick: () => { void reset(role); },
                      children: "恢复默认",
                    }),
                  ],
                }),
              ],
            }),
          ],
        });
      }

      return jsx("div", {
        style: { padding: "4px 0" },
        children: [
          jsx("div", { key: "title", style: { fontSize: "16px", fontWeight: 600 }, children: "聊天头像" }),
          jsx("div", {
            key: "hint",
            style: { marginTop: "6px", fontSize: "13px", color: "var(--dsw-alias-label-secondary, #666)" },
            children: "从电脑选择图片，支持 PNG、JPG、WebP、GIF，最大 5 MB。",
          }),
          picker("user", "用户头像（消息右侧）"),
          picker("assistant", "AI 头像（消息左侧）"),
          message === "" ? null : jsx("div", {
            key: "message",
            style: { fontSize: "13px", color: "var(--dsw-alias-label-secondary, #666)" },
            children: message,
          }),
        ],
      });
    }
    function apply(ctx) {
      if (document.querySelector(`style[${STYLE_ATTR}]`) === null) {
        const style = document.createElement("style");
        style.setAttribute(STYLE_ATTR, "");
        style.textContent = CSS;
        document.head.appendChild(style);
        console.info("[dsh-chat-avatar] 已注入头像 CSS");
      }

      fetch("/dsh-chat-avatar/config")
        .then((res) => (res.ok ? res.json() : null))
        .then(applyRemoteConfig)
        .catch(() => {});

      const controller = createCardController(
        ctx.settingsScope.bind({ namespace: NAMESPACE }),
        applyRemoteConfig,
      );
      ctx.slots.inject("settings.plugin.item", () =>
        ctx.slots.register(
          {
            name: "settings.plugin.item",
            key: NAMESPACE,
            inject: () => controller.inject(),
          },
          ChatAvatarCard,
        ),
      );
    }

    exports.apply = apply;
    exports.inject = ["slots", "settingsScope"];
    exports.name = "dsh-chat-avatar";
    return module.exports;
  },
});
