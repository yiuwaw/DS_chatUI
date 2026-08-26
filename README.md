# DS_chatUI

给 DSH（DeepSeek Harness）Web 对话界面加 QQ/微信式聊天头像：用户消息右侧显示用户头像，AI 消息左侧显示 AI 头像。

## 效果

- 用户消息：气泡右上角显示用户头像
- AI 消息：内容左上角显示 AI 头像
- 窄屏（<640px）自动缩小头像，不挤占正文

## 安装

### 方式一：从 GitHub 安装

```powershell
dsh plugin --profile web add github:yiuwaw/DS_chatUI
```

### 方式二：本地安装

```powershell
git clone https://github.com/yiuwaw/DS_chatUI.git
dsh plugin --profile web add ./DS_chatUI
```

安装后重启 `dsh web` 生效。

## 自定义头像

头像通过 CSS 变量覆盖。在浏览器 DevTools 控制台粘贴，或注入自定义 CSS：

```css
:root {
  --dsh-chat-avatar-user: url("https://你的用户头像地址.png");
  --dsh-chat-avatar-assistant: url("https://你的AI头像地址.png");
  --dsh-chat-avatar-size: 36px;
  --dsh-chat-avatar-radius: 8px;   /* 8px 像微信方角，50% 像 QQ 圆头像 */
}
```

## 卸载

```powershell
dsh plugin --profile web remove dsh-chat-avatar
```

## 原理

- `cordis.patch.yml`：bundle patch，向 web 组合挂载 `dsh-chat-avatar` 行
- `lib/index.js`：Node half，空 seat
- `lib/client.js`：浏览器 half，由 `__ModuleLoader__` 内核物化，`apply()` 注入一个 `<style>` 标签；dispose 时移除

只改浏览器呈现，不会进入模型上下文。

## License

MIT
