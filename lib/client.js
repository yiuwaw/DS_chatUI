// dsh-chat-avatar browser half：注入聊天头像 CSS。
// 约定：Node half 是空 seat；本文件由 __ModuleLoader__ 内核按需物化，
// apply() 挂一个 <style> 标签，返回 dispose 时移除。
window.__ModuleLoader__.load({
  id: "dsh-chat-avatar",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    const STYLE_ATTR = "data-dsh-chat-avatar";

    // 用户头像：浅灰底 + 人形剪影（可被 CSS 变量覆盖）
    const USER_AVATAR_SVG =
      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'>" +
      "<rect width='40' height='40' rx='8' fill='#e8ecf3'/>" +
      "<circle cx='20' cy='15' r='6' fill='#8b93a7'/>" +
      "<path d='M7 35c2.6-7.2 7-10.8 13-10.8s10.4 3.6 13 10.8Z' fill='#8b93a7'/>" +
      "</svg>";

    // AI 头像：DeepSeek 风格渐变 + "AI" 字样（可被 CSS 变量覆盖）
    const AI_AVATAR_SVG =
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
  --dsh-chat-avatar-user: url("data:image/svg+xml,${encodeURIComponent(USER_AVATAR_SVG)}");
  --dsh-chat-avatar-assistant: url("data:image/svg+xml,${encodeURIComponent(AI_AVATAR_SVG)}");
  --dsh-chat-avatar-size: 36px;
  --dsh-chat-avatar-radius: 8px;
}

/* 用户消息：头像在气泡右上角（像微信/QQ 的右侧头像） */
[data-chat-flow-kind="user"] > div {
  position: relative;
  padding-right: calc(var(--dsh-chat-avatar-size) + 12px);
  min-height: var(--dsh-chat-avatar-size);
}
[data-chat-flow-kind="user"] > div::after {
  content: "";
  position: absolute;
  right: 0;
  top: 0;
  width: var(--dsh-chat-avatar-size);
  height: var(--dsh-chat-avatar-size);
  border-radius: var(--dsh-chat-avatar-radius);
  background: var(--dsh-chat-avatar-user);
  background-size: cover;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18);
}

/* AI 消息：头像在内容左上角（像微信/QQ 的左侧头像） */
[data-chat-flow-kind="assistant-step"] > div {
  position: relative;
  padding-left: calc(var(--dsh-chat-avatar-size) + 12px);
  min-height: var(--dsh-chat-avatar-size);
}
[data-chat-flow-kind="assistant-step"] > div::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0;
  width: var(--dsh-chat-avatar-size);
  height: var(--dsh-chat-avatar-size);
  border-radius: var(--dsh-chat-avatar-radius);
  background: var(--dsh-chat-avatar-assistant);
  background-size: cover;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18);
}

/* 移动端/窄屏下头像略小，别挤占正文 */
@media (max-width: 640px) {
  :root {
    --dsh-chat-avatar-size: 30px;
  }
}
`;

    function apply(ctx = {}) {
      if (document.querySelector(`style[${STYLE_ATTR}]`) !== null) {
        console.warn("[dsh-chat-avatar] 已挂载，跳过重复注入");
        return () => {};
      }
      const style = document.createElement("style");
      style.setAttribute(STYLE_ATTR, "");
      style.textContent = CSS;
      document.head.appendChild(style);
      return () => {
        style.remove();
      };
    }

    exports.apply = apply;
    exports.name = "dsh-chat-avatar";
    return module.exports;
  },
});
