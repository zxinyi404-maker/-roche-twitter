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
  window.RochePlugin.register({
    id: PLUGIN_ID,
    name: 'Twitter',
    version: '1.0.7',
    apps: [{
      id: 'twitter-home',
      name: 'Twitter',
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
 * 渲染主界面 - 移动端布局
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
        position: relative;
        max-width: 768px;
        margin: 0 auto;
      }

      /* 顶部导航栏 */
      .mobile-top-bar {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: 60px;
        background: #000;
        border-bottom: 1px solid #2f3336;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 16px;
        z-index: 100;
        max-width: 768px;
        margin: 0 auto;
      }

      .top-bar-avatar {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        cursor: pointer;
        transition: opacity 0.2s;
      }

      .top-bar-avatar:active {
        opacity: 0.7;
      }

      .top-bar-title {
        font-size: 19px;
        font-weight: 700;
        letter-spacing: -0.5px;
      }

      .top-bar-settings {
        font-size: 22px;
        cursor: pointer;
        padding: 8px;
        transition: opacity 0.2s;
      }

      .top-bar-settings:active {
        opacity: 0.7;
      }

      /* 主内容区 */
      .mobile-main {
        padding-top: 60px;
        padding-bottom: 60px;
        min-height: 100vh;
      }

      /* 推文列表 */
      .tweets-list {
        width: 100%;
      }

      .tweet-item {
        padding: 12px 16px;
        border-bottom: 1px solid #2f3336;
        transition: background 0.2s;
        cursor: pointer;
      }

      .tweet-item:active {
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
        margin-bottom: 2px;
      }

      .tweet-author-name {
        font-weight: 700;
        font-size: 15px;
        color: #fff;
      }

      .tweet-author-username {
        color: #71767b;
        font-size: 15px;
      }

      .tweet-time {
        color: #71767b;
        font-size: 15px;
      }

      .tweet-text {
        font-size: 15px;
        line-height: 20px;
        margin: 4px 0 12px 0;
        white-space: pre-wrap;
        word-wrap: break-word;
        color: #fff;
      }

      .tweet-actions {
        display: flex;
        justify-content: space-around;
        margin-top: 8px;
        padding-top: 4px;
      }

      .tweet-action {
        display: flex;
        align-items: center;
        gap: 4px;
        color: #71767b;
        font-size: 13px;
        cursor: pointer;
        padding: 8px 12px;
        border-radius: 20px;
        transition: all 0.2s;
      }

      .tweet-action:active {
        background: rgba(29, 155, 240, 0.1);
      }

      .tweet-action.liked {
        color: #f91880;
      }

      .tweet-action.liked:active {
        background: rgba(249, 24, 128, 0.1);
      }

      .tweet-action.retweeted {
        color: #00ba7c;
      }

      .tweet-action.retweeted:active {
        background: rgba(0, 186, 124, 0.1);
      }

      .tweet-action span:first-child {
        font-size: 18px;
      }

      /* 底部导航栏 */
      .mobile-bottom-nav {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        height: 60px;
        background: #000;
        border-top: 1px solid #2f3336;
        display: flex;
        align-items: center;
        justify-content: space-around;
        z-index: 100;
        max-width: 768px;
        margin: 0 auto;
      }

      .bottom-nav-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        flex: 1;
        height: 100%;
        color: #71767b;
        cursor: pointer;
        transition: all 0.2s;
        font-size: 26px;
      }

      .bottom-nav-item.active {
        color: #fff;
      }

      .bottom-nav-item:active {
        background: rgba(255, 255, 255, 0.05);
      }

      /* 悬浮发推按钮 */
      .floating-compose-btn {
        position: fixed;
        bottom: 80px;
        right: 20px;
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: #1d9bf0;
        color: #fff;
        border: none;
        font-size: 24px;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(29, 155, 240, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
        z-index: 99;
      }

      .floating-compose-btn:active {
        transform: scale(0.95);
        background: #1a8cd8;
      }

      @media (min-width: 768px) {
        .floating-compose-btn {
          right: calc(50% - 384px + 20px);
        }
      }

      /* 空状态 */
      .empty-state {
        padding: 60px 20px;
        text-align: center;
        color: #71767b;
      }

      .empty-state-icon {
        font-size: 48px;
        margin-bottom: 20px;
      }

      /* 发推文弹窗 */
      .compose-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        z-index: 200;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding: 20px;
        overflow-y: auto;
      }

      .compose-modal-content {
        background: #000;
        border-radius: 16px;
        width: 100%;
        max-width: 600px;
        margin-top: 40px;
        border: 1px solid #2f3336;
      }

      .compose-modal-header {
        display: flex;
        align-items: center;
        padding: 12px 16px;
        border-bottom: 1px solid #2f3336;
      }

      .compose-modal-close {
        font-size: 24px;
        cursor: pointer;
        padding: 8px;
        color: #fff;
      }

      .compose-modal-title {
        flex: 1;
        text-align: center;
        font-weight: 700;
        margin-right: 40px;
      }

      .compose-modal-body {
        padding: 16px;
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
        font-size: 18px;
        resize: none;
        outline: none;
        min-height: 120px;
        font-family: inherit;
      }

      .compose-textarea::placeholder {
        color: #71767b;
      }

      .compose-modal-footer {
        padding: 12px 16px;
        border-top: 1px solid #2f3336;
        display: flex;
        justify-content: space-between;
        align-items: center;
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
        padding: 8px 20px;
        font-weight: 700;
        font-size: 15px;
        cursor: pointer;
        transition: background 0.2s;
      }

      .compose-btn:active:not(:disabled) {
        background: #1a8cd8;
      }

      .compose-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      /* 响应式 */
      @media (max-width: 768px) {
        #twitter-app {
          max-width: 100%;
        }

        .mobile-top-bar,
        .mobile-bottom-nav {
          max-width: 100%;
        }
      }

      @media (max-width: 320px) {
        .tweet-action span:last-child {
          display: none;
        }
      }
    </style>

    <!-- 顶部导航栏 -->
    <div class="mobile-top-bar">
      <img class="top-bar-avatar" id="top-bar-avatar" src="" alt="" title="切换账号">
      <div class="top-bar-title">𝕏</div>
      <div class="top-bar-settings" title="设置">⚙️</div>
    </div>

    <!-- 主内容区 -->
    <div class="mobile-main">
      <div class="tweets-list" id="tweets-list">
        <div class="empty-state">
          <div class="empty-state-icon">🐦</div>
          <div>还没有推文</div>
          <div style="margin-top: 8px; font-size: 14px;">发布你的第一条推文吧！</div>
        </div>
      </div>
    </div>

    <!-- 底部导航栏 -->
    <div class="mobile-bottom-nav">
      <div class="bottom-nav-item active" data-nav="home" title="主页">🏠</div>
      <div class="bottom-nav-item" data-nav="search" title="搜索">🔍</div>
      <div class="bottom-nav-item" data-nav="notifications" title="通知">🔔</div>
      <div class="bottom-nav-item" data-nav="messages" title="私信">✉️</div>
      <div class="bottom-nav-item" data-nav="profile" title="个人资料">👤</div>
    </div>

    <!-- 悬浮发推按钮 -->
    <button class="floating-compose-btn" id="floating-compose-btn" title="发推文">✏️</button>
  `;

  container.replaceChildren();
  container.appendChild(appDiv);

  // 绑定事件
  bindEvents(roche);

  // 更新当前用户显示
  updateCurrentUserDisplay();

  // 渲染推文列表
  renderTweets(roche);
}

/**
 * 绑定事件处理 - 移动端
 */
function bindEvents(roche) {
  // 悬浮发推按钮
  document.getElementById('floating-compose-btn').addEventListener('click', () => {
    showComposeModal(roche);
  });

  // 顶部头像点击 - 切换用户
  document.getElementById('top-bar-avatar').addEventListener('click', () => {
    showUserSwitcher(roche);
  });

  // 底部导航切换
  document.querySelectorAll('.bottom-nav-item').forEach(item => {
    item.addEventListener('click', () => {
      // 移除所有 active 状态
      document.querySelectorAll('.bottom-nav-item').forEach(i => i.classList.remove('active'));
      // 添加当前 active 状态
      item.classList.add('active');

      const nav = item.dataset.nav;
      if (nav !== 'home') {
        roche.ui.message(`${item.title}功能开发中...`, 'info');
      }
    });
  });
}

/**
 * 更新当前用户显示
 */
function updateCurrentUserDisplay() {
  const user = twitterData.users[currentUser];
  if (user) {
    document.getElementById('top-bar-avatar').src = user.avatar;
  }
}

/**
 * 显示发推文弹窗
 */
function showComposeModal(roche) {
  const user = twitterData.users[currentUser];
  if (!user) return;

  const modal = document.createElement('div');
  modal.className = 'compose-modal';
  modal.innerHTML = `
    <div class="compose-modal-content">
      <div class="compose-modal-header">
        <div class="compose-modal-close" id="close-modal">✕</div>
        <div class="compose-modal-title">发推文</div>
      </div>
      <div class="compose-modal-body">
        <img class="compose-avatar" src="${user.avatar}" alt="">
        <div class="compose-form">
          <textarea
            class="compose-textarea"
            id="modal-tweet-textarea"
            placeholder="有什么新鲜事？"
            maxlength="280"
            autofocus
          ></textarea>
        </div>
      </div>
      <div class="compose-modal-footer">
        <span class="char-count" id="modal-char-count">0 / 280</span>
        <button class="compose-btn" id="modal-post-btn" disabled>发推文</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // 绑定事件
  const textarea = document.getElementById('modal-tweet-textarea');
  const postBtn = document.getElementById('modal-post-btn');
  const charCount = document.getElementById('modal-char-count');

  textarea.addEventListener('input', () => {
    const length = textarea.value.length;
    charCount.textContent = `${length} / 280`;
    postBtn.disabled = length === 0;
  });

  postBtn.addEventListener('click', async () => {
    await postTweet(roche, textarea.value);
    document.body.removeChild(modal);
  });

  // 关闭弹窗
  const closeModal = () => {
    if (document.body.contains(modal)) {
      document.body.removeChild(modal);
    }
  };

  document.getElementById('close-modal').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // 自动聚焦
  setTimeout(() => textarea.focus(), 100);
}

/**
 * 发布推文
 */
async function postTweet(roche, content) {
  if (!content || !content.trim()) return;

  const tweet = {
    id: twitterData.nextTweetId++,
    userId: currentUser,
    content: content.trim(),
    timestamp: Date.now(),
    likes: [],
    retweets: [],
    replies: []
  };

  twitterData.tweets.unshift(tweet);
  await saveData(roche);

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
