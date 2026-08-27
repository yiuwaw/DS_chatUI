// dsh-chat-avatar browser half：
// - 注入聊天头像 CSS（默认本地 avatars 路由，可用设置覆盖为任意图片 URL）；
// - 在聊天界面右下角提供浮动「头像设置」按钮（不依赖设置页）；
// - 同时尝试注册「设置 → 插件 → 插件配置」卡片。
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

    /** 设置卡片的暂存表单控制器（简化版：两个 URL 字段）。 */
    function createCardController(scope) {
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
      scope.subscribe(() => {
        store.set(read());
      });
      return {
        scope,
        store,
        inject() {
          return {
            hooks: { chatAvatarCard: store },
            async save(userAvatar, assistantAvatar) {
              await scope.set("userAvatar", String(userAvatar ?? "").trim());
              await scope.set("assistantAvatar", String(assistantAvatar ?? "").trim());
              return true;
            },
          };
        },
      };
    }

    /** 「插件配置」里的卡片组件。 */
    function ChatAvatarCard(props) {
      const state = props.useChatAvatarCard((s) => s);
      const [draftUser, setDraftUser] = react.useState(state.userAvatar);
      const [draftAi, setDraftAi] = react.useState(state.assistantAvatar);
      const [saving, setSaving] = react.useState(false);

      react.useEffect(() => {
        setDraftUser(state.userAvatar);
        setDraftAi(state.assistantAvatar);
      }, [state.userAvatar, state.assistantAvatar]);

      if (!state.available) return null;

      const fieldStyle = {
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        margin: "12px 0",
      };
      const labelStyle = { fontSize: "13px", color: "var(--dsw-alias-label-secondary, #666)" };
      const inputStyle = {
        boxSizing: "border-box",
        width: "100%",
        padding: "8px 10px",
        fontSize: "14px",
        lineHeight: "20px",
        color: "var(--dsw-alias-label-primary, #111)",
        background: "var(--dsw-alias-bg-base, #fff)",
        border: "1px solid var(--dsw-alias-border-l1, #ccc)",
        borderRadius: "8px",
        outline: "none",
      };
      const rowStyle = { display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "14px" };
      const buttonStyle = {
        padding: "7px 14px",
        fontSize: "13px",
        borderRadius: "8px",
        border: "1px solid var(--dsw-alias-border-l1, #ccc)",
        background: "transparent",
        color: "var(--dsw-alias-label-primary, #111)",
        cursor: state.writable ? "pointer" : "not-allowed",
        opacity: state.writable ? 1 : 0.5,
      };
      const primaryStyle = {
        ...buttonStyle,
        background: "var(--dsw-alias-button-info-fill, #4d6bfe)",
        border: "1px solid var(--dsw-alias-button-info-fill, #4d6bfe)",
        color: "#fff",
      };

      return jsx("div", {
        style: { padding: "4px 0" },
        children: [
          jsx("div", {
            style: fieldStyle,
            children: [
              jsx("span", { style: labelStyle, children: "用户头像 URL（右侧）" }),
              jsx("input", {
                value: draftUser,
                disabled: !state.writable,
                placeholder: "留空使用本地 avatars/user.* 或默认头像",
                style: inputStyle,
                onInput: (e) => setDraftUser(e.currentTarget.value),
              }),
            ],
          }),
          jsx("div", {
            style: fieldStyle,
            children: [
              jsx("span", { style: labelStyle, children: "AI 头像 URL（左侧）" }),
              jsx("input", {
                value: draftAi,
                disabled: !state.writable,
                placeholder: "留空使用本地 avatars/ai.* 或默认头像",
                style: inputStyle,
                onInput: (e) => setDraftAi(e.currentTarget.value),
              }),
            ],
          }),
          jsx("div", {
            style: rowStyle,
            children: [
              jsx("button", {
                disabled: !state.writable,
                style: buttonStyle,
                onClick: () => {
                  setDraftUser(state.userAvatar);
                  setDraftAi(state.assistantAvatar);
                },
                children: "放弃修改",
              }),
              jsx("button", {
                disabled: !state.writable || saving,
                style: primaryStyle,
                onClick: async () => {
                  setSaving(true);
                  try {
                    await props.save(draftUser, draftAi);
                  } finally {
                    setSaving(false);
                  }
                },
                children: saving ? "保存中…" : "保存",
              }),
            ],
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

      const controller = createCardController(ctx.settingsScope.bind({ namespace: NAMESPACE }));
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