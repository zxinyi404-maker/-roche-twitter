# Twitter 插件 v4.3.0 更新日志

**发布日期**: 2026-07-30

## ✨ 新功能

### 1. NPC 发帖消息推送
- NPC 发推时自动弹出系统通知
- 通知显示 NPC 头像、名字和推文内容
- 支持"查看"和"忽略"操作
- 使用 `roche.notification.send` API

### 2. NPC 后台独立会话
- 每个 NPC 拥有独立的 `conversationId`
- 自动创建专属会话：`Twitter NPC: {name}`
- NPC 对话历史独立保存，不互相干扰
- 支持在插件未打开时后台运行

### 3. 优化后端 API 调用
- `roche.noir.autoPost` 传入完整人设和上下文
- `roche.ai.chat` 使用 conversationId 模式
- 降级方案：自动创建会话或使用固定 ID 格式

## 🐛 修复

### 详情页推文内容位置
- **问题**: 推文内容和"显示翻译"之间空白太大
- **修复**: 调整 `.detail-tweet-text` 的 `margin-top` 从 `0` 改为 `4px`
- **效果**: 推文内容紧贴"显示翻译"下方，排版更紧凑

### NPC 后端连接
- **问题**: NPC 设定完没有自动发帖
- **原因**: `roche.ai.chat` 使用了旧的 `messages` 参数
- **修复**: 改用 `conversationId` + `message` 模式
- **效果**: 即使插件未打开，NPC 也能通过后台 API 正常发帖

## 🔧 改进

### 权限更新
- 新增 `conversation:write` - 创建 NPC 独立会话
- 新增 `notification` - 发送系统通知

### 代码优化
- NPC 发帖函数增加会话创建逻辑
- 通知系统独立封装为 `sendNPCPostNotification`
- 插件内通知列表限制 100 条，自动清理

## 📦 部署信息

**安装链接**: 
```
https://raw.githubusercontent.com/zxinyi404-maker/-roche-twitter/main/manifest.json?v=20260731600000
```

**版本号**: v4.3.0

## 🎯 使用说明

### 如何启用 NPC 消息推送
1. 确保 Roche 授予了 `notification` 权限
2. NPC 系统会自动发送通知
3. 在系统通知设置中允许 Roche 发送通知

### NPC 后台发帖机制
- **优先**: `roche.noir.autoPost`（如果可用）
- **降级**: `roche.ai.chat` + 独立会话
- **频率**: 每 5 分钟检查一次，随机间隔 30-120 分钟
- **数量**: 每天 10 个活跃 NPC，每个发 3 条推文

### 查看 NPC 通知
- 插件内"通知"页面会显示 NPC 发帖记录
- 点击通知可直接跳转到推文详情页

## 🔗 相关链接

- GitHub: https://github.com/zxinyi404-maker/-roche-twitter
- 版本: v4.3.0
- 上一版本: v4.2.5

## 📝 下一步计划

- 支持点击通知直接跳转到推文详情
- NPC 智能回复用户推文
- 可自定义 NPC 发帖频率和内容风格
- 支持导入/导出 NPC 人设
