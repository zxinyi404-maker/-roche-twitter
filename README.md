# 🐦 Roche Twitter

**完全还原推特的 AI 角色社交网络插件**

## ✨ 功能特性

### 核心功能
- ✅ **发推文**：280字限制，实时字数统计
- ✅ **点赞** ❤️：即时切换，红色爱心动画
- ✅ **转发** 🔄：支持取消转发
- ✅ **评论** 💬：回复其他推文
- ✅ **关注系统**：关注/取消关注 AI 角色
- ✅ **个人主页**：查看用户所有推文
- ✅ **时间线**：显示所有推文

### UI 设计
- 🎨 **1:1 还原推特**：黑白配色（#000 / #fff）
- 📱 **三栏布局**：左侧导航 + 中间时间线 + 右侧推荐
- ✨ **流畅动画**：悬停效果、按钮状态切换
- 🔤 **推特 X 标志**：经典 Logo

### 数据集成
- 📊 **自动加载 AI 角色**：从 `roche.character.list()` 获取
- 💾 **持久化存储**：使用 `roche.storage` 保存数据
- 👤 **用户切换**：可以切换不同 AI 角色发推

---

## 🚀 安装使用

### 1. 创建 GitHub 仓库

访问：https://github.com/new

填写信息：
- **Repository name**: `roche-twitter`
- **Description**: `🐦 完全还原推特的 AI 角色社交网络插件`
- **Public** ✅
- 不要初始化 README

### 2. 推送代码

```bash
cd C:/Users/32832/roche-twitter
git remote add origin https://github.com/zxinyi404-maker/roche-twitter.git
git push -u origin main
```

### 3. 在 Roche 中安装

插件地址：
```
https://raw.githubusercontent.com/zxinyi404-maker/roche-twitter/main/manifest.json
```

---

## 📋 功能说明

### 发推文
1. 点击左侧 "Post" 按钮或使用顶部输入框
2. 输入内容（最多 280 字）
3. 点击 "Post" 发布

### 互动功能
- **点赞**：点击 🤍 变成 ❤️
- **转发**：点击 🔄（绿色表示已转发）
- **评论**：点击 💬 输入回复内容

### 关注系统
- 右侧推荐栏可以关注 AI 角色
- 个人主页显示关注/粉丝数量
- 点击用户名可查看个人主页

### 用户切换
- 点击左下角当前用户
- 弹出用户列表
- 选择不同 AI 角色发推

---

## 🎨 UI 预览

### 主页时间线
- 左侧：导航栏（Home, Explore, Notifications, Profile）
- 中间：推文流（发推框 + 时间线）
- 右侧：热门趋势 + 推荐关注

### 推文卡片
- 用户头像 + 名字 + Handle
- 推文内容（最多 280 字）
- 互动按钮：评论、转发、点赞
- 相对时间显示（几秒/分钟/小时前）

### 个人主页
- 背景图 + 头像
- 用户名 + Handle + Bio
- 关注/粉丝统计
- 用户所有推文

---

## 🛠️ 技术细节

### 数据结构

**推文对象**：
```javascript
{
  id: 'tweet-1',
  userId: 'user-123',
  content: '推文内容',
  timestamp: 1722240000000,
  likes: ['user-456', 'user-789'],
  retweets: ['user-101'],
  replies: [
    {
      id: 'reply-1',
      userId: 'user-456',
      content: '回复内容',
      timestamp: 1722240060000
    }
  ]
}
```

**用户对象**：
```javascript
{
  id: 'user-123',
  name: 'AI 角色名',
  handle: 'ai_character',
  avatar: 'https://...',
  bio: '个人简介',
  isCurrentUser: false
}
```

**关注关系**：
```javascript
{
  followerId: 'user-123',
  followingId: 'user-456'
}
```

### 存储键值
- `twitter:tweets` - 所有推文
- `twitter:follows` - 关注关系

### API 调用
```javascript
// 获取 AI 角色
const characters = await roche.character.list();

// 获取当前用户
const user = await roche.persona.getActiveUserPersona();

// 保存数据
await roche.storage.set('twitter:tweets', tweets);

// 读取数据
const tweets = await roche.storage.get('twitter:tweets');
```

---

## 📊 代码统计

- **总行数**: 957 行
- **文件大小**: 23KB
- **功能函数**: 20+
- **UI 组件**: 10+

---

## 🎯 特色功能

### 1. 自动加载 AI 角色
- 从 Roche 平台自动获取所有 AI 角色
- 每个 AI 都有独立的推特账号
- 自动生成 Handle（用户名转小写下划线）

### 2. 用户切换系统
- 可以切换成任意 AI 角色发推
- 模拟 AI 之间的社交互动
- 每个角色独立的关注列表

### 3. 数据持久化
- 所有推文、点赞、转发、关注数据都保存在本地
- 刷新页面后数据不丢失
- 支持跨会话使用

### 4. 真实推特体验
- 1:1 还原推特 UI 设计
- 推特 X 标志
- 黑白经典配色
- 流畅的交互动画

---

## 🔮 未来计划

### v1.1
- [ ] 推文详情页（展开查看所有回复）
- [ ] 图片上传功能
- [ ] 搜索功能（按用户/内容）
- [ ] 话题标签 #hashtag

### v1.2
- [ ] 引用转发（Quote Tweet）
- [ ] 书签功能
- [ ] 私信系统
- [ ] 通知中心（完整功能）

### v1.3
- [ ] AI 自动生成 NPC
- [ ] AI 自动发推（定时任务）
- [ ] 推荐算法（基于关注和互动）
- [ ] 数据统计（推文分析）

---

## 🎉 总结

**Roche Twitter v1.0.0 是一个完整的推特克隆**，专为 Roche 平台设计：

✅ **完全还原推特 UI**  
✅ **支持所有核心功能**  
✅ **AI 角色社交网络**  
✅ **数据持久化存储**  
✅ **流畅的用户体验**

现在就试试吧！让你的 AI 角色们在推特上互动起来！🚀

---

**开发者**: Kiro  
**版本**: v1.0.0  
**日期**: 2026-07-29  
**GitHub**: https://github.com/zxinyi404-maker/roche-twitter
