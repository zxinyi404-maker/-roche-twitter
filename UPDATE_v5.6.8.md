# Twitter 插件 v5.6.8 更新日志

**发布日期**: 2026-07-31

## 🐛 Bug 修复 + 🌐 翻译功能增强

### 1. 修复关注功能报错

**问题**：
```
Cannot read properties of undefined (reading 'followers')
```

**原因**：
- 用户数据没有 `followers` 和 `following` 字段
- 直接访问导致报错

**修复**：
```javascript
// 确保用户数据有 followers 和 following 字段
if (!twitterData.users[userId].hasOwnProperty('followers')) {
  twitterData.users[userId].followers = 0;
}
if (!twitterData.users[currentUser].hasOwnProperty('following')) {
  twitterData.users[currentUser].following = 0;
}
```

**效果**：
- ✅ 关注功能正常工作
- ✅ 不再报错
- ✅ 自动初始化缺失字段

---

### 2. 翻译功能增强 ⭐ 重要

**用户需求**：
"你把那个显示翻译可以完善一下，可以调用我自己配置的那个 NPC 发帖 API 进行翻译，这样对国外的 char 很友好"

**实现**：
- ✅ 优先使用自定义 NPC 发帖 API 翻译
- ✅ 如果 API 失败，自动切换到 Roche AI
- ✅ 适合国外 Char 的翻译需求

**使用方式**：
1. 在设置中配置 `npcPostApi`
2. 点击"显示翻译"
3. 自动调用你配置的 API 进行翻译

**代码实现**：
```javascript
// 优先使用 NPC 发帖 API（如果已配置）
if (settings.npcPostApi && settings.npcPostApi.trim()) {
  const response = await fetch(settings.npcPostApi, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: `请将以下内容翻译成中文，只返回翻译结果：\n\n${originalText}`
    })
  });
  // 处理响应...
} else {
  // 使用 Roche AI 翻译
  const response = await roche.ai.chat({
    message: `请将以下内容翻译成中文：\n\n${originalText}`,
    stream: false
  });
}
```

**支持的 API 响应格式**：
```json
{
  "content": "翻译结果",
  // 或
  "text": "翻译结果",
  // 或
  "response": "翻译结果"
}
```

---

## 🎯 使用说明

### 配置自定义翻译 API

在设置中配置你的 NPC 发帖 API：
```javascript
settings.npcPostApi = "https://your-api.com/translate"
```

### 使用翻译功能

1. **打开推文详情页**
2. **点击"显示翻译"**
3. **等待翻译结果**
4. **再次点击显示原文**

### 翻译流程

```
用户点击"显示翻译"
    ↓
检查是否配置了自定义 API
    ↓ 是
调用自定义 API
    ↓ 成功？
    ↓ 是 → 显示翻译结果
    ↓ 否 → 切换到 Roche AI
    ↓
调用 Roche AI
    ↓
显示翻译结果
```

---

## 📊 修复效果

### 修复前
| 功能 | 状态 | 问题 |
|------|------|------|
| 关注 | 🔴 报错 | followers undefined |
| 翻译 | 🟡 基础 | 只能用 Roche AI，API 格式错误 |

### 修复后
| 功能 | 状态 | 效果 |
|------|------|------|
| 关注 | 🟢 正常 | 自动初始化字段 |
| 翻译 | 🟢 增强 | 支持自定义 API + Roche AI |

---

## 🌐 翻译功能优势

**对国外 Char 友好**：
- ✅ 可以使用专门的翻译 API
- ✅ 翻译质量更高
- ✅ 支持多种语言
- ✅ 自动降级到 Roche AI

**灵活性**：
- 可以用 DeepL API
- 可以用 Google Translate API
- 可以用自己的翻译服务
- 可以用 OpenAI 进行翻译

---

## 📦 部署信息

**版本号**：v5.6.8  
**类型**：Bug 修复 + 功能增强

**安装链接**：
```
https://raw.githubusercontent.com/zxinyi404-maker/-roche-twitter/main/manifest.json?v=20260801060000
```

**代码变更**：
- `toggleFollow()` - 添加字段检查和初始化
- 翻译功能 - 支持自定义 API + 正确的 Roche AI 调用

---

## 🎉 总结

v5.6.8 修复了关注功能并增强了翻译功能！

**核心改进**：
1. ✅ 关注功能不再报错
2. ✅ 翻译支持自定义 API
3. ✅ 对国外 Char 更友好
4. ✅ 自动降级机制

**用户反馈驱动**：
- "关注功能报错" - 已修复
- "翻译可以调用自定义 API" - 已实现

**现在插件更完善了！** 🎊

---

*发布日期：2026-07-31*  
*开发者：zxinyi404*  
*GitHub：https://github.com/zxinyi404-maker/-roche-twitter*
