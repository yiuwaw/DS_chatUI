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

### 方式一：从电脑选择图片（推荐）

重启后打开 DSH Web 的 **设置 → 插件 → 插件配置**，找到 **dsh-chat-avatar** 卡片：

- 在“用户头像”或“AI 头像”中点击文件选择框
- 从电脑选择 PNG / JPG / WebP / GIF 图片（最大 5 MB）
- 选择后自动上传并立即生效，无需刷新或重启
- 点击“恢复默认”可删除上传的图片并恢复插件内置头像

上传的图片保存在当前 DSH 设置文件旁的 `dsh-chat-avatar/` 目录中，更新插件不会删除；文件名为 `user.custom.*` 或 `ai.custom.*`。

### 方式二：本地图片文件

把图片命名为 `user.*` 和 `ai.*`（支持 png / jpg / webp / gif / svg），放进插件目录的 `avatars/` 文件夹：

```
<DSH_HOME>/plugins/DS_chatUI/avatars/user.png
<DSH_HOME>/plugins/DS_chatUI/avatars/ai.png
```

没有上传图片时，优先使用手动放置的本地图片；本地也没有时回退到内置默认头像。

### 方式三：CSS 变量覆盖（高级兼容方式）

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

## 更新

GitHub 安装不会自动拉取新提交。更新后请重启 `dsh web`：

```powershell
dsh plugin --profile web update dsh-chat-avatar
```

## 原理

- `cordis.patch.yml`：bundle patch，向 web 组合挂载 `dsh-chat-avatar` 行
- `lib/index.js`：Node half，注册 settings namespace、提供头像静态服务和图片上传端点
- `lib/client.js`：浏览器 half，注入头像 CSS，并在「插件配置」里注册电脑图片选择卡片

只改浏览器呈现，不会进入模型上下文。

## License

MIT
