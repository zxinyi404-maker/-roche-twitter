# Roche Twitter v2.6.0 更新说明

## 🎉 重大更新：AI 聊天功能完整实现

### 新增功能

#### 1. 真正的 AI 对话系统
- ✅ 点击新建私信对话框中的 Char，直接进入聊天界面
- ✅ 使用 Roche AI API (`roche.ai.chat`) 实现真实对话
- ✅ 从 Roche 记忆系统加载完整聊天历史
- ✅ 自动保存每次对话到长期记忆

#### 2. 完整的聊天体验
- ✅ 实时消息发送和接收
- ✅ 优雅的消息气泡展示（蓝色=自己，灰色=AI）
- ✅ 输入框自动启用/禁用发送按钮
- ✅ 支持回车键快速发送
- ✅ 自动滚动到最新消息
- ✅ 空状态友好提示

#### 3. 记忆集成
- ✅ 每条对话自动保存到 Roche 记忆宫殿
- ✅ 可设置是否启用记忆功能（设置页）
- ✅ 记忆摘要显示在对话列表

### 核心技术实现

**新增函数：**
1. `openChatWithConv(convId, roche)` - 打开聊天界面
2. `sendMessageToConv(roche, content)` - 发送消息到 AI

**使用的 Roche API：**
- `roche.conversation.list()` - 获取对话列表
- `roche.memory.getLongTerm()` - 加载聊天历史
- `roche.ai.chat()` - 发送消息到 AI
- `roche.memory.saveLongTerm()` - 保存对话记忆

### 使用指南

1. 点击私信页右下角的蓝色圆形按钮
2. 选择一个 Char（AI 角色）
3. 输入消息并发送
4. AI 会根据其人设和记忆回复你
5. 所有对话自动保存到记忆系统

### 安装/更新

```
https://raw.githubusercontent.com/zxinyi404-maker/-roche-twitter/main/manifest.json?v=20260730120000
```

**注意：** 需要先卸载旧版本，清除缓存后重新安装

### 权限说明

本版本需要以下权限：
- `conversation:read` - 读取对话列表
- `memory:read/write` - 读写记忆系统
- `ai:chat` - 调用 AI 聊天
- `persona:read/write` - 账号切换
- `storage` - 数据持久化
- `ui` - 界面操作

### 下一步计划

- [ ] 私信列表显示真实对话
- [ ] 图片上传功能
- [ ] 话题标签 #hashtag
- [ ] @提及功能
- [ ] 推文编辑/删除

---

**版本：** v2.6.0  
**发布日期：** 2026-07-30  
**作者：** zxinyi404
