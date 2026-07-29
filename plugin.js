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

// 当前视图状态
let currentView = 'timeline';
let currentTweetId = null;

/**
 * Toast 提示框
 */
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `twitter-toast toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    top: 80px;
    left: 50%;
    transform: translateX(-50%);
    background: ${type === 'error' ? '#f4212e' : '#1d9bf0'};
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    z-index: 10000;
    font-size: 15px;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  `;
  document.body.appendChild(toast);
  setTimeout(() => {
    if (document.body.contains(toast)) {
      document.body.removeChild(toast);
    }
  }, 3000);
}

/**
 * 注册插件到 Roche 系统
 */
  window.RochePlugin.register({
    id: PLUGIN_ID,
    name: 'Twitter',
    version: '1.1.1',
    icon: '𝕏',
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
          alert('插件加载失败: ' + error.message);
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
 * 初始化用户（主用户 + 推荐好友）
 * 方案 A：简化版
 * - 主用户：固定用户名 "我"，使用默认头像
 * - 推荐好友：使用 roche.character.list() 获取 AI 角色
 * - 推文作者：就是主用户 "我"
 * - AI 角色可以关注、互动，但只有主用户能发推
 */
async function initializeUsers(roche) {
  // 主用户（固定）
  const mainUserId = 'main-user';

  if (!twitterData.users[mainUserId]) {
    twitterData.users[mainUserId] = {
      id: mainUserId,
      name: '我',
      username: '@me',
      avatar: generateAvatar('我'),
      bio: '这是我的 Twitter 账号',
      followers: 0,
      following: 0
    };
  }

  // 设置当前用户为主用户
  currentUser = mainUserId;

  // 推荐好友（AI 角色）
  const characters = await roche.character.list();
  for (const char of characters) {
    if (!twitterData.users[char.id]) {
      twitterData.users[char.id] = {
        id: char.id,
        name: char.name,
        username: `@${char.name.toLowerCase().replace(/\s+/g, '_')}`,
        avatar: char.avatar || generateAvatar(char.name),
        bio: char.description || '这个人很神秘，什么都没留下',
        followers: 0,
        following: 0,
        isCharacter: true // 标记为 AI 角色
      };
    }
  }

  // 初始化关注关系
  if (!twitterData.follows[currentUser]) {
    twitterData.follows[currentUser] = [];
  }

  await saveData(roche);
}

/**
 * 生成头像占位符
 */
function generateAvatar(name) {
  const colors = ['#1d9bf0', '#794bc4', '#f91880', '#00ba7c', '#ff7a00'];
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
 * SVG 图标集合
 */
const icons = {
  home: `<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M12 1.696L.622 8.807l1.06 1.696L3 9.679V19.5C3 20.881 4.119 22 5.5 22h13c1.381 0 2.5-1.119 2.5-2.5V9.679l1.318.824 1.06-1.696L12 1.696zM12 16.5c-1.933 0-3.5-1.567-3.5-3.5s1.567-3.5 3.5-3.5 3.5 1.567 3.5 3.5-1.567 3.5-3.5 3.5z"/></svg>`,
  search: `<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M10.25 3.75c-3.59 0-6.5 2.91-6.5 6.5s2.91 6.5 6.5 6.5c1.795 0 3.419-.726 4.596-1.904 1.178-1.177 1.904-2.801 1.904-4.596 0-3.59-2.91-6.5-6.5-6.5zm-8.5 6.5c0-4.694 3.806-8.5 8.5-8.5s8.5 3.806 8.5 8.5c0 1.986-.682 3.815-1.824 5.262l4.781 4.781-1.414 1.414-4.781-4.781c-1.447 1.142-3.276 1.824-5.262 1.824-4.694 0-8.5-3.806-8.5-8.5z"/></svg>`,
  compose: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M23 3c-6.62-.1-10.38 2.421-13.05 6.03C7.29 12.61 6 17.331 6 22h2c0-1.007.07-2.012.19-3H12c4.1 0 7.48-3.082 7.94-7.054C22.79 10.147 23.17 6.359 23 3zm-7 8h-1.5v2H16c.63-.016 1.2-.08 1.72-.188C16.95 15.24 14.68 17 12 17H8.55c.57-2.512 1.57-4.851 3-6.78 2.16-2.912 5.29-4.911 9.45-5.187C20.95 8.079 19.9 11 16 11zM4 9V6H1V4h3V1h2v3h3v2H6v3H4z"/></svg>`,
  notifications: `<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M19.993 9.042C19.48 5.017 16.054 2 11.996 2s-7.49 3.021-7.999 7.051L2.866 18H7.1c.463 2.282 2.481 4 4.9 4s4.437-1.718 4.9-4h4.236l-1.143-8.958zM12 20c-1.306 0-2.417-.835-2.829-2h5.658c-.412 1.165-1.523 2-2.829 2zm-6.866-4l.847-6.698C6.364 6.272 8.941 4 11.996 4s5.627 2.268 6.013 5.295L18.864 16H5.134z"/></svg>`,
  messages: `<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M1.998 5.5c0-1.381 1.119-2.5 2.5-2.5h15c1.381 0 2.5 1.119 2.5 2.5v13c0 1.381-1.119 2.5-2.5 2.5h-15c-1.381 0-2.5-1.119-2.5-2.5v-13zm2.5-.5c-.276 0-.5.224-.5.5v2.764l8 3.638 8-3.636V5.5c0-.276-.224-.5-.5-.5h-15zm15.5 5.463l-8 3.636-8-3.638V18.5c0 .276.224.5.5.5h15c.276 0 .5-.224.5-.5v-8.037z"/></svg>`,
  comment: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.37 2.77 6.08 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z"/></svg>`,
  retweet: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z"/></svg>`,
  like: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91zm4.187 7.69c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z"/></svg>`,
  likeFilled: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M20.884 13.19c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z"/></svg>`,
  share: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2.59l5.7 5.7-1.41 1.42L13 6.41V16h-2V6.41l-3.3 3.3-1.41-1.42L12 2.59zM21 15l-.02 3.51c0 1.38-1.12 2.49-2.5 2.49H5.5C4.11 21 3 19.88 3 18.5V15h2v3.5c0 .28.22.5.5.5h12.98c.28 0 .5-.22.5-.5L19 15h2z"/></svg>`,
  close: `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M10.59 12L4.54 5.96l1.42-1.42L12 10.59l6.04-6.05 1.42 1.42L13.41 12l6.05 6.04-1.42 1.42L12 13.41l-6.04 6.05-1.42-1.42L10.59 12z"/></svg>`,
  back: `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M7.414 13l5.043 5.04-1.414 1.42L3.586 12l7.457-7.46 1.414 1.42L7.414 11H21v2H7.414z"/></svg>`
};

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
        background: #ffffff;
        color: #0f1419;
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
        background: rgba(255, 255, 255, 0.85);
        backdrop-filter: blur(12px);
        border-bottom: 1px solid #eff3f4;
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
        font-size: 20px;
        font-weight: 700;
        letter-spacing: -0.5px;
        color: #0f1419;
      }

      .top-bar-close {
        color: #0f1419;
        cursor: pointer;
        padding: 8px;
        transition: background 0.2s;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .top-bar-close:hover {
        background: rgba(0, 0, 0, 0.03);
      }

      .top-bar-close:active {
        background: rgba(0, 0, 0, 0.08);
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
        border-bottom: 1px solid #eff3f4;
        transition: background 0.2s;
        cursor: pointer;
      }

      .tweet-item:hover {
        background: rgba(0, 0, 0, 0.03);
      }

      .tweet-item:active {
        background: rgba(0, 0, 0, 0.06);
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
        color: #0f1419;
      }

      .tweet-author-username {
        color: #536471;
        font-size: 15px;
      }

      .tweet-time {
        color: #536471;
        font-size: 15px;
      }

      .tweet-text {
        font-size: 15px;
        line-height: 20px;
        margin: 4px 0 12px 0;
        white-space: pre-wrap;
        word-wrap: break-word;
        color: #0f1419;
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
        color: #536471;
        font-size: 13px;
        cursor: pointer;
        padding: 8px 12px;
        border-radius: 20px;
        transition: all 0.2s;
      }

      .tweet-action:hover {
        background: rgba(29, 155, 240, 0.1);
        color: #1d9bf0;
      }

      .tweet-action:active {
        background: rgba(29, 155, 240, 0.2);
      }

      .tweet-action.liked {
        color: #f91880;
      }

      .tweet-action.liked:hover {
        background: rgba(249, 24, 128, 0.1);
        color: #f91880;
      }

      .tweet-action.liked:active {
        background: rgba(249, 24, 128, 0.2);
      }

      .tweet-action.retweeted {
        color: #00ba7c;
      }

      .tweet-action.retweeted:hover {
        background: rgba(0, 186, 124, 0.1);
        color: #00ba7c;
      }

      .tweet-action.retweeted:active {
        background: rgba(0, 186, 124, 0.2);
      }

      .tweet-action .action-icon {
        display: flex;
        align-items: center;
        justify-content: center;
      }

      /* 底部导航栏 */
      .mobile-bottom-nav {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        height: 60px;
        background: rgba(255, 255, 255, 0.85);
        backdrop-filter: blur(12px);
        border-top: 1px solid #eff3f4;
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
        color: #0f1419;
        cursor: pointer;
        transition: all 0.2s;
      }

      .bottom-nav-item.active {
        color: #0f1419;
      }

      .bottom-nav-item:hover {
        background: rgba(0, 0, 0, 0.03);
      }

      .bottom-nav-item:active {
        background: rgba(0, 0, 0, 0.08);
      }

      .bottom-nav-item.compose-btn {
        background: #1d9bf0;
        color: #ffffff;
        border-radius: 50%;
        width: 56px;
        height: 56px;
        margin: 0 8px;
        flex: 0 0 56px;
      }

      .bottom-nav-item.compose-btn:hover {
        background: #1a8cd8;
      }

      .bottom-nav-item.compose-btn:active {
        background: #1780c2;
      }

      /* 悬浮发推按钮 - 已移除，改用底部导航中间按钮 */

      /* 空状态 */
      .empty-state {
        padding: 60px 20px;
        text-align: center;
        color: #536471;
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
        background: rgba(0, 0, 0, 0.4);
        z-index: 200;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding: 20px;
        overflow-y: auto;
      }

      .compose-modal-content {
        background: #ffffff;
        border-radius: 16px;
        width: 100%;
        max-width: 600px;
        margin-top: 40px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      }

      .compose-modal-header {
        display: flex;
        align-items: center;
        padding: 12px 16px;
        border-bottom: 1px solid #eff3f4;
      }

      .compose-modal-close {
        cursor: pointer;
        padding: 8px;
        color: #0f1419;
        border-radius: 50%;
        transition: background 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .compose-modal-close:hover {
        background: rgba(0, 0, 0, 0.03);
      }

      .compose-modal-close:active {
        background: rgba(0, 0, 0, 0.08);
      }

      .compose-modal-title {
        flex: 1;
        text-align: center;
        font-weight: 700;
        color: #0f1419;
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
        color: #0f1419;
        font-size: 18px;
        resize: none;
        outline: none;
        min-height: 120px;
        font-family: inherit;
      }

      .compose-textarea::placeholder {
        color: #536471;
      }

      .compose-modal-footer {
        padding: 12px 16px;
        border-top: 1px solid #eff3f4;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .char-count {
        color: #536471;
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

      .compose-btn:hover:not(:disabled) {
        background: #1a8cd8;
      }

      .compose-btn:active:not(:disabled) {
        background: #1780c2;
      }

      .compose-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      /* 推文详情页 */
      .tweet-detail-view {
        display: none;
      }

      .tweet-detail-view.active {
        display: block;
      }

      .detail-header {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: 60px;
        background: rgba(255, 255, 255, 0.85);
        backdrop-filter: blur(12px);
        border-bottom: 1px solid #eff3f4;
        display: flex;
        align-items: center;
        padding: 0 16px;
        z-index: 100;
        max-width: 768px;
        margin: 0 auto;
      }

      .detail-back-btn {
        cursor: pointer;
        padding: 8px;
        transition: background 0.2s;
        color: #0f1419;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .detail-back-btn:hover {
        background: rgba(0, 0, 0, 0.03);
      }

      .detail-back-btn:active {
        background: rgba(0, 0, 0, 0.08);
      }

      .detail-title {
        margin-left: 24px;
        font-size: 19px;
        font-weight: 700;
        color: #0f1419;
      }

      .detail-main {
        padding-top: 60px;
        padding-bottom: 80px;
      }

      .detail-tweet {
        padding: 16px;
        border-bottom: 1px solid #eff3f4;
      }

      .detail-tweet-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
      }

      .detail-tweet-avatar {
        width: 48px;
        height: 48px;
        border-radius: 50%;
      }

      .detail-tweet-author {
        display: flex;
        flex-direction: column;
      }

      .detail-tweet-name {
        font-weight: 700;
        font-size: 16px;
        color: #0f1419;
      }

      .detail-tweet-username {
        color: #536471;
        font-size: 15px;
      }

      .detail-tweet-text {
        font-size: 23px;
        line-height: 28px;
        margin: 16px 0;
        white-space: pre-wrap;
        word-wrap: break-word;
        color: #0f1419;
      }

      .detail-tweet-time {
        color: #536471;
        font-size: 15px;
        padding: 16px 0;
        border-top: 1px solid #eff3f4;
      }

      .detail-tweet-stats {
        display: flex;
        gap: 20px;
        padding: 16px 0;
        border-top: 1px solid #eff3f4;
        border-bottom: 1px solid #eff3f4;
      }

      .detail-stat-item {
        display: flex;
        gap: 4px;
        font-size: 15px;
      }

      .detail-stat-number {
        font-weight: 700;
        color: #0f1419;
      }

      .detail-stat-label {
        color: #536471;
      }

      .detail-tweet-actions {
        display: flex;
        justify-content: space-around;
        padding: 12px 0;
      }

      .detail-action {
        display: flex;
        align-items: center;
        justify-content: center;
        color: #536471;
        cursor: pointer;
        padding: 12px;
        border-radius: 50%;
        transition: all 0.2s;
        width: 40px;
        height: 40px;
      }

      .detail-action:hover {
        background: rgba(29, 155, 240, 0.1);
        color: #1d9bf0;
      }

      .detail-action:active {
        background: rgba(29, 155, 240, 0.2);
      }

      .detail-action.liked {
        color: #f91880;
      }

      .detail-action.liked:hover {
        background: rgba(249, 24, 128, 0.1);
        color: #f91880;
      }

      .detail-action.liked:active {
        background: rgba(249, 24, 128, 0.2);
      }

      .detail-action.retweeted {
        color: #00ba7c;
      }

      .detail-action.retweeted:hover {
        background: rgba(0, 186, 124, 0.1);
        color: #00ba7c;
      }

      .detail-action.retweeted:active {
        background: rgba(0, 186, 124, 0.2);
      }

      .detail-replies {
        padding: 16px;
      }

      .detail-reply-input {
        display: flex;
        gap: 12px;
        padding: 16px;
        border-top: 1px solid #eff3f4;
        background: rgba(255, 255, 255, 0.85);
        backdrop-filter: blur(12px);
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        max-width: 768px;
        margin: 0 auto;
      }

      .detail-reply-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        flex-shrink: 0;
      }

      .detail-reply-form {
        flex: 1;
        display: flex;
        gap: 12px;
        align-items: center;
      }

      .detail-reply-textarea {
        flex: 1;
        background: #ffffff;
        border: 1px solid #eff3f4;
        border-radius: 20px;
        color: #0f1419;
        font-size: 15px;
        padding: 8px 16px;
        resize: none;
        outline: none;
        font-family: inherit;
        min-height: 40px;
        max-height: 120px;
      }

      .detail-reply-textarea::placeholder {
        color: #536471;
      }

      .detail-reply-textarea:focus {
        border-color: #1d9bf0;
      }

      .detail-reply-btn {
        background: #1d9bf0;
        color: #fff;
        border: none;
        border-radius: 20px;
        padding: 8px 16px;
        font-weight: 700;
        font-size: 14px;
        cursor: pointer;
        transition: background 0.2s;
      }

      .detail-reply-btn:hover:not(:disabled) {
        background: #1a8cd8;
      }

      .detail-reply-btn:active:not(:disabled) {
        background: #1780c2;
      }

      .detail-reply-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      /* 响应式 */
      @media (max-width: 768px) {
        #twitter-app {
          max-width: 100%;
        }

        .mobile-top-bar,
        .mobile-bottom-nav,
        .detail-header,
        .detail-reply-input {
          max-width: 100%;
        }
      }

      @media (max-width: 320px) {
        .tweet-action span:last-child {
          display: none;
        }
      }

      /* 选择对话框样式 */
      .select-dialog {
        background: rgba(0, 0, 0, 0.4);
      }

      .select-dialog-content {
        background: #ffffff;
        color: #0f1419;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      }

      .select-dialog-content h3 {
        color: #0f1419;
      }

      .select-dialog-item {
        color: #0f1419;
      }

      .select-dialog-item:hover {
        background: rgba(0, 0, 0, 0.03);
      }

      .select-dialog-cancel {
        background: #eff3f4;
        color: #0f1419;
      }

      .select-dialog-cancel:hover {
        background: #e7e9ea;
      }
    </style>

    <!-- 顶部导航栏 -->
    <div class="mobile-top-bar">
      <img class="top-bar-avatar" id="top-bar-avatar" src="" alt="" title="我的个人资料">
      <div class="top-bar-title">𝕏</div>
      <div class="top-bar-close" id="top-bar-close" title="关闭">${icons.close}</div>
    </div>

    <!-- 主内容区 -->
    <div class="mobile-main">
      <!-- 时间线视图 -->
      <div class="tweets-list" id="tweets-list">
        <div class="empty-state">
          <div class="empty-state-icon">🐦</div>
          <div>还没有推文</div>
          <div style="margin-top: 8px; font-size: 14px;">发布你的第一条推文吧！</div>
        </div>
      </div>

      <!-- 推文详情视图 -->
      <div class="tweet-detail-view" id="tweet-detail-view">
        <!-- 详情页头部 -->
        <div class="detail-header">
          <div class="detail-back-btn" id="detail-back-btn">${icons.back}</div>
          <div class="detail-title">帖子</div>
        </div>

        <!-- 详情页主内容 -->
        <div class="detail-main" id="detail-main">
          <!-- 动态加载推文详情 -->
        </div>

        <!-- 回复输入框 -->
        <div class="detail-reply-input" id="detail-reply-input">
          <img class="detail-reply-avatar" id="detail-reply-avatar" src="" alt="">
          <div class="detail-reply-form">
            <textarea class="detail-reply-textarea" id="detail-reply-textarea" placeholder="发布你的回复" rows="1"></textarea>
            <button class="detail-reply-btn" id="detail-reply-btn" disabled>回复</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部导航栏 -->
    <div class="mobile-bottom-nav">
      <div class="bottom-nav-item active" data-nav="home" title="主页">${icons.home}</div>
      <div class="bottom-nav-item" data-nav="search" title="搜索">${icons.search}</div>
      <div class="bottom-nav-item compose-btn" data-nav="compose" title="发推文">${icons.compose}</div>
      <div class="bottom-nav-item" data-nav="notifications" title="通知">${icons.notifications}</div>
      <div class="bottom-nav-item" data-nav="messages" title="私信">${icons.messages}</div>
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
}

/**
 * 绑定事件处理 - 移动端
 */
function bindEvents(roche) {
  // 顶部关闭按钮
  document.getElementById('top-bar-close').addEventListener('click', () => {
    exitApp();
  });

  // 顶部头像点击 - 显示个人资料
  document.getElementById('top-bar-avatar').addEventListener('click', () => {
    showToast('个人资料功能开发中...', 'info');
  });

  // 详情页返回按钮
  document.getElementById('detail-back-btn').addEventListener('click', () => {
    switchView('timeline');
  });

  // 详情页回复功能
  const replyTextarea = document.getElementById('detail-reply-textarea');
  const replyBtn = document.getElementById('detail-reply-btn');

  replyTextarea.addEventListener('input', () => {
    replyBtn.disabled = replyTextarea.value.trim().length === 0;
    // 自动调整高度
    replyTextarea.style.height = 'auto';
    replyTextarea.style.height = Math.min(replyTextarea.scrollHeight, 120) + 'px';
  });

  replyBtn.addEventListener('click', () => {
    postReply(roche, currentTweetId, replyTextarea.value.trim());
    replyTextarea.value = '';
    replyTextarea.style.height = 'auto';
    replyBtn.disabled = true;
  });

  // 底部导航切换
  document.querySelectorAll('.bottom-nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const nav = item.dataset.nav;

      if (nav === 'compose') {
        // 发推功能
        showComposeModal(roche);
        return;
      }

      // 移除所有 active 状态
      document.querySelectorAll('.bottom-nav-item').forEach(i => i.classList.remove('active'));
      // 添加当前 active 状态（发推按钮除外）
      if (nav !== 'compose') {
        item.classList.add('active');
      }

      if (nav === 'home') {
        switchView('timeline');
      } else {
        showToast(`${item.title}功能开发中...`, 'info');
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
        <div class="compose-modal-close" id="close-modal">${icons.close}</div>
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

  showToast('推文已发布！', 'success');
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
                <span class="action-icon">${icons.comment}</span>
                <span>${tweet.replies.length || ''}</span>
              </div>
              <div class="tweet-action ${isRetweeted ? 'retweeted' : ''}" data-action="retweet">
                <span class="action-icon">${icons.retweet}</span>
                <span>${tweet.retweets.length || ''}</span>
              </div>
              <div class="tweet-action ${isLiked ? 'liked' : ''}" data-action="like">
                <span class="action-icon">${isLiked ? icons.likeFilled : icons.like}</span>
                <span>${tweet.likes.length || ''}</span>
              </div>
              <div class="tweet-action" data-action="share">
                <span class="action-icon">${icons.share}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // 绑定推文点击事件 - 进入详情页
  listEl.querySelectorAll('.tweet-item').forEach(el => {
    el.addEventListener('click', (e) => {
      // 如果点击的是操作按钮，不进入详情页
      if (e.target.closest('.tweet-action')) return;

      const tweetId = parseInt(el.dataset.tweetId);
      showTweetDetail(tweetId, roche);
    });
  });

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
 * 切换视图
 */
function switchView(view) {
  currentView = view;

  const timelineView = document.getElementById('tweets-list');
  const detailView = document.getElementById('tweet-detail-view');
  const topBar = document.querySelector('.mobile-top-bar');

  if (view === 'timeline') {
    // 显示时间线
    timelineView.style.display = 'block';
    detailView.classList.remove('active');
    topBar.style.display = 'flex';

    // 重置底部导航
    document.querySelectorAll('.bottom-nav-item').forEach(i => i.classList.remove('active'));
    document.querySelector('[data-nav="home"]').classList.add('active');
  } else if (view === 'tweetDetail') {
    // 显示详情页
    timelineView.style.display = 'none';
    detailView.classList.add('active');
    topBar.style.display = 'none';
  }
}

/**
 * 显示推文详情
 */
function showTweetDetail(tweetId, roche) {
  const tweet = twitterData.tweets.find(t => t.id === tweetId);
  if (!tweet) return;

  currentTweetId = tweetId;
  const user = twitterData.users[tweet.userId];
  const currentUserData = twitterData.users[currentUser];
  const isLiked = tweet.likes.includes(currentUser);
  const isRetweeted = tweet.retweets.includes(currentUser);

  // 格式化时间
  const date = new Date(tweet.timestamp);
  const formattedTime = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  const formattedDate = date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });

  // 渲染详情内容
  const detailMain = document.getElementById('detail-main');
  detailMain.innerHTML = `
    <div class="detail-tweet">
      <div class="detail-tweet-header">
        <img class="detail-tweet-avatar" src="${user.avatar}" alt="">
        <div class="detail-tweet-author">
          <div class="detail-tweet-name">${user.name}</div>
          <div class="detail-tweet-username">${user.username}</div>
        </div>
      </div>
      <div class="detail-tweet-text">${escapeHtml(tweet.content)}</div>
      <div class="detail-tweet-time">${formattedTime} · ${formattedDate}</div>
      <div class="detail-tweet-stats">
        <div class="detail-stat-item">
          <span class="detail-stat-number">${tweet.retweets.length}</span>
          <span class="detail-stat-label">转发</span>
        </div>
        <div class="detail-stat-item">
          <span class="detail-stat-number">${tweet.likes.length}</span>
          <span class="detail-stat-label">喜欢</span>
        </div>
      </div>
      <div class="detail-tweet-actions">
        <div class="detail-action" data-action="reply">${icons.comment}</div>
        <div class="detail-action ${isRetweeted ? 'retweeted' : ''}" data-action="retweet">${icons.retweet}</div>
        <div class="detail-action ${isLiked ? 'liked' : ''}" data-action="like">${isLiked ? icons.likeFilled : icons.like}</div>
        <div class="detail-action" data-action="share">${icons.share}</div>
      </div>
    </div>
    <div class="detail-replies" id="detail-replies">
      ${tweet.replies.length === 0 ? '<div style="padding: 40px 20px; text-align: center; color: #536471;">暂无回复</div>' : ''}
    </div>
  `;

  // 更新回复输入框头像
  document.getElementById('detail-reply-avatar').src = currentUserData.avatar;

  // 绑定详情页操作按钮
  detailMain.querySelectorAll('.detail-action').forEach(el => {
    el.addEventListener('click', (e) => {
      const action = el.dataset.action;
      handleDetailAction(action, tweetId, roche);
    });
  });

  // 切换到详情视图
  switchView('tweetDetail');
}

/**
 * 处理详情页操作
 */
async function handleDetailAction(action, tweetId, roche) {
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
      await saveData(roche);
      showTweetDetail(tweetId, roche);
      break;

    case 'retweet':
      const retweetIndex = tweet.retweets.indexOf(currentUser);
      if (retweetIndex > -1) {
        tweet.retweets.splice(retweetIndex, 1);
      } else {
        tweet.retweets.push(currentUser);
      }
      await saveData(roche);
      showTweetDetail(tweetId, roche);
      break;

    case 'reply':
      // 聚焦到回复输入框
      document.getElementById('detail-reply-textarea').focus();
      break;

    case 'share':
      showToast('分享功能开发中...', 'info');
      break;
  }
}

/**
 * 发布回复
 */
async function postReply(roche, tweetId, content) {
  if (!content || !content.trim()) return;

  const tweet = twitterData.tweets.find(t => t.id === tweetId);
  if (!tweet) return;

  const reply = {
    id: Date.now(),
    userId: currentUser,
    content: content.trim(),
    timestamp: Date.now()
  };

  if (!tweet.replies) {
    tweet.replies = [];
  }
  tweet.replies.push(reply);

  await saveData(roche);
  showToast('回复已发布！', 'success');

  // 刷新详情页
  showTweetDetail(tweetId, roche);
}

/**
 * 退出应用
 */
function exitApp() {
  // 尝试返回上一页
  if (window.history.length > 1) {
    window.history.back();
  } else {
    // 如果没有历史记录，尝试关闭窗口
    window.close();
  }
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
      showToast('回复功能开发中...', 'info');
      return;

    case 'share':
      showToast('分享功能开发中...', 'info');
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
    dialog.className = 'select-dialog';
    dialog.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    `;

    const content = document.createElement('div');
    content.className = 'select-dialog-content';
    content.style.cssText = `
      background: #ffffff;
      border-radius: 16px;
      padding: 20px;
      max-width: 400px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    `;

    content.innerHTML = `
      <h3 style="margin: 0 0 20px 0; font-size: 20px; color: #0f1419;">${title}</h3>
      ${options.map(opt => `
        <div class="select-dialog-item" style="padding: 12px; cursor: pointer; border-radius: 8px; transition: background 0.2s; color: #0f1419;"
             onmouseover="this.style.background='rgba(0,0,0,0.03)'"
             onmouseout="this.style.background='transparent'"
             data-value="${opt.value}">
          ${opt.label}
        </div>
      `).join('')}
      <button class="select-dialog-cancel" style="margin-top: 20px; width: 100%; padding: 12px; background: #eff3f4; color: #0f1419; border: none; border-radius: 20px; cursor: pointer; font-weight: 700; transition: background 0.2s;"
              onmouseover="this.style.background='#e7e9ea'"
              onmouseout="this.style.background='#eff3f4'"
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
