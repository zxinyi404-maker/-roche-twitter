/**
 * Roche Twitter - 完整推特克隆插件
 * 黑白配色，完整功能实现
 */

(function() {
  'use strict';

const PLUGIN_ID = 'roche-twitter';
const STORAGE_KEY = 'twitter_data';

// 初始化数据结构
let twitterData = {
  tweets: [],
  users: {},
  follows: {},
  nextTweetId: 1
};

// 当前登录用户
let currentUser = null;

/**
 * 注册插件到 Roche 系统
 */
if (window.RochePlugin) {
  window.RochePlugin.register({
    id: PLUGIN_ID,
    name: 'Twitter',
    version: '1.0.1',
    apps: [{
      id: 'twitter-home',
      name: 'Twitter',
      icon: '🐦',
      async mount(container, roche) {
        try {
          // 加载数据
          await loadData(roche);

          // 初始化用户
          await initializeUsers(roche);

          // 渲染界面
          renderUI(container, roche);

        } catch (error) {
          console.error('插件初始化失败:', error);
          roche.ui.message('插件加载失败: ' + error.message, 'error');
        }
      },
      async unmount(container) {
        container.replaceChildren();
      }
    }]
  });
}

/**
 * 加载存储的数据
 */
async function loadData(roche) {
  const stored = await roche.storage.get(STORAGE_KEY);
  if (stored) {
    twitterData = JSON.parse(stored);
  }
}

/**
 * 保存数据
 */
async function saveData(roche) {
  await roche.storage.set(STORAGE_KEY, JSON.stringify(twitterData));
}

/**
 * 初始化用户（从 AI 角色列表）
 */
async function initializeUsers(roche) {
  const characters = await roche.character.list();

  // 为每个角色创建用户信息
  for (const char of characters) {
    if (!twitterData.users[char.id]) {
      twitterData.users[char.id] = {
        id: char.id,
        name: char.name,
        username: `@${char.name.toLowerCase().replace(/\s+/g, '_')}`,
        avatar: char.avatar || generateAvatar(char.name),
        bio: char.description || '这个人很神秘，什么都没留下',
        followers: 0,
        following: 0
      };
    }
  }

  // 设置当前用户为第一个角色
  if (characters.length > 0 && !currentUser) {
    currentUser = characters[0].id;

    // 初始化关注关系
    if (!twitterData.follows[currentUser]) {
      twitterData.follows[currentUser] = [];
    }
  }

  await saveData(roche);
}

/**
 * 生成头像占位符
 */
function generateAvatar(name) {
  const colors = ['#1DA1F2', '#14171A', '#657786', '#AAB8C2', '#E1E8ED'];
  const initial = name.charAt(0).toUpperCase();
  const color = colors[name.charCodeAt(0) % colors.length];
  return `data:image/svg+xml,${encodeURIComponent(`
    <svg width="48" height="48" xmlns="http://www.w3.org/2000/svg">
      <circle cx="24" cy="24" r="24" fill="${color}"/>
      <text x="24" y="32" font-size="20" fill="white" text-anchor="middle" font-family="Arial">${initial}</text>
    </svg>
  `)}`;
}

/**
 * 渲染主界面
 */
function renderUI(container, roche) {
  const appDiv = document.createElement('div');
  appDiv.id = 'twitter-app';
  appDiv.innerHTML = `
    <style>
      #twitter-app {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        background: #000;
        color: #fff;
        min-height: 100vh;
        display: flex;
      }

      /* 左侧导航 */
      .twitter-sidebar {
        width: 275px;
        padding: 20px;
        border-right: 1px solid #2f3336;
        position: sticky;
        top: 0;
        height: 100vh;
        overflow-y: auto;
      }

      .twitter-logo {
        font-size: 30px;
        margin-bottom: 20px;
        padding: 10px;
      }

      .nav-item {
        display: flex;
        align-items: center;
        padding: 12px 20px;
        font-size: 20px;
        font-weight: 700;
        border-radius: 30px;
        cursor: pointer;
        transition: background 0.2s;
        margin-bottom: 8px;
      }

      .nav-item:hover {
        background: #16181c;
      }

      .nav-item.active {
        font-weight: 900;
      }

      .nav-icon {
        font-size: 26px;
        margin-right: 20px;
        width: 26px;
        text-align: center;
      }

      .tweet-btn {
        width: 100%;
        background: #1d9bf0;
        color: #fff;
        border: none;
        border-radius: 30px;
        padding: 15px;
        font-size: 17px;
        font-weight: 700;
        cursor: pointer;
        margin-top: 20px;
        transition: background 0.2s;
      }

      .tweet-btn:hover {
        background: #1a8cd8;
      }

      /* 中间时间线 */
      .twitter-main {
        flex: 1;
        max-width: 600px;
        border-right: 1px solid #2f3336;
      }

      .main-header {
        padding: 20px;
        border-bottom: 1px solid #2f3336;
        backdrop-filter: blur(12px);
        background: rgba(0, 0, 0, 0.65);
        position: sticky;
        top: 0;
        z-index: 10;
      }

      .main-header h2 {
        font-size: 20px;
        font-weight: 800;
        margin: 0;
      }

      /* 发推文框 */
      .compose-tweet {
        padding: 20px;
        border-bottom: 1px solid #2f3336;
        display: flex;
        gap: 12px;
      }

      .compose-avatar {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        flex-shrink: 0;
      }

      .compose-form {
        flex: 1;
      }

      .compose-textarea {
        width: 100%;
        background: transparent;
        border: none;
        color: #fff;
        font-size: 20px;
        resize: none;
        outline: none;
        min-height: 100px;
        font-family: inherit;
      }

      .compose-textarea::placeholder {
        color: #71767b;
      }

      .compose-actions {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid #2f3336;
      }

      .char-count {
        color: #71767b;
        font-size: 14px;
      }

      .compose-btn {
        background: #1d9bf0;
        color: #fff;
        border: none;
        border-radius: 20px;
        padding: 8px 16px;
        font-weight: 700;
        cursor: pointer;
        transition: background 0.2s;
      }

      .compose-btn:hover:not(:disabled) {
        background: #1a8cd8;
      }

      .compose-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      /* 推文列表 */
      .tweets-list {
        overflow-y: auto;
      }

      .tweet-item {
        padding: 16px 20px;
        border-bottom: 1px solid #2f3336;
        transition: background 0.2s;
        cursor: pointer;
      }

      .tweet-item:hover {
        background: rgba(255, 255, 255, 0.03);
      }

      .tweet-header {
        display: flex;
        gap: 12px;
      }

      .tweet-avatar {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        flex-shrink: 0;
      }

      .tweet-content {
        flex: 1;
        min-width: 0;
      }

      .tweet-author {
        display: flex;
        align-items: center;
        gap: 4px;
        margin-bottom: 4px;
      }

      .tweet-author-name {
        font-weight: 700;
        color: #fff;
      }

      .tweet-author-name:hover {
        text-decoration: underline;
      }

      .tweet-author-username {
        color: #71767b;
      }

      .tweet-time {
        color: #71767b;
      }

      .tweet-text {
        font-size: 15px;
        line-height: 20px;
        margin: 4px 0 12px 0;
        white-space: pre-wrap;
        word-wrap: break-word;
      }

      .tweet-actions {
        display: flex;
        justify-content: space-between;
        max-width: 425px;
        margin-top: 12px;
      }

      .tweet-action {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #71767b;
        font-size: 13px;
        cursor: pointer;
        padding: 8px;
        border-radius: 20px;
        transition: all 0.2s;
      }

      .tweet-action:hover {
        background: rgba(29, 155, 240, 0.1);
        color: #1d9bf0;
      }

      .tweet-action.liked {
        color: #f91880;
      }

      .tweet-action.liked:hover {
        background: rgba(249, 24, 128, 0.1);
      }

      .tweet-action.retweeted {
        color: #00ba7c;
      }

      .tweet-action.retweeted:hover {
        background: rgba(0, 186, 124, 0.1);
      }

      /* 右侧推荐 */
      .twitter-widgets {
        width: 350px;
        padding: 20px;
      }

      .widget-card {
        background: #16181c;
        border-radius: 16px;
        overflow: hidden;
        margin-bottom: 20px;
      }

      .widget-header {
        padding: 12px 16px;
        font-size: 20px;
        font-weight: 800;
      }

      .user-recommendation {
        padding: 12px 16px;
        display: flex;
        align-items: center;
        gap: 12px;
        transition: background 0.2s;
      }

      .user-recommendation:hover {
        background: rgba(255, 255, 255, 0.03);
      }

      .rec-avatar {
        width: 48px;
        height: 48px;
        border-radius: 50%;
      }

      .rec-info {
        flex: 1;
        min-width: 0;
      }

      .rec-name {
        font-weight: 700;
        color: #fff;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .rec-username {
        color: #71767b;
        font-size: 14px;
      }

      .follow-btn {
        background: #fff;
        color: #0f1419;
        border: none;
        border-radius: 20px;
        padding: 6px 16px;
        font-weight: 700;
        font-size: 14px;
        cursor: pointer;
        transition: background 0.2s;
      }

      .follow-btn:hover {
        background: #d7dbdc;
      }

      .follow-btn.following {
        background: transparent;
        color: #fff;
        border: 1px solid #536471;
      }

      .follow-btn.following:hover {
        background: rgba(244, 33, 46, 0.1);
        border-color: rgba(244, 33, 46, 0.4);
        color: #f4212e;
      }

      .empty-state {
        padding: 60px 20px;
        text-align: center;
        color: #71767b;
      }

      .empty-state-icon {
        font-size: 48px;
        margin-bottom: 20px;
      }

      /* 用户切换器 */
      .user-switcher {
        margin-top: auto;
        padding: 12px;
        border-radius: 30px;
        cursor: pointer;
        transition: background 0.2s;
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .user-switcher:hover {
        background: #16181c;
      }

      .user-switcher-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
      }

      .user-switcher-info {
        flex: 1;
      }

      .user-switcher-name {
        font-weight: 700;
        font-size: 15px;
      }

      .user-switcher-username {
        color: #71767b;
        font-size: 14px;
      }
    </style>

    <div class="twitter-sidebar">
      <div class="twitter-logo">𝕏</div>
      <nav>
        <div class="nav-item active" data-nav="home">
          <span class="nav-icon">🏠</span>
          <span>主页</span>
        </div>
        <div class="nav-item" data-nav="explore">
          <span class="nav-icon">🔍</span>
          <span>探索</span>
        </div>
        <div class="nav-item" data-nav="notifications">
          <span class="nav-icon">🔔</span>
          <span>通知</span>
        </div>
        <div class="nav-item" data-nav="messages">
          <span class="nav-icon">✉️</span>
          <span>私信</span>
        </div>
        <div class="nav-item" data-nav="profile">
          <span class="nav-icon">👤</span>
          <span>个人资料</span>
        </div>
      </nav>
      <button class="tweet-btn" id="compose-btn">发推文</button>
      <div class="user-switcher" id="user-switcher">
        <img class="user-switcher-avatar" id="current-user-avatar" src="" alt="">
        <div class="user-switcher-info">
          <div class="user-switcher-name" id="current-user-name"></div>
          <div class="user-switcher-username" id="current-user-username"></div>
        </div>
      </div>
    </div>

    <div class="twitter-main">
      <div class="main-header">
        <h2>主页</h2>
      </div>

      <div class="compose-tweet">
        <img class="compose-avatar" id="compose-avatar" src="" alt="">
        <div class="compose-form">
          <textarea
            class="compose-textarea"
            id="tweet-textarea"
            placeholder="有什么新鲜事？"
            maxlength="280"
          ></textarea>
          <div class="compose-actions">
            <span class="char-count" id="char-count">0 / 280</span>
            <button class="compose-btn" id="post-tweet-btn" disabled>发推文</button>
          </div>
        </div>
      </div>

      <div class="tweets-list" id="tweets-list">
        <div class="empty-state">
          <div class="empty-state-icon">🐦</div>
          <div>还没有推文</div>
          <div style="margin-top: 8px; font-size: 14px;">发布你的第一条推文吧！</div>
        </div>
      </div>
    </div>

    <div class="twitter-widgets">
      <div class="widget-card">
        <div class="widget-header">推荐关注</div>
        <div id="recommendations-list"></div>
      </div>
    </div>
  `;

  container.replaceChildren();
  container.appendChild(appDiv);

  // 绑定事件
  bindEvents(roche);

  // 更新当前用户显示
  updateCurrentUserDisplay();

  // 渲染推文列表
  renderTweets(roche);

  // 渲染推荐用户
  renderRecommendations(roche);
}

/**
 * 绑定事件处理
 */
function bindEvents(roche) {
  // 发推文按钮
  const textarea = document.getElementById('tweet-textarea');
  const postBtn = document.getElementById('post-tweet-btn');
  const charCount = document.getElementById('char-count');

  textarea.addEventListener('input', () => {
    const length = textarea.value.length;
    charCount.textContent = `${length} / 280`;
    postBtn.disabled = length === 0;
  });

  postBtn.addEventListener('click', () => postTweet(roche));

  // 用户切换
  document.getElementById('user-switcher').addEventListener('click', () => showUserSwitcher(roche));
}

/**
 * 更新当前用户显示
 */
function updateCurrentUserDisplay() {
  const user = twitterData.users[currentUser];
  if (user) {
    document.getElementById('current-user-avatar').src = user.avatar;
    document.getElementById('current-user-name').textContent = user.name;
    document.getElementById('current-user-username').textContent = user.username;
    document.getElementById('compose-avatar').src = user.avatar;
  }
}

/**
 * 发布推文
 */
async function postTweet(roche) {
  const textarea = document.getElementById('tweet-textarea');
  const content = textarea.value.trim();

  if (!content) return;

  const tweet = {
    id: twitterData.nextTweetId++,
    userId: currentUser,
    content: content,
    timestamp: Date.now(),
    likes: [],
    retweets: [],
    replies: []
  };

  twitterData.tweets.unshift(tweet);
  await saveData(roche);

  textarea.value = '';
  document.getElementById('char-count').textContent = '0 / 280';
  document.getElementById('post-tweet-btn').disabled = true;

  renderTweets(roche);

  roche.ui.message('推文已发布！', 'success');
}

/**
 * 渲染推文列表
 */
function renderTweets(roche) {
  const listEl = document.getElementById('tweets-list');

  if (twitterData.tweets.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🐦</div>
        <div>还没有推文</div>
        <div style="margin-top: 8px; font-size: 14px;">发布你的第一条推文吧！</div>
      </div>
    `;
    return;
  }

  listEl.innerHTML = twitterData.tweets.map(tweet => {
    const user = twitterData.users[tweet.userId];
    const isLiked = tweet.likes.includes(currentUser);
    const isRetweeted = tweet.retweets.includes(currentUser);
    const timeAgo = getTimeAgo(tweet.timestamp);

    return `
      <div class="tweet-item" data-tweet-id="${tweet.id}">
        <div class="tweet-header">
          <img class="tweet-avatar" src="${user.avatar}" alt="">
          <div class="tweet-content">
            <div class="tweet-author">
              <span class="tweet-author-name">${user.name}</span>
              <span class="tweet-author-username">${user.username}</span>
              <span class="tweet-time">· ${timeAgo}</span>
            </div>
            <div class="tweet-text">${escapeHtml(tweet.content)}</div>
            <div class="tweet-actions">
              <div class="tweet-action" data-action="reply">
                <span>💬</span>
                <span>${tweet.replies.length || ''}</span>
              </div>
              <div class="tweet-action ${isRetweeted ? 'retweeted' : ''}" data-action="retweet">
                <span>🔁</span>
                <span>${tweet.retweets.length || ''}</span>
              </div>
              <div class="tweet-action ${isLiked ? 'liked' : ''}" data-action="like">
                <span>${isLiked ? '❤️' : '🤍'}</span>
                <span>${tweet.likes.length || ''}</span>
              </div>
              <div class="tweet-action" data-action="share">
                <span>📤</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // 绑定推文操作事件
  listEl.querySelectorAll('.tweet-action').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = el.dataset.action;
      const tweetId = parseInt(el.closest('.tweet-item').dataset.tweetId);
      handleTweetAction(action, tweetId, roche);
    });
  });
}

/**
 * 处理推文操作
 */
async function handleTweetAction(action, tweetId, roche) {
  const tweet = twitterData.tweets.find(t => t.id === tweetId);
  if (!tweet) return;

  switch (action) {
    case 'like':
      const likeIndex = tweet.likes.indexOf(currentUser);
      if (likeIndex > -1) {
        tweet.likes.splice(likeIndex, 1);
      } else {
        tweet.likes.push(currentUser);
      }
      break;

    case 'retweet':
      const retweetIndex = tweet.retweets.indexOf(currentUser);
      if (retweetIndex > -1) {
        tweet.retweets.splice(retweetIndex, 1);
      } else {
        tweet.retweets.push(currentUser);
      }
      break;

    case 'reply':
      roche.ui.message('回复功能开发中...', 'info');
      return;

    case 'share':
      roche.ui.message('分享功能开发中...', 'info');
      return;
  }

  await saveData(roche);
  renderTweets(roche);
}

/**
 * 渲染推荐用户
 */
function renderRecommendations(roche) {
  const listEl = document.getElementById('recommendations-list');
  const userFollows = twitterData.follows[currentUser] || [];

  // 获取未关注的用户
  const recommendations = Object.values(twitterData.users)
    .filter(u => u.id !== currentUser && !userFollows.includes(u.id))
    .slice(0, 5);

  if (recommendations.length === 0) {
    listEl.innerHTML = '<div style="padding: 20px; text-align: center; color: #71767b;">没有更多推荐</div>';
    return;
  }

  listEl.innerHTML = recommendations.map(user => {
    const isFollowing = userFollows.includes(user.id);
    return `
      <div class="user-recommendation">
        <img class="rec-avatar" src="${user.avatar}" alt="">
        <div class="rec-info">
          <div class="rec-name">${user.name}</div>
          <div class="rec-username">${user.username}</div>
        </div>
        <button
          class="follow-btn ${isFollowing ? 'following' : ''}"
          data-user-id="${user.id}"
        >
          ${isFollowing ? '正在关注' : '关注'}
        </button>
      </div>
    `;
  }).join('');

  // 绑定关注按钮
  listEl.querySelectorAll('.follow-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const userId = btn.dataset.userId;
      await toggleFollow(userId, roche);
      renderRecommendations(roche);
      updateStats();
    });
  });
}

/**
 * 切换关注状态
 */
async function toggleFollow(userId, roche) {
  if (!twitterData.follows[currentUser]) {
    twitterData.follows[currentUser] = [];
  }

  const follows = twitterData.follows[currentUser];
  const index = follows.indexOf(userId);

  if (index > -1) {
    follows.splice(index, 1);
    twitterData.users[userId].followers--;
    twitterData.users[currentUser].following--;
  } else {
    follows.push(userId);
    twitterData.users[userId].followers++;
    twitterData.users[currentUser].following++;
  }

  await saveData(roche);
}

/**
 * 更新统计数据
 */
function updateStats() {
  // 这里可以添加统计显示逻辑
}

/**
 * 显示用户切换器
 */
async function showUserSwitcher(roche) {
  const users = Object.values(twitterData.users);
  const options = users.map(u => ({
    label: `${u.name} (${u.username})`,
    value: u.id
  }));

  // 使用简单的选择对话框
  const selected = await showSelectDialog('切换用户', options);
  if (selected && selected !== currentUser) {
    currentUser = selected;
    updateCurrentUserDisplay();
    renderTweets(roche);
    renderRecommendations(roche);
  }
}

/**
 * 简单的选择对话框
 */
function showSelectDialog(title, options) {
  return new Promise((resolve) => {
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
      background: #16181c;
      border-radius: 16px;
      padding: 20px;
      max-width: 400px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
    `;

    content.innerHTML = `
      <h3 style="margin: 0 0 20px 0; font-size: 20px;">${title}</h3>
      ${options.map(opt => `
        <div style="padding: 12px; cursor: pointer; border-radius: 8px; transition: background 0.2s;"
             onmouseover="this.style.background='rgba(255,255,255,0.1)'"
             onmouseout="this.style.background='transparent'"
             data-value="${opt.value}">
          ${opt.label}
        </div>
      `).join('')}
      <button style="margin-top: 20px; width: 100%; padding: 12px; background: #536471; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-weight: 700;"
              id="cancel-btn">取消</button>
    `;

    dialog.appendChild(content);
    document.body.appendChild(dialog);

    content.querySelectorAll('[data-value]').forEach(el => {
      el.addEventListener('click', () => {
        const value = el.dataset.value;
        document.body.removeChild(dialog);
        resolve(value);
      });
    });

    document.getElementById('cancel-btn').addEventListener('click', () => {
      document.body.removeChild(dialog);
      resolve(null);
    });
  });
}

/**
 * 获取相对时间
 */
function getTimeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return `${seconds}秒前`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟前`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}小时前`;
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)}天前`;

  return new Date(timestamp).toLocaleDateString('zh-CN');
}

/**
 * HTML 转义
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

})(); // 立即执行函数结束
