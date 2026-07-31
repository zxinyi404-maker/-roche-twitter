# Twitter 插件 v5.6.0 更新日志

**发布日期**: 2026-07-31

## ✨ 新功能：NPC 智能回复系统

### 1. NPC 自动回复用户推文
- ✅ NPC 会智能判断并回复用户的推文
- ✅ 基于兴趣度系统：NPC 对你的兴趣越高，回复概率越大
- ✅ 回复内容符合 NPC 的人设和说话风格
- ✅ 自然、友好、有建设性的互动

### 2. 智能回复机制
**回复触发条件：**
- 只回复真实用户的推文（不回复 NPC 的推文）
- 不回复回复（避免无限循环）
- NPC 对该用户的兴趣度 ≥ 0.4
- 基础回复概率：30%（兴趣度越高，概率越大）

**回复限制：**
- 每个 NPC 每天最多回复 5 次
- 每条推文最多 2 个 NPC 回复
- 定期检查间隔：3 分钟

### 3. 回复通知系统
- ✅ NPC 回复后自动发送系统通知
- ✅ 通知显示 NPC 头像、名字和回复内容
- ✅ 支持"查看"和"忽略"操作
- ✅ 插件内通知列表自动记录

### 4. 设置选项
- ✅ 新增"启用智能回复"开关
- ✅ 可独立控制 NPC 回复功能
- ✅ 实时生效，无需重启插件

## 🔧 技术实现

### 核心配置
```javascript
const NPC_CONFIG = {
  // 智能回复配置
  enableAutoReply: true,        // 启用 NPC 自动回复
  replyProbability: 0.3,        // 基础回复概率（30%）
  maxRepliesPerNPCDaily: 5,     // 每个 NPC 每天最多回复次数
  minInterestForReply: 0.4,     // 回复的最小兴趣度阈值
  replyCheckInterval: 3         // 检查新推文的间隔（分钟）
};
```

### 回复流程

**1. 用户发推文**
```javascript
async function postTweet(roche, content) {
  // ... 创建推文
  
  // 触发 NPC 智能回复（2-5秒延迟，模拟真实）
  setTimeout(() => {
    npcSmartReply(tweet.id, roche);
  }, 2000 + Math.random() * 3000);
}
```

**2. 智能判断是否回复**
```javascript
async function npcSmartReply(tweetId, roche) {
  // 1. 获取对该用户有兴趣的 NPC
  // 2. 检查兴趣度阈值（≥ 0.4）
  // 3. 检查今日回复次数（≤ 5次）
  // 4. 计算回复概率（兴趣度越高概率越大）
  // 5. 随机选择 1-2 个 NPC 回复
}
```

**3. 生成回复内容**
```javascript
async function generateNPCReply(npcId, originalTweet, roche) {
  // 优先使用自定义后端 API
  // 降级使用通用 API 配置
  // 根据 NPC 人设生成符合角色的回复
  // 创建回复推文并发送通知
}
```

**4. 定期检查系统**
```javascript
function startNPCReplySystem(roche) {
  // 每 3 分钟检查一次
  // 获取最近的用户推文
  // 为每条推文尝试触发 NPC 回复
}
```

## 📊 回复概率计算

```javascript
// 兴趣度越高，回复概率越大
const replyChance = NPC_CONFIG.replyProbability * (interest / NPC_CONFIG.minInterestForReply);

// 示例：
// 兴趣度 0.4 → 回复概率 30%
// 兴趣度 0.6 → 回复概率 45%
// 兴趣度 0.8 → 回复概率 60%
// 兴趣度 1.0 → 回复概率 75%
```

## 🎯 使用说明

### 如何启用 NPC 智能回复

1. **打开 Twitter 插件**
2. 进入"设置" → "NPC 系统设置"
3. 确保"启用 NPC 系统"已开启
4. 确保"启用智能回复"已开启

### 如何获得 NPC 回复

1. **提高兴趣度**：
   - 点赞 NPC 的推文 (+0.05)
   - 转发 NPC 的推文 (+0.1)
   - 回复 NPC 的推文 (+0.15)
   - 关注 NPC (+0.3)

2. **发布推文**：
   - 发布一条普通推文
   - 2-5 秒后，对你有兴趣的 NPC 可能会回复

3. **查看回复**：
   - 系统通知会实时弹出
   - 在推文详情页查看所有回复

### NPC 回复规则

- ✅ 只回复真实用户的推文
- ✅ 兴趣度越高，回复越频繁
- ✅ 每个 NPC 每天最多回复 5 次
- ✅ 每条推文最多 2 个 NPC 回复
- ✅ 回复延迟 2-5 秒，模拟真实互动

## 📦 部署信息

**版本号**：v5.6.0

**安装链接**：
```
https://raw.githubusercontent.com/zxinyi404-maker/-roche-twitter/main/manifest.json?v=20260731900000
```

**更新方式**：
1. 完全卸载旧版本
2. 清除浏览器缓存
3. 重新安装新版本

## 🔗 相关链接

- **GitHub**: https://github.com/zxinyi404-maker/-roche-twitter
- **版本**: v5.6.0
- **上一版本**: v5.5.0

## 📝 下一步计划

- ⏳ 可自定义 NPC 发帖频率和内容风格
- ⏳ 支持导入/导出 NPC 人设
- ⏳ NPC 智能推荐系统优化
- ⏳ 支持 NPC 之间的互动对话

## 🎉 总结

v5.6.0 成功实现了 **NPC 智能回复系统**，这是 v4.3.0 下一步计划中最重要的功能！

**核心亮点**：
1. ✅ 智能判断：基于兴趣度和推文内容
2. ✅ 符合人设：回复内容匹配 NPC 性格
3. ✅ 自然互动：延迟触发，避免刷屏
4. ✅ 完整通知：实时推送，可查看详情

**当前状态**：完整可用，NPC 会智能回复你的推文！

---

*发布日期：2026-07-31*
