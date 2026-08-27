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

### 方式一：在设置界面里改（推荐）

重启后打开 DSH Web 的 **设置 → 插件 → 插件配置**，找到 **dsh-chat-avatar** 卡片：

- **用户头像 URL（右侧）**：填你的头像图片地址
- **AI 头像 URL（左侧）**：填 AI 头像图片地址

保存后立即生效，无需重启。

### 方式二：本地图片文件

把图片命名为 `user.*` 和 `ai.*`（支持 png / jpg / webp / gif / svg），放进插件目录的 `avatars/` 文件夹：

```
<DSH_HOME>/plugins/DS_chatUI/avatars/user.png
<DSH_HOME>/plugins/DS_chatUI/avatars/ai.png
```

设置界面里留空时，优先使用本地图片；本地也没有时回退到内置默认头像。

### 方式三：CSS 变量覆盖（高级）

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
- `lib/index.js`：Node half，注册 settings namespace（`dsh-chat-avatar`）、提供本地头像静态服务与配置端点
- `lib/client.js`：浏览器 half，注入头像 CSS、拉取配置覆盖 CSS 变量，并在「插件配置」里注册设置卡片

只改浏览器呈现，不会进入模型上下文。

## License

MIT
