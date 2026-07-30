/**
 * Roche Twitter - 完整推特克隆插件
 * 黑白配色，完整功能实现
 */

(function() {
  'use strict';

const PLUGIN_ID = 'twitter-x-2026';
const STORAGE_KEY = 'twitter_data';

// 初始化数据结构
let twitterData = {
  tweets: [],
  users: {},
  follows: {},
  nextTweetId: 1
};

// 插件设置
let settings = {
  enableMemory: true,        // 启用记忆
  autoSummary: true,         // 自动总结
  memoryTarget: 'current',   // 保存到当前会话
  notificationSound: true
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
    version: '2.9.7',
    icon: '𝕏',
    apps: [{
      id: 'twitter-home',
      name: 'Twitter',
      async mount(container, roche) {
        try {
          // 加载数据
          await loadData(roche);

          // 加载设置
          await loadSettings(roche);

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
 * 初始化用户系统
 * 使用正确的 Roche Persona API
 */
async function initializeUsers(roche) {
  console.log('[Twitter] 初始化用户系统');

  try {
    // 1. 获取当前活跃用户
    const activeUser = await roche.persona.getActiveUserPersona();
    console.log('[Twitter] 活跃用户:', activeUser);

    if (activeUser) {
      currentUser = activeUser.id;

      twitterData.users[activeUser.id] = {
        id: activeUser.id,
        name: activeUser.name,
        username: `@${activeUser.handle || activeUser.name}`,
        avatar: activeUser.avatar || generateAvatar(activeUser.name),
        bio: activeUser.bio || '这是我的 Twitter 账号',
        followers: 0,
        following: 0,
        conversationId: activeUser.conversationId,
        isPersona: true
      };
    }

    // 2. 获取所有用户 Persona（面具）
    const allPersonas = await roche.persona.getUserPersonas();
    console.log('[Twitter] 所有 Persona:', allPersonas);

    if (allPersonas && allPersonas.length > 0) {
      for (const persona of allPersonas) {
        if (!twitterData.users[persona.id]) {
          twitterData.users[persona.id] = {
            id: persona.id,
            name: persona.name,
            username: `@${persona.handle || persona.name}`,
            avatar: persona.avatar || generateAvatar(persona.name),
            bio: persona.bio || '',
            followers: 0,
            following: 0,
            conversationId: persona.conversationId,
            isPersona: true
          };
        }
      }
    }

    // 3. 如果没有用户，创建默认用户
    if (!currentUser) {
      const defaultId = 'default-user';
      currentUser = defaultId;
      twitterData.users[defaultId] = {
        id: defaultId,
        name: '我',
        username: '@me',
        avatar: generateAvatar('我'),
        bio: '这是我的 Twitter 账号',
        followers: 0,
        following: 0,
        isPersona: true
      };
    }

    // 4. 初始化关注关系
    if (!twitterData.follows[currentUser]) {
      twitterData.follows[currentUser] = [];
    }

    await saveData(roche);
    console.log('[Twitter] 用户初始化完成，当前用户:', currentUser);

  } catch (error) {
    console.error('[Twitter] 用户初始化失败:', error);
    // 创建默认用户作为后备
    const defaultId = 'default-user';
    currentUser = defaultId;
    twitterData.users[defaultId] = {
      id: defaultId,
      name: '我',
      username: '@me',
      avatar: generateAvatar('我'),
      bio: '这是我的 Twitter 账号',
      followers: 0,
      following: 0,
      isPersona: true
    };
  }
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
  back: `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M7.414 13l5.043 5.04-1.414 1.42L3.586 12l7.457-7.46 1.414 1.42L7.414 11H21v2H7.414z"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M13 11h8v2h-8v8h-2v-8H3v-2h8V3h2v8z"/></svg>`,
  settings: `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M10.54 1.75h2.92l1.57 2.36c.11.17.32.25.53.21l2.53-.59 2.17 2.17-.58 2.54c-.05.2.04.41.21.53l2.36 1.57v2.92l-2.36 1.57c-.17.12-.26.33-.21.53l.58 2.54-2.17 2.17-2.53-.59c-.21-.04-.42.04-.53.21l-1.57 2.36h-2.92l-1.58-2.36c-.11-.17-.32-.25-.52-.21l-2.54.59-2.17-2.17.58-2.54c.05-.2-.03-.41-.21-.53l-2.35-1.57v-2.92L4.1 8.97c.18-.12.26-.33.21-.53L3.73 5.9 5.9 3.73l2.54.59c.2.04.41-.04.52-.21l1.58-2.36zm1.07 2l-.98 1.47C10.05 6.08 9 6.5 7.99 6.27l-1.46-.34-.6.6.33 1.46c.24 1.01-.18 2.07-1.05 2.64l-1.47.98v.78l1.47.98c.87.57 1.29 1.63 1.05 2.64l-.33 1.46.6.6 1.46-.34c1.01-.23 2.06.19 2.64 1.05l.98 1.47h.78l.97-1.47c.58-.86 1.63-1.28 2.65-1.05l1.45.34.61-.6-.34-1.46c-.23-1.01.18-2.07 1.05-2.64l1.47-.98v-.78l-1.47-.98c-.87-.57-1.28-1.63-1.05-2.64l.34-1.46-.61-.6-1.45.34c-1.02.23-2.07-.19-2.65-1.05l-.97-1.47h-.78zM12 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5c.82 0 1.5-.67 1.5-1.5s-.68-1.5-1.5-1.5zM8.5 12c0-1.93 1.56-3.5 3.5-3.5 1.93 0 3.5 1.57 3.5 3.5s-1.57 3.5-3.5 3.5c-1.94 0-3.5-1.57-3.5-3.5z"/></svg>`,
  calendar: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7 4V3h2v1h6V3h2v1h1.5C19.89 4 21 5.12 21 6.5v12c0 1.38-1.11 2.5-2.5 2.5h-13C4.12 21 3 19.88 3 18.5v-12C3 5.12 4.12 4 5.5 4H7zm0 2H5.5c-.27 0-.5.22-.5.5V8h14V6.5c0-.28-.22-.5-.5-.5H16v1h-2V6H10v1H8V6zm12 4H5v8.5c0 .28.22.5.5.5h13c.28 0 .5-.22.5-.5V10z"/></svg>`,
  verified: `<svg viewBox="0 0 24 24" width="18" height="18" fill="#1d9bf0"><path d="M8.52 3.59c.89-1.38 3.05-1.38 3.94 0l.53.82c.23.36.63.61 1.07.67l.96.13c1.61.22 2.39 2.15 1.44 3.53l-.57.82c-.25.36-.31.81-.17 1.23l.31.92c.52 1.54-.78 3.04-2.39 2.75l-.95-.17c-.43-.08-.88.04-1.21.31l-.74.6c-1.24 1.01-3.05.41-3.31-1.1l-.16-.96c-.07-.43-.33-.8-.7-1l-.81-.43c-1.37-.73-1.63-2.59-.48-3.73l.69-.68c.3-.3.45-.73.39-1.15l-.13-.96c-.22-1.61 1.12-2.96 2.73-2.5l.96.27c.43.12.89.05 1.24-.19l.76-.53zm2.63 1.3c-.3-.46-1.02-.46-1.32 0l-.53.82c-.47.72-1.23 1.23-2.08 1.35l-.96.13c-.54.07-.8.72-.48 1.18l.57.82c.4.58.51 1.3.29 1.97l-.31.92c-.17.52.26 1.02.8.92l.95-.17c.68-.12 1.38.07 1.93.49l.74.6c.42.34 1.02.14 1.11-.37l.16-.96c.12-.68.53-1.28 1.12-1.6l.81-.43c.46-.24.55-.87.16-1.25l-.69-.68c-.48-.48-.72-1.17-.62-1.83l.13-.96c.07-.54-.37-.99-.91-.84l-.96.27c-.68.19-1.42.08-2-.37l-.76-.53zm-.11 6.44l-2.83-2.83-1.41 1.41 4.24 4.25 5.66-5.66-1.42-1.41-4.24 4.24z"/></svg>`,
  follow: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M17.863 13.44c1.477 1.58 2.366 3.8 2.632 6.46l.11 1.1H3.395l.11-1.1c.266-2.66 1.155-4.88 2.632-6.46C7.627 11.85 9.648 11 12 11s4.373.85 5.863 2.44zM12 2C9.791 2 8 3.79 8 6s1.791 4 4 4 4-1.79 4-4-1.791-4-4-4z"/></svg>`,
  memory: `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z"/></svg>`
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
        /* iOS 安全区域适配 */
        padding-top: env(safe-area-inset-top);
        height: calc(60px + env(safe-area-inset-top));
        background: rgba(255, 255, 255, 0.85);
        backdrop-filter: blur(12px);
        border-bottom: 1px solid #eff3f4;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding-left: 16px;
        padding-right: 16px;
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

      /* 左侧抽屉侧边栏 */
      .sidebar-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.4);
        z-index: 300;
        display: none;
        animation: fadeIn 0.2s ease-out;
      }

      .sidebar-overlay.active {
        display: block;
      }

      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      @keyframes slideIn {
        from { transform: translateX(-100%); }
        to { transform: translateX(0); }
      }

      .sidebar-drawer {
        position: fixed;
        top: 0;
        left: -280px;
        width: 280px;
        height: 100%;
        background: #ffffff;
        z-index: 301;
        transition: left 0.3s ease-out;
        overflow-y: auto;
        box-shadow: 4px 0 12px rgba(0, 0, 0, 0.1);
        /* iOS 安全区域适配 */
        padding-top: env(safe-area-inset-top);
        padding-bottom: env(safe-area-inset-bottom);
      }

      .sidebar-drawer.active {
        left: 0;
      }

      .sidebar-header {
        padding: 16px;
        border-bottom: 1px solid #eff3f4;
      }

      .sidebar-user-avatar {
        width: 64px;
        height: 64px;
        border-radius: 50%;
        margin-bottom: 12px;
      }

      .sidebar-user-name {
        font-size: 18px;
        font-weight: 700;
        color: #0f1419;
        margin-bottom: 2px;
      }

      .sidebar-user-username {
        font-size: 15px;
        color: #536471;
        margin-bottom: 12px;
      }

      .sidebar-user-stats {
        display: flex;
        gap: 16px;
        font-size: 14px;
      }

      .sidebar-stat {
        display: flex;
        gap: 4px;
        cursor: pointer;
      }

      .sidebar-stat:hover .sidebar-stat-number {
        text-decoration: underline;
      }

      .sidebar-stat-number {
        font-weight: 700;
        color: #0f1419;
      }

      .sidebar-stat-label {
        color: #536471;
      }

      .sidebar-menu {
        padding: 8px 0;
      }

      .sidebar-menu-item {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 14px 16px;
        color: #0f1419;
        cursor: pointer;
        transition: background 0.2s;
        font-size: 19px;
        font-weight: 400;
      }

      .sidebar-menu-item:hover {
        background: rgba(0, 0, 0, 0.03);
      }

      .sidebar-menu-item:active {
        background: rgba(0, 0, 0, 0.08);
      }

      .sidebar-menu-icon {
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        display: none;
      }

      .sidebar-section-title {
        padding: 12px 16px 8px 16px;
        color: #536471;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.5px;
      }

      .sidebar-divider {
        height: 1px;
        background: #eff3f4;
        margin: 8px 0;
      }

      .sidebar-personas {
        border-top: 1px solid #eff3f4;
        padding: 12px 0;
      }

      .sidebar-persona-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        cursor: pointer;
        transition: background 0.2s;
        position: relative;
      }

      .sidebar-persona-item:hover {
        background: rgba(0, 0, 0, 0.03);
      }

      .sidebar-persona-item.active::before {
        content: '';
        position: absolute;
        left: 0;
        top: 50%;
        transform: translateY(-50%);
        width: 4px;
        height: 32px;
        background: #1d9bf0;
        border-radius: 0 2px 2px 0;
      }

      .sidebar-persona-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
      }

      .sidebar-persona-info {
        flex: 1;
        min-width: 0;
      }

      .sidebar-persona-name {
        font-size: 15px;
        font-weight: 700;
        color: #0f1419;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .sidebar-persona-username {
        font-size: 14px;
        color: #536471;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
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

      .top-bar-menu {
        color: #0f1419;
        cursor: pointer;
        padding: 8px;
        transition: background 0.2s;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
      }

      .top-bar-menu:hover {
        background: rgba(0, 0, 0, 0.03);
      }

      .top-bar-menu:active {
        background: rgba(0, 0, 0, 0.08);
      }

      .top-bar-dropdown {
        position: absolute;
        top: 100%;
        right: 0;
        margin-top: 4px;
        background: #ffffff;
        border-radius: 12px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
        min-width: 200px;
        display: none;
        z-index: 200;
      }

      .top-bar-dropdown.active {
        display: block;
      }

      .top-bar-dropdown-item {
        padding: 14px 16px;
        cursor: pointer;
        transition: background 0.2s;
        font-size: 15px;
        color: #0f1419;
      }

      .top-bar-dropdown-item:first-child {
        border-radius: 12px 12px 0 0;
      }

      .top-bar-dropdown-item:last-child {
        border-radius: 0 0 12px 12px;
      }

      .top-bar-dropdown-item:hover {
        background: rgba(0, 0, 0, 0.03);
      }

      .top-bar-dropdown-item:active {
        background: rgba(0, 0, 0, 0.08);
      }

      /* 主内容区 */
      .mobile-main {
        padding-top: calc(60px + env(safe-area-inset-top));
        padding-bottom: calc(60px + env(safe-area-inset-bottom));
        min-height: 100vh;
      }

      /* 主页标签 */
      .timeline-tabs {
        position: fixed;
        top: calc(60px + env(safe-area-inset-top));
        left: 0;
        right: 0;
        display: flex;
        background: rgba(255, 255, 255, 0.85);
        backdrop-filter: blur(12px);
        border-bottom: 1px solid #eff3f4;
        z-index: 99;
        max-width: 768px;
        margin: 0 auto;
      }

      .timeline-tab {
        flex: 1;
        text-align: center;
        padding: 16px;
        color: #536471;
        font-weight: 500;
        font-size: 15px;
        cursor: pointer;
        position: relative;
        transition: background 0.2s;
      }

      .timeline-tab:hover {
        background: rgba(0, 0, 0, 0.03);
      }

      .timeline-tab.active {
        color: #0f1419;
        font-weight: 700;
      }

      .timeline-tab.active::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 50%;
        transform: translateX(-50%);
        width: 60px;
        height: 4px;
        background: #1d9bf0;
        border-radius: 2px;
      }

      .timeline-content {
        padding-top: 53px;
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

      .tweet-news-badge {
        display: inline-block;
        background: #1d9bf0;
        color: white;
        font-size: 11px;
        padding: 2px 6px;
        border-radius: 4px;
        margin-left: 4px;
        font-weight: 700;
      }

      .tweet-source {
        color: #536471;
        font-size: 13px;
        margin-left: 4px;
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
        /* iOS 安全区域适配 */
        padding-bottom: env(safe-area-inset-bottom);
        height: calc(60px + env(safe-area-inset-bottom));
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
        /* iOS 安全区域适配 */
        padding-top: env(safe-area-inset-top);
        height: calc(60px + env(safe-area-inset-top));
        background: rgba(255, 255, 255, 0.85);
        backdrop-filter: blur(12px);
        border-bottom: 1px solid #eff3f4;
        display: flex;
        align-items: center;
        padding-left: 16px;
        padding-right: 16px;
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
        padding-top: calc(60px + env(safe-area-inset-top));
        padding-bottom: calc(80px + env(safe-area-inset-bottom));
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

      /* 新的详情页样式 */
      .detail-user-section {
        margin-bottom: 16px;
      }

      .detail-user-header {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        margin-bottom: 12px;
      }

      .detail-user-info {
        flex: 1;
      }

      .detail-follow-btn {
        padding: 6px 16px;
        border-radius: 20px;
        border: none;
        background: #0f1419;
        color: #ffffff;
        font-weight: 700;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s;
        min-width: 80px;
      }

      .detail-follow-btn:hover {
        background: #272c30;
      }

      .detail-follow-btn.following {
        background: transparent;
        color: #0f1419;
        border: 1px solid #cfd9de;
      }

      .detail-follow-btn.following:hover {
        background: rgba(244, 33, 46, 0.1);
        border-color: rgba(244, 33, 46, 0.4);
        color: #f4212e;
      }

      .detail-follow-btn.following:hover::after {
        content: '取消关注';
        position: absolute;
      }

      .detail-follow-btn.following:hover span {
        display: none;
      }

      .detail-translate-link {
        display: flex;
        align-items: center;
        gap: 4px;
        cursor: pointer;
        padding: 4px 0;
      }

      .detail-tweet-content {
        font-size: 23px;
        line-height: 28px;
        color: #0f1419;
        margin: 16px 0;
        white-space: pre-wrap;
        word-wrap: break-word;
      }

      .detail-tweet-meta {
        color: #536471;
        font-size: 15px;
        padding: 16px 0;
        border-bottom: 1px solid #eff3f4;
      }

      .detail-tweet-likes {
        padding: 12px 0;
        border-bottom: 1px solid #eff3f4;
        font-size: 15px;
      }

      .detail-action-bar {
        display: flex;
        justify-content: space-around;
        align-items: center;
        padding: 12px 0;
        border-bottom: 1px solid #eff3f4;
      }

      .detail-action-icon {
        display: flex;
        align-items: center;
        gap: 4px;
        color: #536471;
        cursor: pointer;
        padding: 8px;
        border-radius: 20px;
        transition: all 0.2s;
        font-size: 13px;
      }

      .detail-action-icon svg {
        width: 20px;
        height: 20px;
      }

      .detail-action-icon .action-count {
        font-size: 13px;
        color: inherit;
      }

      .detail-action-icon:hover {
        background: rgba(29, 155, 240, 0.1);
        color: #1d9bf0;
      }

      .detail-action-icon.liked {
        color: #f91880;
      }

      .detail-action-icon.liked:hover {
        background: rgba(249, 24, 128, 0.1);
      }

      .detail-action-icon.retweeted {
        color: #00ba7c;
      }

      .detail-action-icon.retweeted:hover {
        background: rgba(0, 186, 124, 0.1);
      }

      .detail-action-icon.bookmarked {
        color: #1d9bf0;
      }

      .detail-action-icon.bookmarked:hover {
        background: rgba(29, 155, 240, 0.1);
      }

      .detail-replies-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 0;
        border-bottom: 1px solid #eff3f4;
        cursor: pointer;
      }

      .detail-discover-more {
        padding: 20px 0;
        border-bottom: 1px solid #eff3f4;
      }

      .detail-source-label {
        padding: 12px 0;
      }

      /* 旧样式保留（兼容） */
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
        padding-bottom: calc(16px + env(safe-area-inset-bottom));
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

      /* 页面视图 */
      .page-view {
        display: none;
        padding-top: calc(60px + env(safe-area-inset-top));
        padding-bottom: calc(60px + env(safe-area-inset-bottom));
        min-height: 100vh;
      }

      .page-view.active {
        display: block;
      }

      /* 搜索页 */
      .search-top-bar {
        position: fixed;
        top: env(safe-area-inset-top);
        left: 0;
        right: 0;
        height: 60px;
        background: rgba(255, 255, 255, 0.85);
        backdrop-filter: blur(12px);
        border-bottom: 1px solid #eff3f4;
        display: flex;
        align-items: center;
        padding: 0 16px;
        gap: 8px;
        z-index: 100;
        max-width: 768px;
        margin: 0 auto;
      }

      .search-avatar-btn {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        overflow: hidden;
        cursor: pointer;
        transition: opacity 0.2s;
        flex-shrink: 0;
      }

      .search-avatar-btn:hover {
        opacity: 0.8;
      }

      .search-avatar-btn img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .search-settings-btn {
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        cursor: pointer;
        transition: background 0.2s;
        flex-shrink: 0;
      }

      .search-settings-btn:hover {
        background: rgba(0, 0, 0, 0.05);
      }

      .search-settings-btn svg {
        width: 20px;
        height: 20px;
        fill: #0f1419;
      }

      .search-input-wrapper {
        flex: 1;
        display: flex;
        align-items: center;
        background: #eff3f4;
        border-radius: 24px;
        padding: 10px 16px;
        gap: 12px;
        color: #536471;
        min-width: 0;
      }

      .search-input {
        flex: 1;
        background: transparent;
        border: none;
        outline: none;
        font-size: 15px;
        color: #0f1419;
        min-width: 0;
      }

      .search-input::placeholder {
        color: #536471;
      }

      .search-tabs-bar {
        position: fixed;
        top: calc(60px + env(safe-area-inset-top));
        left: 0;
        right: 0;
        background: rgba(255, 255, 255, 0.85);
        backdrop-filter: blur(12px);
        border-bottom: 1px solid #eff3f4;
        display: flex;
        overflow-x: auto;
        z-index: 99;
        max-width: 768px;
        margin: 0 auto;
        scrollbar-width: none;
      }

      .search-tabs-bar::-webkit-scrollbar {
        display: none;
      }

      .search-tab {
        padding: 16px 20px;
        color: #536471;
        font-weight: 500;
        font-size: 15px;
        cursor: pointer;
        position: relative;
        transition: background 0.2s;
        white-space: nowrap;
        flex-shrink: 0;
      }

      .search-tab:hover {
        background: rgba(0, 0, 0, 0.03);
      }

      .search-tab.active {
        color: #0f1419;
        font-weight: 700;
      }

      .search-tab.active::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 50%;
        transform: translateX(-50%);
        width: 60px;
        height: 4px;
        background: #1d9bf0;
        border-radius: 2px;
      }

      .search-content {
        padding-top: calc(60px + 53px); /* 顶部栏 + 标签栏 */
      }

      .search-header {
        position: fixed;
        top: calc(60px + env(safe-area-inset-top));
        left: 0;
        right: 0;
        padding: 12px 16px;
        background: #ffffff;
        border-bottom: 1px solid #eff3f4;
        z-index: 99;
        max-width: 768px;
        margin: 0 auto;
      }

      .section-title {
        font-size: 20px;
        font-weight: 800;
        padding: 12px 16px;
        margin: 0;
        color: #0f1419;
      }

      .trends-section {
        border-bottom: 1px solid #eff3f4;
        padding-bottom: 12px;
      }

      .trend-item {
        padding: 12px 16px;
        cursor: pointer;
        transition: background 0.2s;
      }

      .trend-item:hover {
        background: rgba(0, 0, 0, 0.03);
      }

      .trend-category {
        font-size: 13px;
        color: #536471;
        margin-bottom: 2px;
      }

      .trend-hashtag {
        font-size: 15px;
        font-weight: 700;
        color: #0f1419;
        margin-bottom: 2px;
      }

      .trend-count {
        font-size: 13px;
        color: #536471;
      }

      .recommended-section {
        padding-bottom: 12px;
      }

      .recommended-user {
        padding: 12px 16px;
        display: flex;
        align-items: center;
        gap: 12px;
        transition: background 0.2s;
      }

      .recommended-user:hover {
        background: rgba(0, 0, 0, 0.03);
      }

      .recommended-avatar {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        flex-shrink: 0;
      }

      .recommended-info {
        flex: 1;
        min-width: 0;
      }

      .recommended-name {
        font-size: 15px;
        font-weight: 700;
        color: #0f1419;
      }

      .recommended-username {
        font-size: 15px;
        color: #536471;
      }

      .recommended-bio {
        font-size: 14px;
        color: #0f1419;
        margin-top: 2px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .follow-btn {
        background: #0f1419;
        color: #ffffff;
        border: none;
        border-radius: 20px;
        padding: 6px 16px;
        font-weight: 700;
        font-size: 14px;
        cursor: pointer;
        transition: background 0.2s;
      }

      .follow-btn:hover {
        background: #272c30;
      }

      .follow-btn.following {
        background: transparent;
        color: #0f1419;
        border: 1px solid #cfd9de;
      }

      .follow-btn.following:hover {
        background: rgba(244, 33, 46, 0.1);
        color: #f4212e;
        border-color: rgba(244, 33, 46, 0.1);
      }

      /* 通知页 */
      .notifications-top-bar {
        position: fixed;
        top: env(safe-area-inset-top);
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

      .notifications-top-left {
        display: flex;
        align-items: center;
        gap: 16px;
      }

      .notifications-avatar-btn {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        overflow: hidden;
        cursor: pointer;
        transition: opacity 0.2s;
      }

      .notifications-avatar-btn:hover {
        opacity: 0.8;
      }

      .notifications-avatar-btn img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .notifications-title {
        font-size: 20px;
        font-weight: 700;
        color: #0f1419;
      }

      .notifications-settings-btn {
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        cursor: pointer;
        transition: background 0.2s;
      }

      .notifications-settings-btn:hover {
        background: rgba(0, 0, 0, 0.05);
      }

      .notifications-settings-btn svg {
        width: 20px;
        height: 20px;
        fill: #0f1419;
      }

      .notifications-header {
        position: fixed;
        top: calc(60px + env(safe-area-inset-top));
        left: 0;
        right: 0;
        background: rgba(255, 255, 255, 0.85);
        backdrop-filter: blur(12px);
        border-bottom: 1px solid #eff3f4;
        z-index: 99;
        max-width: 768px;
        margin: 0 auto;
      }

      .notifications-tabs {
        display: flex;
      }

      .notifications-tab {
        flex: 1;
        text-align: center;
        padding: 16px;
        color: #536471;
        font-weight: 500;
        font-size: 15px;
        cursor: pointer;
        position: relative;
        transition: background 0.2s;
      }

      .notifications-tab:hover {
        background: rgba(0, 0, 0, 0.03);
      }

      .notifications-tab.active {
        color: #0f1419;
        font-weight: 700;
      }

      .notifications-tab.active::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 50%;
        transform: translateX(-50%);
        width: 60px;
        height: 4px;
        background: #1d9bf0;
        border-radius: 2px;
      }

      .notifications-content {
        width: 100%;
        padding-top: calc(60px + 53px); /* 顶部栏 + 标签栏 */
      }

      .notification-item {
        padding: 12px 16px;
        border-bottom: 1px solid #eff3f4;
        display: flex;
        gap: 12px;
        cursor: pointer;
        transition: background 0.2s;
        position: relative;
      }

      .notification-item:hover {
        background: rgba(0, 0, 0, 0.03);
      }

      .notification-avatar-wrapper {
        width: 40px;
        height: 40px;
        position: relative;
        flex-shrink: 0;
      }

      .notification-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
      }

      .notification-type-icon {
        position: absolute;
        bottom: -2px;
        right: -2px;
        width: 20px;
        height: 20px;
        background: #ffffff;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid #ffffff;
      }

      .notification-content {
        flex: 1;
        min-width: 0;
      }

      .notification-text {
        font-size: 15px;
        color: #0f1419;
        margin-bottom: 4px;
        line-height: 20px;
      }

      .notification-text strong {
        font-weight: 700;
      }

      .notification-time {
        font-size: 14px;
        color: #536471;
      }

      .notification-preview {
        margin-top: 8px;
        padding: 12px;
        background: rgba(0, 0, 0, 0.03);
        border-radius: 8px;
        font-size: 14px;
        color: #536471;
        line-height: 18px;
      }

      /* 私信页 */
      .messages-list-view {
        display: block;
      }

      .messages-list-view.hidden {
        display: none;
      }

      .messages-top-bar {
        position: fixed;
        top: env(safe-area-inset-top);
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

      .messages-avatar-btn {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        overflow: hidden;
        cursor: pointer;
        transition: opacity 0.2s;
      }

      .messages-avatar-btn:hover {
        opacity: 0.8;
      }

      .messages-avatar-btn img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .messages-title {
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
        font-size: 20px;
        font-weight: 700;
        color: #0f1419;
      }

      .messages-filter-btn {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 6px 12px;
        border: 1px solid #cfd9de;
        border-radius: 20px;
        cursor: pointer;
        transition: all 0.2s;
        font-size: 15px;
        font-weight: 700;
        color: #0f1419;
      }

      .messages-filter-btn:hover {
        background: rgba(0, 0, 0, 0.03);
      }

      .messages-search-bar {
        position: fixed;
        top: calc(60px + env(safe-area-inset-top));
        left: 0;
        right: 0;
        padding: 12px 16px;
        background: rgba(255, 255, 255, 0.85);
        backdrop-filter: blur(12px);
        border-bottom: 1px solid #eff3f4;
        z-index: 99;
        max-width: 768px;
        margin: 0 auto;
      }

      .messages-search-wrapper {
        display: flex;
        align-items: center;
        background: #eff3f4;
        border-radius: 24px;
        padding: 10px 16px;
        gap: 12px;
        color: #536471;
      }

      .messages-search-input {
        flex: 1;
        background: transparent;
        border: none;
        outline: none;
        font-size: 15px;
        color: #0f1419;
      }

      .messages-search-input::placeholder {
        color: #536471;
      }

      .messages-content {
        padding-top: calc(60px + 60px); /* 顶部栏 + 搜索栏 */
      }

      .messages-welcome {
        padding: 60px 32px;
        text-align: center;
      }

      .messages-welcome-title {
        font-size: 31px;
        font-weight: 800;
        color: #0f1419;
        margin-bottom: 12px;
      }

      .messages-welcome-desc {
        font-size: 15px;
        color: #536471;
        line-height: 20px;
        margin-bottom: 28px;
      }

      .messages-write-btn {
        padding: 16px 32px;
        background: #0f1419;
        color: #ffffff;
        border: none;
        border-radius: 24px;
        font-size: 17px;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s;
      }

      .messages-write-btn:hover {
        background: #272c30;
      }

      .messages-fab {
        position: fixed;
        right: 20px;
        bottom: calc(80px + env(safe-area-inset-bottom));
        width: 56px;
        height: 56px;
        background: #1d9bf0;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        cursor: pointer;
        transition: all 0.2s;
        z-index: 99;
      }

      @media (max-width: 768px) {
        .messages-fab {
          right: 16px;
          bottom: calc(72px + env(safe-area-inset-bottom));
        }
      }

      .messages-fab:hover {
        background: #1a8cd8;
        transform: scale(1.05);
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
      }

      .messages-fab:active {
        transform: scale(0.95);
      }

      .messages-list {
        width: 100%;
      }

      .message-item {
        padding: 16px;
        border-bottom: 1px solid #eff3f4;
        display: flex;
        gap: 12px;
        cursor: pointer;
        transition: background 0.2s;
        position: relative;
      }

      .message-item:hover {
        background: rgba(0, 0, 0, 0.03);
      }

      .message-avatar {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        flex-shrink: 0;
      }

      .message-info {
        flex: 1;
        min-width: 0;
      }

      .message-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 4px;
      }

      .message-name {
        font-size: 15px;
        font-weight: 700;
        color: #0f1419;
      }

      .message-time {
        font-size: 14px;
        color: #536471;
      }

      .message-preview {
        font-size: 15px;
        color: #536471;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .message-unread-dot {
        position: absolute;
        top: 16px;
        right: 16px;
        width: 8px;
        height: 8px;
        background: #1d9bf0;
        border-radius: 50%;
      }

      /* 聊天视图 - 改为独立页面 */
      .chat-view {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: #ffffff;
        display: none;
        flex-direction: column;
        z-index: 200;
        overflow: hidden;
      }

      .chat-view.active {
        display: flex;
      }

      .chat-header {
        position: fixed;
        top: env(safe-area-inset-top);
        left: 0;
        right: 0;
        height: 53px;
        background: rgba(255, 255, 255, 0.85);
        backdrop-filter: blur(12px);
        border-bottom: 1px solid #eff3f4;
        display: flex;
        align-items: center;
        padding: 0 16px;
        gap: 12px;
        z-index: 100;
        max-width: 768px;
        margin: 0 auto;
      }

      .chat-back-btn {
        cursor: pointer;
        padding: 8px;
        color: #0f1419;
        border-radius: 50%;
        transition: background 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .chat-back-btn:hover {
        background: rgba(0, 0, 0, 0.03);
      }

      .chat-user-info {
        flex: 1;
      }

      .chat-user-name {
        font-size: 17px;
        font-weight: 700;
        color: #0f1419;
      }

      .chat-settings-btn {
        cursor: pointer;
        padding: 8px;
        color: #0f1419;
        border-radius: 50%;
        transition: background 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .chat-settings-btn:hover {
        background: rgba(0, 0, 0, 0.03);
      }

      .chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        padding-top: calc(env(safe-area-inset-top) + 53px + 16px);
        padding-bottom: calc(80px + env(safe-area-inset-bottom));
      }

      .chat-message {
        display: flex;
        gap: 8px;
        margin-bottom: 16px;
      }

      .chat-message.own {
        flex-direction: row-reverse;
      }

      .chat-message-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        flex-shrink: 0;
      }

      .chat-message-bubble {
        background: #eff3f4;
        color: #0f1419;
        border-radius: 18px;
        padding: 10px 14px;
        max-width: 70%;
        word-wrap: break-word;
      }

      .chat-message.own .chat-message-bubble {
        background: #1d9bf0;
        color: #ffffff;
      }

      .chat-input-area {
        position: fixed;
        bottom: calc(60px + env(safe-area-inset-bottom));
        left: 0;
        right: 0;
        padding: 12px 16px;
        background: rgba(255, 255, 255, 0.85);
        backdrop-filter: blur(12px);
        border-top: 1px solid #eff3f4;
        display: flex;
        gap: 8px;
        max-width: 768px;
        margin: 0 auto;
      }

      .chat-input {
        flex: 1;
        background: #eff3f4;
        border: none;
        border-radius: 20px;
        padding: 10px 16px;
        font-size: 15px;
        outline: none;
        color: #0f1419;
      }

      .chat-input::placeholder {
        color: #536471;
      }

      .chat-send-btn {
        background: #1d9bf0;
        color: #ffffff;
        border: none;
        border-radius: 20px;
        padding: 8px 20px;
        font-weight: 700;
        font-size: 15px;
        cursor: pointer;
        transition: background 0.2s;
      }

      .chat-send-btn:hover:not(:disabled) {
        background: #1a8cd8;
      }

      .chat-send-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      /* 个人资料页 */
      .profile-header {
        position: fixed;
        top: calc(60px + env(safe-area-inset-top));
        left: 0;
        right: 0;
        height: 53px;
        background: rgba(255, 255, 255, 0.85);
        backdrop-filter: blur(12px);
        border-bottom: 1px solid #eff3f4;
        display: flex;
        align-items: center;
        padding: 0 16px;
        gap: 24px;
        z-index: 100;
        max-width: 768px;
        margin: 0 auto;
      }

      .profile-back-btn {
        cursor: pointer;
        padding: 8px;
        color: #0f1419;
        border-radius: 50%;
        transition: background 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .profile-back-btn:hover {
        background: rgba(0, 0, 0, 0.03);
      }

      .profile-header-info {
        flex: 1;
      }

      .profile-header-name {
        font-size: 17px;
        font-weight: 700;
        color: #0f1419;
      }

      .profile-header-tweets {
        font-size: 13px;
        color: #536471;
      }

      .profile-content {
        padding-top: 53px;
      }

      .profile-banner {
        width: 100%;
        height: 200px;
        background: #cfd9de;
      }

      .profile-info {
        padding: 12px 16px;
        position: relative;
      }

      .profile-avatar {
        width: 134px;
        height: 134px;
        border-radius: 50%;
        border: 4px solid #ffffff;
        margin-top: -67px;
        background: #cfd9de;
      }

      .profile-edit-btn {
        position: absolute;
        top: 12px;
        right: 16px;
        background: transparent;
        color: #0f1419;
        border: 1px solid #cfd9de;
        border-radius: 20px;
        padding: 8px 16px;
        font-weight: 700;
        font-size: 15px;
        cursor: pointer;
        transition: background 0.2s;
      }

      .profile-edit-btn:hover {
        background: rgba(0, 0, 0, 0.03);
      }

      .profile-name {
        font-size: 20px;
        font-weight: 800;
        color: #0f1419;
        margin-top: 12px;
      }

      .profile-username {
        font-size: 15px;
        color: #536471;
        margin-bottom: 12px;
      }

      .profile-bio {
        font-size: 15px;
        color: #0f1419;
        margin-bottom: 12px;
        line-height: 20px;
      }

      .profile-joined {
        display: flex;
        align-items: center;
        gap: 4px;
        color: #536471;
        font-size: 15px;
        margin-bottom: 12px;
      }

      .profile-stats {
        display: flex;
        gap: 20px;
      }

      .profile-stat {
        display: flex;
        gap: 4px;
        cursor: pointer;
      }

      .profile-stat:hover .profile-stat-number {
        text-decoration: underline;
      }

      .profile-stat-number {
        font-weight: 700;
        color: #0f1419;
        font-size: 15px;
      }

      .profile-stat-label {
        color: #536471;
        font-size: 15px;
      }

      .profile-tabs {
        display: flex;
        border-bottom: 1px solid #eff3f4;
      }

      .profile-tab {
        flex: 1;
        text-align: center;
        padding: 16px;
        color: #536471;
        font-weight: 500;
        cursor: pointer;
        position: relative;
        transition: background 0.2s;
      }

      .profile-tab:hover {
        background: rgba(0, 0, 0, 0.03);
      }

      .profile-tab.active {
        color: #0f1419;
        font-weight: 700;
      }

      .profile-tab.active::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 50%;
        transform: translateX(-50%);
        width: 60px;
        height: 4px;
        background: #1d9bf0;
        border-radius: 2px;
      }

      .profile-tweets {
        width: 100%;
      }

      /* 设置页 */
      .settings-section {
        border-top: 1px solid #eff3f4;
        border-bottom: 1px solid #eff3f4;
      }

      .setting-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px;
        cursor: pointer;
        transition: background 0.2s;
        border-bottom: 1px solid #eff3f4;
      }

      .setting-item:last-child {
        border-bottom: none;
      }

      .setting-item:hover {
        background: rgba(0, 0, 0, 0.03);
      }

      .setting-item:active {
        background: rgba(0, 0, 0, 0.06);
      }

      .setting-info {
        flex: 1;
      }

      .setting-label {
        font-size: 15px;
        font-weight: 400;
        color: #0f1419;
      }

      .setting-description {
        font-size: 13px;
        color: #536471;
        margin-top: 2px;
      }

      .setting-value {
        font-size: 15px;
        color: #536471;
      }

      .setting-arrow {
        font-size: 24px;
        color: #536471;
        margin-left: 12px;
      }

      .setting-toggle {
        cursor: default;
      }

      .setting-toggle:hover {
        background: transparent;
      }

      .toggle-switch {
        position: relative;
        display: inline-block;
        width: 50px;
        height: 28px;
        cursor: pointer;
      }

      .toggle-switch input {
        opacity: 0;
        width: 0;
        height: 0;
      }

      .toggle-slider {
        position: absolute;
        cursor: pointer;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: #cfd9de;
        transition: 0.3s;
        border-radius: 28px;
      }

      .toggle-slider:before {
        position: absolute;
        content: "";
        height: 22px;
        width: 22px;
        left: 3px;
        bottom: 3px;
        background-color: white;
        transition: 0.3s;
        border-radius: 50%;
      }

      input:checked + .toggle-slider {
        background-color: #1d9bf0;
      }

      input:checked + .toggle-slider:before {
        transform: translateX(22px);
      }

      /* 响应式 */
      @media (max-width: 768px) {
        #twitter-app {
          max-width: 100%;
        }

        .mobile-top-bar,
        .mobile-bottom-nav,
        .detail-header,
        .detail-reply-input,
        .search-header,
        .chat-header,
        .chat-input-area,
        .profile-header {
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

    <!-- 左侧侧边栏 -->
    <div class="sidebar-overlay" id="sidebar-overlay"></div>
    <div class="sidebar-drawer" id="sidebar-drawer">
      <div class="sidebar-header">
        <img class="sidebar-user-avatar" id="sidebar-user-avatar" src="" alt="">
        <div class="sidebar-user-name" id="sidebar-user-name"></div>
        <div class="sidebar-user-username" id="sidebar-user-username"></div>
        <div class="sidebar-user-stats">
          <div class="sidebar-stat">
            <span class="sidebar-stat-number" id="sidebar-following">0</span>
            <span class="sidebar-stat-label">正在关注</span>
          </div>
          <div class="sidebar-stat">
            <span class="sidebar-stat-number" id="sidebar-followers">0</span>
            <span class="sidebar-stat-label">关注者</span>
          </div>
        </div>
      </div>
      <div class="sidebar-menu">
        <div class="sidebar-menu-item" data-menu="profile">
          <span>个人资料</span>
        </div>
        <div class="sidebar-menu-item" data-menu="premium">
          <span>Premium</span>
        </div>
        <div class="sidebar-menu-item" data-menu="communities">
          <span>社群</span>
        </div>
        <div class="sidebar-menu-item" data-menu="bookmarks">
          <span>书签</span>
        </div>
        <div class="sidebar-menu-item" data-menu="lists">
          <span>列表</span>
        </div>
        <div class="sidebar-menu-item" data-menu="spaces">
          <span>空间</span>
        </div>
        <div class="sidebar-menu-item" data-menu="creator">
          <span>创作者工作室</span>
        </div>
      </div>
      <div class="sidebar-divider"></div>
      <div class="sidebar-menu">
        <div class="sidebar-section-title">设置 & 支持</div>
        <div class="sidebar-menu-item" data-menu="settings">
          <span>设置和隐私</span>
        </div>
        <div class="sidebar-menu-item" data-menu="help">
          <span>帮助中心</span>
        </div>
      </div>
    </div>

    <!-- 顶部导航栏 -->
    <div class="mobile-top-bar">
      <img class="top-bar-avatar" id="top-bar-avatar" src="" alt="" title="打开侧边栏">
      <div class="top-bar-title">𝕏</div>
      <div class="top-bar-menu" id="top-bar-menu" title="菜单">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <circle cx="5" cy="12" r="2"></circle>
          <circle cx="12" cy="12" r="2"></circle>
          <circle cx="19" cy="12" r="2"></circle>
        </svg>
        <div class="top-bar-dropdown" id="top-bar-dropdown">
          <div class="top-bar-dropdown-item" id="dropdown-settings">设置</div>
          <div class="top-bar-dropdown-item" id="dropdown-exit">退出 Twitter</div>
        </div>
      </div>
    </div>

    <!-- 主内容区 -->
    <div class="mobile-main">
      <!-- 时间线视图 -->
      <div class="timeline-tabs" id="timeline-tabs">
        <div class="timeline-tab active" data-tab="recommended">为你推荐</div>
        <div class="timeline-tab" data-tab="following">正在关注</div>
      </div>
      <div class="timeline-content">
        <div class="tweets-list" id="tweets-list">
          <div class="empty-state">
            <div>还没有推文</div>
            <div style="margin-top: 8px; font-size: 14px;">发布你的第一条推文吧！</div>
          </div>
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
      <div class="bottom-nav-item compose-btn" data-nav="compose" title="发推文">${icons.plus}</div>
      <div class="bottom-nav-item" data-nav="notifications" title="通知">${icons.notifications}</div>
      <div class="bottom-nav-item" data-nav="messages" title="私信">${icons.messages}</div>
    </div>

    <!-- 搜索页 -->
    <div class="page-view" id="search-view">
      <!-- 搜索页顶部栏 -->
      <div class="search-top-bar">
        <div class="search-avatar-btn" id="search-avatar-btn">
          <img src="" alt="" id="search-avatar-img">
        </div>
        <div class="search-input-wrapper">
          ${icons.search}
          <input type="text" class="search-input" id="search-input" placeholder="搜索 X">
        </div>
        <div class="search-settings-btn" id="search-settings-btn">
          ${icons.settings}
        </div>
      </div>

      <!-- 搜索标签页 -->
      <div class="search-tabs-bar">
        <div class="search-tab active" data-search-tab="recommend">为你推荐</div>
        <div class="search-tab" data-search-tab="trending">当前趋势</div>
        <div class="search-tab" data-search-tab="news">新闻</div>
        <div class="search-tab" data-search-tab="sports">体育</div>
        <div class="search-tab" data-search-tab="entertainment">娱乐</div>
      </div>

      <!-- 搜索内容区 -->
      <div class="search-content" id="search-content-area">
        <!-- 搜索结果区域 -->
        <div id="search-results-section" style="display: none;">
          <h2 class="section-title">搜索结果</h2>
          <div id="search-results-list"></div>
        </div>

        <!-- 默认展示：推荐视频 + 趋势 -->
        <div id="search-default-section">
          <!-- 推荐视频卡片 -->
          <div style="position: relative; width: 100%; aspect-ratio: 16/9; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 16px; overflow: hidden; margin: 16px 0;">
            <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; color: white; font-size: 18px; font-weight: 700;">
              推荐视频内容
            </div>
            <div style="position: absolute; top: 12px; right: 12px; display: flex; gap: 8px;">
              <div style="width: 32px; height: 32px; border-radius: 50%; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; cursor: pointer;">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="white"><path d="M6 4v16l13-8-13-8z"></path></svg>
              </div>
              <div style="width: 32px; height: 32px; border-radius: 50%; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; cursor: pointer;">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="white"><path d="M3 12c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm9 0c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm9 0c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2z"></path></svg>
              </div>
            </div>
            <div style="position: absolute; bottom: 12px; left: 12px; right: 12px;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                <div style="width: 20px; height: 20px; background: rgba(255,255,255,0.3); border-radius: 4px;"></div>
                <span style="font-size: 13px; color: white;">由 示例账号 推荐</span>
              </div>
            </div>
          </div>

          <!-- 趋势列表 -->
          <div class="trends-section">
            <div class="trend-item" style="padding: 12px 16px; cursor: pointer; transition: background 0.2s;">
              <div style="display: flex; justify-content: space-between; align-items: start;">
                <div style="flex: 1;">
                  <div class="trend-category" style="font-size: 13px; color: #536471; margin-bottom: 2px;">日本的趋势</div>
                  <div class="trend-hashtag" style="font-size: 15px; font-weight: 700; color: #0f1419; margin-bottom: 2px;">ホームランダービー</div>
                  <div class="trend-count" style="font-size: 13px; color: #536471;"></div>
                </div>
                <div style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 50%; cursor: pointer; transition: background 0.2s;">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="#536471"><path d="M3 12c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm9 0c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm9 0c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2z"></path></svg>
                </div>
              </div>
            </div>
            <div class="trend-item" style="padding: 12px 16px; cursor: pointer; transition: background 0.2s;">
              <div style="display: flex; justify-content: space-between; align-items: start;">
                <div style="flex: 1;">
                  <div class="trend-category" style="font-size: 13px; color: #536471; margin-bottom: 2px;">日本的趋势</div>
                  <div class="trend-hashtag" style="font-size: 15px; font-weight: 700; color: #0f1419; margin-bottom: 2px;">イオンの会見</div>
                  <div class="trend-count" style="font-size: 13px; color: #536471;"></div>
                </div>
                <div style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 50%; cursor: pointer; transition: background 0.2s;">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="#536471"><path d="M3 12c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm9 0c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm9 0c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2z"></path></svg>
                </div>
              </div>
            </div>
            <div class="trend-item" style="padding: 12px 16px; cursor: pointer; transition: background 0.2s;">
              <div style="display: flex; justify-content: space-between; align-items: start;">
                <div style="flex: 1;">
                  <div class="trend-category" style="font-size: 13px; color: #536471; margin-bottom: 2px;">日本的趋势</div>
                  <div class="trend-hashtag" style="font-size: 15px; font-weight: 700; color: #0f1419; margin-bottom: 2px;">細川優勝</div>
                  <div class="trend-count" style="font-size: 13px; color: #536471;"></div>
                </div>
                <div style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 50%; cursor: pointer; transition: background 0.2s;">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="#536471"><path d="M3 12c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm9 0c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm9 0c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2z"></path></svg>
                </div>
              </div>
            </div>
            <div class="trend-item" style="padding: 12px 16px; cursor: pointer; transition: background 0.2s;">
              <div style="display: flex; justify-content: space-between; align-items: start;">
                <div style="flex: 1;">
                  <div class="trend-category" style="font-size: 13px; color: #536471; margin-bottom: 2px;">日本的趋势</div>
                  <div class="trend-hashtag" style="font-size: 15px; font-weight: 700; color: #0f1419; margin-bottom: 2px;">政治資金パーティー開催</div>
                  <div class="trend-count" style="font-size: 13px; color: #536471;"></div>
                </div>
                <div style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 50%; cursor: pointer; transition: background 0.2s;">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="#536471"><path d="M3 12c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm9 0c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm9 0c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2z"></path></svg>
                </div>
              </div>
            </div>
            <div class="trend-item" style="padding: 12px 16px; cursor: pointer; transition: background 0.2s;">
              <div style="display: flex; justify-content: space-between; align-items: start;">
                <div style="flex: 1;">
                  <div class="trend-category" style="font-size: 13px; color: #536471; margin-bottom: 2px;">日本的趋势</div>
                  <div class="trend-hashtag" style="font-size: 15px; font-weight: 700; color: #0f1419; margin-bottom: 2px;">自民福岡</div>
                  <div class="trend-count" style="font-size: 13px; color: #536471;"></div>
                </div>
                <div style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 50%; cursor: pointer; transition: background 0.2s;">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="#536471"><path d="M3 12c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm9 0c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm9 0c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2z"></path></svg>
                </div>
              </div>
            </div>
            <div class="trend-item" style="padding: 12px 16px; cursor: pointer; transition: background 0.2s;">
              <div style="display: flex; justify-content: space-between; align-items: start;">
                <div style="flex: 1;">
                  <div class="trend-category" style="font-size: 13px; color: #536471; margin-bottom: 2px;">娱乐 · 热门</div>
                  <div class="trend-hashtag" style="font-size: 15px; font-weight: 700; color: #0f1419; margin-bottom: 2px;">#gojimu</div>
                  <div class="trend-count" style="font-size: 13px; color: #536471;"></div>
                </div>
                <div style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 50%; cursor: pointer; transition: background 0.2s;">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="#536471"><path d="M3 12c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm9 0c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm9 0c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2z"></path></svg>
                </div>
              </div>
            </div>
          </div>

          <style>
            .trend-item:hover {
              background: rgba(0, 0, 0, 0.03);
            }
          </style>
        </div>
      </div>
    </div>

    <!-- 通知页 -->
    <div class="page-view" id="notifications-view">
      <!-- 通知页顶部栏 -->
      <div class="notifications-top-bar">
        <div class="notifications-top-left">
          <div class="notifications-avatar-btn" id="notifications-avatar-btn">
            <img src="" alt="" id="notifications-avatar-img">
          </div>
          <div class="notifications-title">通知</div>
        </div>
        <div class="notifications-settings-btn" id="notifications-settings-btn">
          ${icons.settings}
        </div>
      </div>

      <!-- 标签页 -->
      <div class="notifications-header">
        <div class="notifications-tabs">
          <div class="notifications-tab active" data-notif-tab="all">全部</div>
          <div class="notifications-tab" data-notif-tab="mentions">提及</div>
        </div>
      </div>

      <!-- 通知内容 -->
      <div class="notifications-content" id="notifications-list">
        <!-- 动态加载通知 -->
      </div>
    </div>

    <!-- 私信页 -->
    <div class="page-view" id="messages-view">
      <!-- 私信列表视图 -->
      <div class="messages-list-view" id="messages-list-view">
        <!-- 私信页顶部栏 -->
        <div class="messages-top-bar">
          <div class="messages-avatar-btn" id="messages-avatar-btn">
            <img src="" alt="" id="messages-avatar-img">
          </div>
          <div class="messages-title">聊天</div>
          <div class="messages-filter-btn" id="messages-filter-btn">
            <span>全部</span>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M3.543 8.96l1.414-1.42L12 14.59l7.043-7.05 1.414 1.42L12 17.41 3.543 8.96z"></path></svg>
          </div>
        </div>

        <!-- 搜索框 -->
        <div class="messages-search-bar">
          <div class="messages-search-wrapper">
            ${icons.search}
            <input type="text" class="messages-search-input" placeholder="搜索">
          </div>
        </div>

        <!-- 私信内容 -->
        <div class="messages-content" id="messages-content">
          <!-- 欢迎界面（无对话时显示） -->
          <div class="messages-welcome" id="messages-welcome">
            <div class="messages-welcome-title">欢迎来到你的收件箱！</div>
            <div class="messages-welcome-desc">在 X 上和别人进行私密对话，大家互发私信、分享帖子等。</div>
            <button class="messages-write-btn" id="messages-write-btn">写一封私信</button>
          </div>

          <!-- 对话列表（有对话时显示） -->
          <div class="messages-list" id="messages-list" style="display: none;">
            <!-- 动态加载对话列表 -->
          </div>
        </div>

        <!-- 浮动新建私信按钮 -->
        <div class="messages-fab" id="messages-fab">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="white">
            <path d="M1.998 5.5c0-1.381 1.119-2.5 2.5-2.5h15c1.381 0 2.5 1.119 2.5 2.5v13c0 1.381-1.119 2.5-2.5 2.5h-15c-1.381 0-2.5-1.119-2.5-2.5v-13zm2.5-.5c-.276 0-.5.224-.5.5v.511l8.5 5.312 8.5-5.312v-.511c0-.276-.224-.5-.5-.5h-15zm-.5 2.49v10.51c0 .276.224.5.5.5h15c.276 0 .5-.224.5-.5v-10.51l-7.928 4.954c-.32.2-.73.2-1.05 0l-7.928-4.955z"></path>
          </svg>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="white" style="position: absolute; right: 8px; bottom: 8px; background: #1d9bf0; border-radius: 50%; padding: 2px;">
            <path d="M13 7h-2v4H7v2h4v4h2v-4h4v-2h-4V7zm-1-5C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"></path>
          </svg>
        </div>
      </div>

      <!-- 聊天视图 -->
      <div class="chat-view" id="chat-view">
        <div class="chat-header">
          <div class="chat-back-btn" id="chat-back-btn">${icons.back}</div>
          <div class="chat-user-info">
            <div class="chat-user-name" id="chat-user-name"></div>
          </div>
          <div class="chat-settings-btn">${icons.settings}</div>
        </div>
        <div class="chat-messages" id="chat-messages">
          <!-- 动态加载消息 -->
        </div>
        <div class="chat-input-area">
          <input type="text" class="chat-input" id="chat-input" placeholder="发送私信">
          <button class="chat-send-btn" id="chat-send-btn" disabled>发送</button>
        </div>
      </div>
    </div>

    <!-- 设置页 -->
    <div class="page-view" id="settings-view">
      <div class="profile-header">
        <div class="profile-back-btn" id="settings-back-btn">${icons.back}</div>
        <div class="profile-header-info">
          <div class="profile-header-name">设置</div>
        </div>
      </div>
      <div class="profile-content">
        <h2 class="section-title">账号设置</h2>
        <div class="settings-section">
          <div class="setting-item" id="setting-edit-profile">
            <div class="setting-label">编辑个人资料</div>
            <div class="setting-arrow">›</div>
          </div>
          <div class="setting-item" id="setting-privacy">
            <div class="setting-label">设置和隐私</div>
            <div class="setting-arrow">›</div>
          </div>
          <div class="setting-item" id="setting-notifications">
            <div class="setting-label">通知</div>
            <div class="setting-arrow">›</div>
          </div>
        </div>

        <h2 class="section-title" style="margin-top: 20px;">记忆设置</h2>
        <div class="settings-section">
          <div class="setting-item setting-toggle">
            <div class="setting-info">
              <div class="setting-label">启用推文记忆</div>
              <div class="setting-description">自动保存推文到记忆系统</div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" id="toggle-memory" checked>
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="setting-item setting-toggle">
            <div class="setting-info">
              <div class="setting-label">自动总结对话</div>
              <div class="setting-description">使用 AI 自动总结推文对话</div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" id="toggle-summary" checked>
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="setting-item">
            <div class="setting-label">记忆保存到</div>
            <div class="setting-value" id="memory-target-value">当前会话</div>
          </div>
          <div class="setting-item" id="setting-clear-memory">
            <div class="setting-label" style="color: #f4212e;">清除所有记忆</div>
            <div class="setting-arrow">›</div>
          </div>
        </div>

        <h2 class="section-title" style="margin-top: 20px;">关于</h2>
        <div class="settings-section">
          <div class="setting-item">
            <div class="setting-label">版本</div>
            <div class="setting-value">v2.0.0</div>
          </div>
          <div class="setting-item" id="setting-about">
            <div class="setting-label">关于 Twitter 插件</div>
            <div class="setting-arrow">›</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 个人资料页 -->
    <div class="page-view" id="profile-view">
      <div class="profile-header">
        <div class="profile-back-btn" id="profile-back-btn">${icons.back}</div>
        <div class="profile-header-info">
          <div class="profile-header-name" id="profile-header-name"></div>
          <div class="profile-header-tweets" id="profile-header-tweets"></div>
        </div>
      </div>
      <div class="profile-content">
        <div class="profile-banner"></div>
        <div class="profile-info">
          <img class="profile-avatar" id="profile-avatar" src="" alt="">
          <button class="profile-edit-btn" id="profile-action-btn"></button>
          <div class="profile-name" id="profile-name"></div>
          <div class="profile-username" id="profile-username"></div>
          <div class="profile-bio" id="profile-bio"></div>
          <div class="profile-joined">
            ${icons.calendar}
            <span id="profile-joined"></span>
          </div>
          <div class="profile-stats">
            <div class="profile-stat">
              <span class="profile-stat-number" id="profile-following">0</span>
              <span class="profile-stat-label">正在关注</span>
            </div>
            <div class="profile-stat">
              <span class="profile-stat-number" id="profile-followers">0</span>
              <span class="profile-stat-label">关注者</span>
            </div>
          </div>
        </div>
        <div class="profile-tabs">
          <div class="profile-tab active" data-tab="tweets">推文</div>
          <div class="profile-tab" data-tab="replies">回复</div>
          <div class="profile-tab" data-tab="media">媒体</div>
          <div class="profile-tab" data-tab="likes">喜欢</div>
        </div>
        <div class="profile-tweets" id="profile-tweets-list">
          <!-- 动态加载用户推文 -->
        </div>
      </div>
    </div>

    <!-- 设置和隐私页 -->
    <div class="page-view" id="privacy-settings-view">
      <div class="profile-header">
        <div class="profile-back-btn" id="privacy-settings-back-btn">${icons.back}</div>
        <div class="profile-header-info">
          <div class="profile-header-name">设置和隐私</div>
        </div>
      </div>
      <div class="profile-content">
        <h2 class="section-title">你的账号</h2>
        <div class="settings-section">
          <div class="setting-item" id="setting-account-info">
            <div class="setting-label">账号信息</div>
            <div class="setting-arrow">›</div>
          </div>
          <div class="setting-item" id="setting-switch-account">
            <div class="setting-label">切换账号</div>
            <div class="setting-arrow">›</div>
          </div>
          <div class="setting-item" id="setting-deactivate-account">
            <div class="setting-label">停用你的账号</div>
            <div class="setting-arrow">›</div>
          </div>
        </div>

        <h2 class="section-title" style="margin-top: 20px;">数据共享和个性化</h2>
        <div class="settings-section">
          <div class="setting-item" id="setting-ad-preferences">
            <div class="setting-label">广告偏好设置</div>
            <div class="setting-arrow">›</div>
          </div>
          <div class="setting-item" id="setting-data-sharing">
            <div class="setting-label">数据共享</div>
            <div class="setting-arrow">›</div>
          </div>
        </div>

        <h2 class="section-title" style="margin-top: 20px;">安全</h2>
        <div class="settings-section">
          <div class="setting-item" id="setting-security">
            <div class="setting-label">安全性</div>
            <div class="setting-arrow">›</div>
          </div>
          <div class="setting-item" id="setting-password">
            <div class="setting-label">密码</div>
            <div class="setting-arrow">›</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 切换账号页 -->
    <div class="page-view" id="switch-account-view">
      <div class="profile-header">
        <div class="profile-back-btn" id="switch-account-back-btn">${icons.back}</div>
        <div class="profile-header-info">
          <div class="profile-header-name">切换账号</div>
        </div>
      </div>
      <div class="profile-content">
        <h2 class="section-title">当前账号</h2>
        <div class="settings-section" id="current-account-section">
          <!-- 动态加载当前账号 -->
        </div>

        <h2 class="section-title" style="margin-top: 20px;">其他账号</h2>
        <div class="settings-section" id="other-accounts-section">
          <!-- 动态加载其他账号 -->
        </div>

        <div style="padding: 16px;">
          <button class="compose-btn" id="add-account-btn" style="width: 100%; padding: 12px;">
            ${icons.plus} 刷新账号列表
          </button>
        </div>
      </div>
    </div>

    <!-- 关注列表页 -->
    <div class="page-view" id="following-list-view">
      <div class="profile-header">
        <div class="profile-back-btn" id="following-list-back-btn">${icons.back}</div>
        <div class="profile-header-info">
          <div class="profile-header-name">正在关注</div>
        </div>
      </div>
      <div class="profile-content">
        <div id="following-list-content">
          <!-- 动态加载关注列表 -->
        </div>
      </div>
    </div>

    <!-- 粉丝列表页 -->
    <div class="page-view" id="followers-list-view">
      <div class="profile-header">
        <div class="profile-back-btn" id="followers-list-back-btn">${icons.back}</div>
        <div class="profile-header-info">
          <div class="profile-header-name">关注者</div>
        </div>
      </div>
      <div class="profile-content">
        <div id="followers-list-content">
          <!-- 动态加载粉丝列表 -->
        </div>
      </div>
    </div>
  `;

  container.replaceChildren();
  container.appendChild(appDiv);

  // 初始化数据结构
  initializeNotifications();
  initializeMessages();

  // 绑定事件
  bindEvents(container, roche);

  // 更新当前用户显示
  updateCurrentUserDisplay();

  // 渲染推文列表
  renderTweets(roche);
}

/**
 * 初始化通知数据
 */
function initializeNotifications() {
  if (!twitterData.notifications) {
    twitterData.notifications = [];
  }
  if (!twitterData.notificationFilter) {
    twitterData.notificationFilter = 'all'; // 'all' 或 'mentions'
  }
}

/**
 * 初始化私信数据
 */
function initializeMessages() {
  if (!twitterData.conversations) {
    twitterData.conversations = {};
  }
}

/**
 * 绑定事件处理 - 移动端
 */
function bindEvents(container, roche) {
  // 顶部菜单按钮
  document.getElementById('top-bar-menu').addEventListener('click', (e) => {
    e.stopPropagation();
    const dropdown = document.getElementById('top-bar-dropdown');
    if (dropdown) {
      dropdown.classList.toggle('active');
    }
  });

  // 点击页面其他地方关闭下拉菜单
  document.addEventListener('click', () => {
    const dropdown = document.getElementById('top-bar-dropdown');
    if (dropdown && dropdown.classList.contains('active')) {
      dropdown.classList.remove('active');
    }
  });

  // 下拉菜单 - 设置
  document.getElementById('dropdown-settings').addEventListener('click', () => {
    showSettings(roche);
  });

  // 下拉菜单 - 退出
  document.getElementById('dropdown-exit').addEventListener('click', () => {
    exitApp(container, roche);
    // 关闭下拉菜单
    const dropdown = document.getElementById('top-bar-dropdown');
    if (dropdown && dropdown.classList.contains('active')) {
      dropdown.classList.remove('active');
    }
  });

  // 顶部头像点击 - 打开侧边栏
  document.getElementById('top-bar-avatar').addEventListener('click', () => {
    showSidebar(roche);
  });

  // 侧边栏遮罩层点击 - 关闭侧边栏
  document.getElementById('sidebar-overlay').addEventListener('click', () => {
    closeSidebar();
  });

  // 侧边栏菜单项点击
  document.querySelectorAll('.sidebar-menu-item').forEach(item => {
    item.addEventListener('click', () => {
      const menu = item.dataset.menu;
      handleSidebarMenu(menu, roche);
    });
  });

  // 主页标签切换
  document.querySelectorAll('.timeline-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.timeline-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const tabType = tab.dataset.tab;
      renderTweets(roche, tabType);
    });
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
      } else if (nav === 'search') {
        switchView('search');
        renderSearch(roche);
      } else if (nav === 'notifications') {
        switchView('notifications');
        renderNotifications(roche);
      } else if (nav === 'messages') {
        switchView('messages');
        renderMessages(roche);
      }
    });
  });

  // 个人资料页返回按钮
  document.getElementById('profile-back-btn').addEventListener('click', () => {
    switchView('timeline');
  });

  // 通知页标签切换
  document.querySelectorAll('.notifications-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.notifications-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const tabType = tab.dataset.notifTab;
      twitterData.notificationFilter = tabType;
      renderNotifications(roche);
    });
  });

  // 聊天页返回按钮
  document.getElementById('chat-back-btn').addEventListener('click', () => {
    const chatView = document.getElementById('chat-view');
    const messagesListView = document.getElementById('messages-list-view');
    if (chatView) {
      chatView.classList.remove('active');
    }
    if (messagesListView) {
      messagesListView.classList.remove('hidden');
    }
  });

  // 聊天输入
  const chatInput = document.getElementById('chat-input');
  const chatSendBtn = document.getElementById('chat-send-btn');

  chatInput.addEventListener('input', () => {
    chatSendBtn.disabled = chatInput.value.trim().length === 0;
  });

  chatSendBtn.addEventListener('click', () => {
    sendMessage(roche, chatInput.value.trim());
    chatInput.value = '';
    chatSendBtn.disabled = true;
  });

  // 搜索框事件
  const searchInput = document.getElementById('search-input');
  let searchTimeout = null;

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.trim();

      // 清除之前的定时器
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }

      // 如果搜索框为空，显示默认内容
      if (!query) {
        document.getElementById('search-results-section').style.display = 'none';
        document.getElementById('search-default-section').style.display = 'block';
        return;
      }

      // 防抖：延迟 500ms 后执行搜索
      searchTimeout = setTimeout(() => {
        performSearch(query, roche);
      }, 500);
    });

    // 按下回车直接搜索
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const query = e.target.value.trim();
        if (query) {
          if (searchTimeout) {
            clearTimeout(searchTimeout);
          }
          performSearch(query, roche);
        }
      }
    });
  }
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
 * 打开侧边栏
 */
function openSidebar(roche) {
  const user = twitterData.users[currentUser];
  if (!user) return;

  // 更新当前用户信息
  const sidebarAvatar = document.getElementById('sidebar-user-avatar');
  const sidebarName = document.getElementById('sidebar-user-name');
  const sidebarUsername = document.getElementById('sidebar-user-username');
  const sidebarFollowing = document.getElementById('sidebar-following');
  const sidebarFollowers = document.getElementById('sidebar-followers');

  if (sidebarAvatar) sidebarAvatar.src = user.avatar;
  if (sidebarName) sidebarName.textContent = user.name;
  if (sidebarUsername) sidebarUsername.textContent = user.username;
  if (sidebarFollowing) sidebarFollowing.textContent = user.following || 0;
  if (sidebarFollowers) sidebarFollowers.textContent = user.followers || 0;

  // 绑定粉丝和关注的点击事件
  const followingStatDiv = sidebarFollowing?.closest('.sidebar-stat');
  const followersStatDiv = sidebarFollowers?.closest('.sidebar-stat');

  if (followingStatDiv) {
    followingStatDiv.replaceWith(followingStatDiv.cloneNode(true));
    const newFollowingStat = sidebarFollowing.closest('.sidebar-stat');
    newFollowingStat.addEventListener('click', () => {
      closeSidebar();
      showFollowingList(currentUser, roche);
    });
  }

  if (followersStatDiv) {
    followersStatDiv.replaceWith(followersStatDiv.cloneNode(true));
    const newFollowersStat = sidebarFollowers.closest('.sidebar-stat');
    newFollowersStat.addEventListener('click', () => {
      closeSidebar();
      showFollowersList(currentUser, roche);
    });
  }

  // 显示侧边栏
  const overlay = document.getElementById('sidebar-overlay');
  const drawer = document.getElementById('sidebar-drawer');
  if (overlay) {
    overlay.classList.add('active');
  }
  if (drawer) {
    drawer.classList.add('active');
  }
}

/**
 * 关闭侧边栏
 */
function closeSidebar() {
  const overlay = document.getElementById('sidebar-overlay');
  const drawer = document.getElementById('sidebar-drawer');
  if (overlay) {
    overlay.classList.remove('active');
  }
  if (drawer) {
    drawer.classList.remove('active');
  }
}

/**
 * 切换面具（切换当前用户）
 */
async function switchPersona(personaId, roche) {
  const persona = twitterData.users[personaId];
  if (!persona) {
    showToast('找不到该账号', 'error');
    return;
  }

  try {
    // 调用 Roche API 切换 Persona（如果有 conversationId）
    if (persona.conversationId) {
      console.log('[Twitter] 正在切换 Persona...', personaId);
      await roche.persona.setActiveUserPersona(personaId);
      console.log('[Twitter] Persona 切换成功');
    }

    // 更新本地当前用户
    currentUser = personaId;

    // 初始化关注关系（如果不存在）
    if (!twitterData.follows[currentUser]) {
      twitterData.follows[currentUser] = [];
    }

    await saveData(roche);

    // 更新界面
    updateCurrentUserDisplay();
    closeSidebar();
    renderTweets(roche);

    showToast(`已切换到 ${persona.name}`, 'success');
  } catch (error) {
    console.error('[Twitter] 切换 Persona 失败:', error);
    showToast('切换账号失败: ' + error.message, 'error');
  }
}

/**
 * 处理侧边栏菜单点击
 */
function handleSidebarMenu(menu, roche) {
  closeSidebar();

  switch (menu) {
    case 'profile':
      showProfile(currentUser, roche);
      break;
    case 'settings':
      // 侧边栏的"设置和隐私"直接进入切换账号页面
      showSwitchAccount(roche);
      break;
    case 'premium':
    case 'communities':
    case 'bookmarks':
    case 'lists':
    case 'spaces':
    case 'creator':
    case 'help':
      showToast('功能开发中...', 'info');
      break;
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
 * 获取新闻推文（预留 MCP 接口）
 * TODO: 接入真实新闻 API
 * 可选方案：
 * 1. roche.mcp.fetchNews() - 如果 Roche 提供 MCP
 * 2. WebFetch + RSS 源
 * 3. NewsAPI.org
 * 4. 自定义新闻爬虫
 */
async function fetchNewsTweets(roche) {
  // 预留：之后接入 MCP 或 NewsAPI
  // const news = await roche.mcp?.fetchNews?.();

  // 模拟新闻数据（占位）
  const mockNews = [
    {
      id: 'news_1',
      userId: 'news_bot',
      content: '【科技】OpenAI 发布最新 GPT-5 模型，性能提升 40%，支持多模态理解和生成。#AI #科技新闻',
      timestamp: Date.now() - 3600000,
      source: '科技日报',
      category: 'tech',
      isNews: true,
      likes: [],
      retweets: [],
      replies: []
    },
    {
      id: 'news_2',
      userId: 'news_bot',
      content: '【财经】全球股市今日普遍上涨，科技股领涨，纳斯达克指数上涨 2.3%。#财经 #股市',
      timestamp: Date.now() - 7200000,
      source: '财经周刊',
      category: 'finance',
      isNews: true,
      likes: [],
      retweets: [],
      replies: []
    },
    {
      id: 'news_3',
      userId: 'news_bot',
      content: '【体育】NBA 总决赛第三场，湖人队主场以 108-102 战胜凯尔特人队，大比分 2-1 领先。#NBA #体育',
      timestamp: Date.now() - 10800000,
      source: '体育周报',
      category: 'sports',
      isNews: true,
      likes: [],
      retweets: [],
      replies: []
    }
  ];

  // 创建新闻机器人用户（如果不存在）
  if (!twitterData.users['news_bot']) {
    twitterData.users['news_bot'] = {
      id: 'news_bot',
      name: '新闻机器人',
      username: '@news_bot',
      avatar: generateAvatar('新闻'),
      bio: '为你推送最新资讯',
      followers: 0,
      following: 0,
      isPersona: false,
      isBot: true
    };
  }

  return mockNews;
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

  // 保存到记忆系统
  await saveTweetToMemory(tweet, roche);

  renderTweets(roche);

  showToast('推文已发布！', 'success');
}

/**
 * 渲染推文列表
 * @param {Object} roche - Roche API 对象
 * @param {string} filter - 过滤类型: 'recommended' (为你推荐) 或 'following' (正在关注)
 */
async function renderTweets(roche, filter = 'recommended') {
  const listEl = document.getElementById('tweets-list');

  // 根据过滤条件筛选推文
  let filteredTweets = twitterData.tweets;

  if (filter === 'following') {
    // 只显示关注用户的推文
    const following = twitterData.follows[currentUser] || [];
    filteredTweets = twitterData.tweets.filter(tweet =>
      following.includes(tweet.userId) || tweet.userId === currentUser
    );
  } else if (filter === 'recommended') {
    // "为你推荐" 标签：混合显示用户推文和新闻推文
    const newsTweets = await fetchNewsTweets(roche);

    // 将新闻推文与普通推文混合（新闻推文插入到列表中）
    filteredTweets = [...twitterData.tweets];

    // 每隔几条推文插入一条新闻
    const mergedTweets = [];
    let newsIndex = 0;
    filteredTweets.forEach((tweet, index) => {
      mergedTweets.push(tweet);
      // 每 3 条推文插入一条新闻
      if ((index + 1) % 3 === 0 && newsIndex < newsTweets.length) {
        mergedTweets.push(newsTweets[newsIndex]);
        newsIndex++;
      }
    });

    // 如果还有剩余新闻，添加到开头
    while (newsIndex < newsTweets.length) {
      mergedTweets.unshift(newsTweets[newsIndex]);
      newsIndex++;
    }

    filteredTweets = mergedTweets;
  }

  if (filteredTweets.length === 0) {
    const emptyMessage = filter === 'following'
      ? '关注一些用户来查看他们的推文'
      : '还没有推文';
    listEl.innerHTML = `
      <div class="empty-state">
        <div>${emptyMessage}</div>
        <div style="margin-top: 8px; font-size: 14px;">发布你的第一条推文吧！</div>
      </div>
    `;
    return;
  }

  listEl.innerHTML = filteredTweets.map(tweet => {
    const user = twitterData.users[tweet.userId];
    const isLiked = tweet.likes.includes(currentUser);
    const isRetweeted = tweet.retweets.includes(currentUser);
    const timeAgo = getTimeAgo(tweet.timestamp);

    // 新闻推文特殊样式
    const newsLabel = tweet.isNews ? `<span style="display: inline-block; background: #1d9bf0; color: white; font-size: 11px; padding: 2px 6px; border-radius: 4px; margin-left: 4px; font-weight: 700;">新闻</span>` : '';
    const sourceLabel = tweet.source ? `<span style="color: #536471; font-size: 13px; margin-left: 4px;">· 来源: ${tweet.source}</span>` : '';

    return `
      <div class="tweet-item" data-tweet-id="${tweet.id}" ${tweet.isNews ? 'data-is-news="true"' : ''}>
        <div class="tweet-header">
          <img class="tweet-avatar" src="${user.avatar}" alt="">
          <div class="tweet-content">
            <div class="tweet-author">
              <span class="tweet-author-name">${user.name}${newsLabel}</span>
              <span class="tweet-author-username">${user.username}</span>
              <span class="tweet-time">· ${timeAgo}</span>
              ${sourceLabel}
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

      const tweetId = el.dataset.tweetId;
      const isNews = el.dataset.isNews === 'true';

      if (isNews) {
        // 新闻推文也支持详情页
        showNewsTweetDetail(tweetId, roche);
      } else {
        showTweetDetail(parseInt(tweetId), roche);
      }
    });
  });

  // 绑定推文操作事件
  listEl.querySelectorAll('.tweet-action').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = el.dataset.action;
      const tweetItem = el.closest('.tweet-item');
      const tweetId = tweetItem.dataset.tweetId;
      const isNews = tweetItem.dataset.isNews === 'true';

      if (isNews) {
        // 新闻推文的操作（简化版）
        handleNewsTweetAction(action, tweetId, roche);
      } else {
        handleTweetAction(action, parseInt(tweetId), roche);
      }
    });
  });
}

/**
 * 切换视图
 */
function switchView(view) {
  currentView = view;

  const timelineView = document.querySelector('.timeline-content');
  const timelineTabs = document.getElementById('timeline-tabs');
  const detailView = document.getElementById('tweet-detail-view');
  const searchView = document.getElementById('search-view');
  const notificationsView = document.getElementById('notifications-view');
  const messagesView = document.getElementById('messages-view');
  const profileView = document.getElementById('profile-view');
  const settingsView = document.getElementById('settings-view');
  const privacySettingsView = document.getElementById('privacy-settings-view');
  const switchAccountView = document.getElementById('switch-account-view');
  const followingListView = document.getElementById('following-list-view');
  const followersListView = document.getElementById('followers-list-view');
  const topBar = document.querySelector('.mobile-top-bar');

  // 隐藏所有视图
  if (timelineView) timelineView.style.display = 'none';
  if (timelineTabs) timelineTabs.style.display = 'none';
  if (detailView) detailView.classList.remove('active');
  if (searchView) searchView.classList.remove('active');
  if (notificationsView) notificationsView.classList.remove('active');
  if (messagesView) messagesView.classList.remove('active');
  if (profileView) profileView.classList.remove('active');
  if (settingsView) settingsView.classList.remove('active');
  if (privacySettingsView) privacySettingsView.classList.remove('active');
  if (switchAccountView) switchAccountView.classList.remove('active');
  if (followingListView) followingListView.classList.remove('active');
  if (followersListView) followersListView.classList.remove('active');

  if (view === 'timeline') {
    // 显示时间线
    if (timelineView) timelineView.style.display = 'block';
    if (timelineTabs) timelineTabs.style.display = 'flex';
    if (topBar) topBar.style.display = 'flex';

    // 重置底部导航
    document.querySelectorAll('.bottom-nav-item').forEach(i => i.classList.remove('active'));
    const homeNav = document.querySelector('[data-nav="home"]');
    if (homeNav) homeNav.classList.add('active');
  } else if (view === 'tweetDetail') {
    // 显示详情页
    if (detailView) detailView.classList.add('active');
    if (topBar) topBar.style.display = 'none';
  } else if (view === 'search') {
    // 显示搜索页
    if (searchView) searchView.classList.add('active');
    if (topBar) topBar.style.display = 'none'; // 隐藏全局顶部栏
  } else if (view === 'notifications') {
    // 显示通知页
    if (notificationsView) notificationsView.classList.add('active');
    if (topBar) topBar.style.display = 'none'; // 隐藏全局顶部栏
  } else if (view === 'messages') {
    // 显示私信页
    if (messagesView) messagesView.classList.add('active');
    if (topBar) topBar.style.display = 'none'; // 隐藏全局顶部栏
  } else if (view === 'profile') {
    // 显示个人资料页
    if (profileView) profileView.classList.add('active');
    if (topBar) topBar.style.display = 'none'; // 隐藏全局顶部栏
  } else if (view === 'settings') {
    // 显示设置页
    if (settingsView) settingsView.classList.add('active');
    if (topBar) topBar.style.display = 'none'; // 隐藏全局顶部栏
  } else if (view === 'privacySettings') {
    // 显示设置和隐私页
    if (privacySettingsView) privacySettingsView.classList.add('active');
    if (topBar) topBar.style.display = 'none'; // 隐藏全局顶部栏
  } else if (view === 'switchAccount') {
    // 显示切换账号页
    if (switchAccountView) switchAccountView.classList.add('active');
    if (topBar) topBar.style.display = 'none'; // 隐藏全局顶部栏
  } else if (view === 'followingList') {
    // 显示关注列表页
    if (followingListView) followingListView.classList.add('active');
    if (topBar) topBar.style.display = 'none'; // 隐藏全局顶部栏
  } else if (view === 'followersList') {
    // 显示粉丝列表页
    if (followersListView) followersListView.classList.add('active');
    if (topBar) topBar.style.display = 'none'; // 隐藏全局顶部栏
  }
}

/**
 * 显示推文详情
 */
function showTweetDetail(tweetId, roche) {
  console.log('[Twitter] showTweetDetail called, tweetId:', tweetId);

  const tweet = twitterData.tweets.find(t => t.id === tweetId);
  if (!tweet) {
    console.error('[Twitter] Tweet not found:', tweetId);
    showToast('推文不存在', 'error');
    return;
  }

  console.log('[Twitter] Found tweet:', tweet);
  currentTweetId = tweetId;
  const user = twitterData.users[tweet.userId];
  const currentUserData = twitterData.users[currentUser];
  const isLiked = tweet.likes.includes(currentUser);
  const isRetweeted = tweet.retweets.includes(currentUser);
  const isFollowing = twitterData.follows[currentUser]?.includes(user.id);
  const isSelf = user.id === currentUser;
  const isBookmarked = twitterData.bookmarks?.[currentUser]?.includes(tweetId) || false;

  // 格式化时间 - Twitter 格式：26年7月29日, 4:00 下午
  const date = new Date(tweet.timestamp);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? '下午' : '上午';
  const displayHours = hours % 12 || 12;
  const year = date.getFullYear() % 100; // 26 而不是 2026
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const formattedDateTime = `${year}年${month}月${day}日, ${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;

  // 模拟查看数
  const viewCount = Math.floor(Math.random() * 500) + 100;

  // 渲染详情内容
  const detailMain = document.getElementById('detail-main');
  detailMain.innerHTML = `
    <div class="detail-tweet">
      <!-- 用户信息区 -->
      <div class="detail-user-section">
        <div class="detail-user-header">
          <img class="detail-tweet-avatar" src="${user.avatar}" alt="">
          <div class="detail-user-info">
            <div class="detail-tweet-name">${user.name}</div>
            <div class="detail-tweet-username">${user.username}</div>
          </div>
          ${!isSelf ? `
            <button class="detail-follow-btn ${isFollowing ? 'following' : ''}" id="detail-follow-btn">
              <span>${isFollowing ? '正在关注' : '关注'}</span>
            </button>
          ` : ''}
        </div>
        <div class="detail-translate-link" id="translate-link">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#1d9bf0"><path d="M12.87 2.27c-.5-.5-1.29-.5-1.79 0l-6.36 6.37c-.5.5-.5 1.29 0 1.79l1.41 1.41c.5.5 1.29.5 1.79 0L10 9.77V18c0 .55.45 1 1 1s1-.45 1-1V9.77l2.09 2.09c.5.5 1.29.5 1.79 0l1.41-1.41c.5-.5.5-1.29 0-1.79l-6.36-6.37z"></path></svg>
          <span style="color: #1d9bf0; font-size: 15px;">显示翻译</span>
        </div>
      </div>

      <!-- 推文内容 -->
      <div class="detail-tweet-content" id="detail-tweet-content">
        ${escapeHtml(tweet.content)}
      </div>

      <!-- 翻译内容（隐藏） -->
      <div class="detail-tweet-translation" id="detail-tweet-translation" style="display: none; padding: 16px; background: #f7f9f9; border-radius: 12px; margin-top: 12px; color: #536471; font-size: 15px;">
        正在翻译...
      </div>

      <!-- 时间和查看数 -->
      <div class="detail-tweet-time">
        <span style="color: #536471;">${formattedDateTime}</span>
        <span style="color: #536471; margin: 0 4px;">·</span>
        <span style="font-weight: 700; color: #0f1419;">${viewCount}</span>
        <span style="color: #536471;"> 查看</span>
      </div>

      <!-- 只显示喜欢数 -->
      <div class="detail-tweet-likes">
        <span style="font-weight: 700; color: #0f1419;">${tweet.likes.length}</span>
        <span style="color: #536471; margin-left: 4px;">喜欢</span>
      </div>

      <!-- 操作按钮 -->
      <div class="detail-action-bar">
        <div class="detail-action-icon" data-action="reply">
          ${icons.comment}
        </div>
        <div class="detail-action-icon ${isRetweeted ? 'retweeted' : ''}" data-action="retweet">
          ${icons.retweet}
        </div>
        <div class="detail-action-icon ${isLiked ? 'liked' : ''}" data-action="like">
          ${isLiked ? icons.likeFilled : icons.like}
        </div>
        <div class="detail-action-icon ${isBookmarked ? 'bookmarked' : ''}" data-action="bookmark">
          ${isBookmarked
            ? '<svg viewBox="0 0 24 24" width="20" height="20" fill="#1d9bf0"><path d="M4 4.5C4 3.12 5.119 2 6.5 2h11C18.881 2 20 3.12 20 4.5v18.44l-8-5.71-8 5.71V4.5z"></path></svg>'
            : '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M4 4.5C4 3.12 5.119 2 6.5 2h11C18.881 2 20 3.12 20 4.5v18.44l-8-5.71-8 5.71V4.5zM6.5 4c-.276 0-.5.224-.5.5v14.56l6-4.29 6 4.29V4.5c0-.276-.224-.5-.5-.5h-11z"></path></svg>'}
        </div>
        <div class="detail-action-icon" data-action="share">
          ${icons.share}
        </div>
      </div>

      <!-- 回复排序 -->
      <div class="detail-replies-header">
        <span style="font-weight: 700; font-size: 15px;">最相关的回复</span>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="#536471"><path d="M3.543 8.96l1.414-1.42L12 14.59l7.043-7.05 1.414 1.42L12 17.41 3.543 8.96z"></path></svg>
      </div>

      <!-- 发现更多 -->
      <div class="detail-discover-more">
        <div style="font-weight: 700; font-size: 20px; color: #0f1419;">发现更多</div>
      </div>

      <!-- 来源标签 -->
      <div class="detail-source-label">
        <span style="color: #536471; font-size: 13px;">源自于整个 X</span>
      </div>

      <!-- 回复列表 -->
      <div class="detail-replies" id="detail-replies">
        ${tweet.replies.length === 0 ? '<div style="padding: 40px 20px; text-align: center; color: #536471;">暂无回复</div>' : ''}
      </div>
    </div>
  `;

  // 更新回复输入框头像
  document.getElementById('detail-reply-avatar').src = currentUserData.avatar;

  // 绑定翻译按钮
  const translateLink = document.getElementById('translate-link');
  const translationDiv = document.getElementById('detail-tweet-translation');
  const contentDiv = document.getElementById('detail-tweet-content');
  let isTranslated = false;

  if (translateLink) {
    translateLink.addEventListener('click', async () => {
      if (isTranslated) {
        // 隐藏翻译
        translationDiv.style.display = 'none';
        translateLink.querySelector('span').textContent = '显示翻译';
        isTranslated = false;
      } else {
        // 显示翻译
        translationDiv.style.display = 'block';
        translateLink.querySelector('span').textContent = '显示原文';
        isTranslated = true;

        // 使用 AI 翻译
        try {
          translationDiv.textContent = '正在翻译...';
          const originalText = tweet.content;
          const response = await roche.ai.chat([
            { role: 'user', content: `请将以下内容翻译成英文，只返回翻译结果，不要任何解释：\n\n${originalText}` }
          ]);
          translationDiv.textContent = response.content;
        } catch (error) {
          console.error('[Twitter] Translation failed:', error);
          translationDiv.textContent = '翻译失败，请稍后重试';
        }
      }
    });
  }

  // 绑定关注按钮
  if (!isSelf) {
    const followBtn = document.getElementById('detail-follow-btn');
    if (followBtn) {
      followBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await toggleFollow(user.id, roche);
        showTweetDetail(tweetId, roche); // 刷新详情页
      });
    }
  }

  // 绑定详情页操作按钮
  detailMain.querySelectorAll('.detail-action-icon').forEach(el => {
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
        showToast('已取消喜欢', 'info');
      } else {
        tweet.likes.push(currentUser);
        showToast('已喜欢', 'success');
      }
      await saveData(roche);
      showTweetDetail(tweetId, roche);
      break;

    case 'retweet':
      const retweetIndex = tweet.retweets.indexOf(currentUser);
      if (retweetIndex > -1) {
        tweet.retweets.splice(retweetIndex, 1);
        showToast('已取消转发', 'info');
      } else {
        tweet.retweets.push(currentUser);
        showToast('已转发', 'success');

        // 转发时保存到记忆
        try {
          const user = twitterData.users[tweet.userId];
          await roche.memory.addEpisodic({
            content: `转发了 ${user.name} 的推文：${tweet.content}`,
            conversationId: currentUser,
            tags: ['twitter', 'retweet']
          });
        } catch (error) {
          console.error('[详情页] 保存记忆失败:', error);
        }
      }
      await saveData(roche);
      showTweetDetail(tweetId, roche);
      break;

    case 'reply':
      // 聚焦到回复输入框
      document.getElementById('detail-reply-textarea').focus();
      break;

    case 'bookmark':
      // 书签功能
      if (!twitterData.bookmarks) {
        twitterData.bookmarks = {};
      }
      if (!twitterData.bookmarks[currentUser]) {
        twitterData.bookmarks[currentUser] = [];
      }

      const bookmarkIndex = twitterData.bookmarks[currentUser].indexOf(tweetId);
      if (bookmarkIndex > -1) {
        twitterData.bookmarks[currentUser].splice(bookmarkIndex, 1);
        showToast('已移除书签', 'info');
      } else {
        twitterData.bookmarks[currentUser].push(tweetId);
        showToast('已添加到书签', 'success');
      }
      await saveData(roche);
      showTweetDetail(tweetId, roche);
      break;

    case 'share':
      // 分享功能 - 显示分享菜单
      showShareMenu(tweet, roche);
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

  // 如果有多个回复，触发自动总结
  if (tweet.replies.length >= 2) {
    await summarizeConversation(tweet, tweet.replies, roche);
  }

  showToast('回复已发布！', 'success');

  // 刷新详情页
  showTweetDetail(tweetId, roche);
}

/**
 * 显示分享菜单
 */
function showShareMenu(tweet, roche) {
  const user = twitterData.users[tweet.userId];

  // 创建遮罩层
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    z-index: 10000;
    animation: fadeIn 0.2s;
  `;

  // 创建分享菜单
  const menu = document.createElement('div');
  menu.style.cssText = `
    background: white;
    border-radius: 16px 16px 0 0;
    width: 100%;
    max-width: 600px;
    padding: 16px;
    animation: slideUpMenu 0.3s;
  `;

  menu.innerHTML = `
    <div style="padding: 16px 0; border-bottom: 1px solid #eff3f4;">
      <div style="font-weight: 700; font-size: 20px; color: #0f1419; margin-bottom: 8px;">
        分享推文
      </div>
      <div style="font-size: 13px; color: #536471;">
        ${user.name}：${tweet.content.substring(0, 50)}${tweet.content.length > 50 ? '...' : ''}
      </div>
    </div>

    <div class="share-options">
      <div class="share-option" data-action="copy-link">
        <div class="share-option-icon" style="background: rgba(29, 155, 240, 0.1);">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="#1d9bf0"><path d="M11.96 14.945c-.067 0-.136-.01-.203-.027-1.13-.318-2.097-.986-2.795-1.932-.832-1.125-1.176-2.508-.968-3.893s.942-2.605 2.068-3.438l3.53-2.608c2.322-1.716 5.61-1.224 7.33 1.1.83 1.127 1.175 2.51.967 3.895s-.943 2.605-2.07 3.438l-1.48 1.094c-.333.246-.804.175-1.05-.158-.246-.334-.176-.804.158-1.05l1.48-1.095c.803-.592 1.327-1.463 1.476-2.45.148-.988-.098-1.975-.69-2.778-1.225-1.656-3.572-2.01-5.23-.784l-3.53 2.608c-.802.593-1.326 1.464-1.475 2.45-.15.99.097 1.975.69 2.778.498.675 1.187 1.15 1.992 1.377.4.114.633.528.52.928-.092.33-.394.547-.722.547z"></path><path d="M7.27 22.054c-1.61 0-3.197-.735-4.225-2.125-.832-1.127-1.176-2.51-.968-3.894s.943-2.605 2.07-3.438l1.478-1.094c.333-.246.805-.175 1.05.158s.177.804-.157 1.05l-1.48 1.095c-.803.593-1.326 1.464-1.475 2.45-.148.99.097 1.975.69 2.778 1.225 1.657 3.572 2.01 5.23.785l3.528-2.608c1.658-1.225 2.01-3.57.785-5.23-.498-.674-1.187-1.15-1.992-1.376-.4-.113-.633-.527-.52-.927.112-.4.528-.63.926-.522 1.13.318 2.096.986 2.794 1.932 1.717 2.324 1.224 5.612-1.1 7.33l-3.53 2.608c-.933.693-2.023 1.026-3.105 1.026z"></path></svg>
        </div>
        <div class="share-option-text">
          <div style="font-weight: 700; font-size: 15px; color: #0f1419;">复制链接</div>
          <div style="font-size: 13px; color: #536471;">分享给朋友</div>
        </div>
      </div>

      <div class="share-option" data-action="send-via-dm">
        <div class="share-option-icon" style="background: rgba(29, 155, 240, 0.1);">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="#1d9bf0"><path d="M1.998 5.5c0-1.381 1.119-2.5 2.5-2.5h15c1.381 0 2.5 1.119 2.5 2.5v13c0 1.381-1.119 2.5-2.5 2.5h-15c-1.381 0-2.5-1.119-2.5-2.5v-13zm2.5-.5c-.276 0-.5.224-.5.5v.511l8.5 5.312 8.5-5.312v-.511c0-.276-.224-.5-.5-.5h-15zm-.5 2.49v10.51c0 .276.224.5.5.5h15c.276 0 .5-.224.5-.5v-10.51l-7.928 4.954c-.32.2-.73.2-1.05 0l-7.928-4.955z"></path></svg>
        </div>
        <div class="share-option-text">
          <div style="font-weight: 700; font-size: 15px; color: #0f1419;">通过私信发送</div>
          <div style="font-size: 13px; color: #536471;">分享给联系人</div>
        </div>
      </div>

      <div class="share-option" data-action="bookmark">
        <div class="share-option-icon" style="background: rgba(29, 155, 240, 0.1);">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="#1d9bf0"><path d="M4 4.5C4 3.12 5.119 2 6.5 2h11C18.881 2 20 3.12 20 4.5v18.44l-8-5.71-8 5.71V4.5z"></path></svg>
        </div>
        <div class="share-option-text">
          <div style="font-weight: 700; font-size: 15px; color: #0f1419;">添加书签</div>
          <div style="font-size: 13px; color: #536471;">保存以便稍后查看</div>
        </div>
      </div>
    </div>

    <button class="share-cancel-btn" style="
      width: 100%;
      padding: 16px;
      border: none;
      background: transparent;
      color: #0f1419;
      font-weight: 700;
      font-size: 17px;
      cursor: pointer;
      margin-top: 8px;
      border-radius: 8px;
      transition: all 0.2s;
    ">取消</button>

    <style>
      @keyframes slideUpMenu {
        from { transform: translateY(100%); }
        to { transform: translateY(0); }
      }

      .share-options {
        padding: 8px 0;
      }

      .share-option {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 16px;
        cursor: pointer;
        border-radius: 8px;
        transition: all 0.2s;
      }

      .share-option:hover {
        background: rgba(0, 0, 0, 0.03);
      }

      .share-option-icon {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .share-option-text {
        flex: 1;
      }

      .share-cancel-btn:hover {
        background: rgba(0, 0, 0, 0.05);
      }
    </style>
  `;

  overlay.appendChild(menu);
  document.body.appendChild(overlay);

  // 绑定分享选项事件
  menu.querySelectorAll('.share-option').forEach(option => {
    option.addEventListener('click', async () => {
      const action = option.dataset.action;

      if (action === 'copy-link') {
        // 复制链接
        const link = `https://twitter.com/${user.username}/status/${tweet.id}`;
        try {
          await navigator.clipboard.writeText(link);
          showToast('链接已复制到剪贴板', 'success');
        } catch (error) {
          // 降级方案
          const textarea = document.createElement('textarea');
          textarea.value = link;
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
          showToast('链接已复制到剪贴板', 'success');
        }
        document.body.removeChild(overlay);
      } else if (action === 'send-via-dm') {
        showToast('私信分享功能开发中...', 'info');
        document.body.removeChild(overlay);
      } else if (action === 'bookmark') {
        // 添加书签
        if (!twitterData.bookmarks) {
          twitterData.bookmarks = {};
        }
        if (!twitterData.bookmarks[currentUser]) {
          twitterData.bookmarks[currentUser] = [];
        }

        if (!twitterData.bookmarks[currentUser].includes(tweet.id)) {
          twitterData.bookmarks[currentUser].push(tweet.id);
          await saveData(roche);
          showToast('已添加到书签', 'success');
        } else {
          showToast('已在书签中', 'info');
        }
        document.body.removeChild(overlay);
      }
    });
  });

  // 取消按钮
  menu.querySelector('.share-cancel-btn').addEventListener('click', () => {
    document.body.removeChild(overlay);
  });

  // 点击遮罩层关闭
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      document.body.removeChild(overlay);
    }
  });
}

/**
 * 显示新闻推文详情页
 */
function showNewsTweetDetail(newsId, roche) {
  console.log('[Twitter] showNewsTweetDetail called, newsId:', newsId);

  // 从搜索结果中找新闻推文
  const tweetItem = document.querySelector(`[data-tweet-id="${newsId}"]`);
  if (!tweetItem) {
    console.error('[Twitter] News tweet not found:', newsId);
    showToast('推文不存在', 'error');
    return;
  }

  const newsData = JSON.parse(tweetItem.dataset.searchResult || '{}');
  console.log('[Twitter] Found news:', newsData);

  currentTweetId = newsId;
  const user = twitterData.users['news_bot']; // 新闻机器人
  const currentUserData = twitterData.users[currentUser];

  // 格式化时间
  const date = new Date();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? '下午' : '上午';
  const displayHours = hours % 12 || 12;
  const year = date.getFullYear() % 100;
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const formattedDateTime = `${year}年${month}月${day}日, ${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;

  // 模拟查看数
  const viewCount = Math.floor(Math.random() * 500) + 100;

  // 渲染详情内容
  const detailMain = document.getElementById('detail-main');
  detailMain.innerHTML = `
    <div class="detail-tweet">
      <!-- 用户信息区 -->
      <div class="detail-user-section">
        <div class="detail-user-header">
          <img class="detail-tweet-avatar" src="${user.avatar}" alt="">
          <div class="detail-user-info">
            <div class="detail-tweet-name">${user.name}</div>
            <div class="detail-tweet-username">${user.username}</div>
          </div>
        </div>
        <div class="detail-translate-link" id="translate-link">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#1d9bf0"><path d="M12.87 2.27c-.5-.5-1.29-.5-1.79 0l-6.36 6.37c-.5.5-.5 1.29 0 1.79l1.41 1.41c.5.5 1.29.5 1.79 0L10 9.77V18c0 .55.45 1 1 1s1-.45 1-1V9.77l2.09 2.09c.5.5 1.29.5 1.79 0l1.41-1.41c.5-.5.5-1.29 0-1.79l-6.36-6.37z"></path></svg>
          <span style="color: #1d9bf0; font-size: 15px;">显示翻译</span>
        </div>
      </div>

      <!-- 推文内容 -->
      <div class="detail-tweet-content" id="detail-tweet-content">
        ${escapeHtml(newsData.snippet || newsData.title || '')}
      </div>

      <!-- 翻译内容（隐藏） -->
      <div class="detail-tweet-translation" id="detail-tweet-translation" style="display: none; padding: 16px; background: #f7f9f9; border-radius: 12px; margin-top: 12px; color: #536471; font-size: 15px;">
        正在翻译...
      </div>

      <!-- 时间和查看数 -->
      <div class="detail-tweet-time">
        <span style="color: #536471;">${formattedDateTime}</span>
        <span style="color: #536471; margin: 0 4px;">·</span>
        <span style="font-weight: 700; color: #0f1419;">${viewCount}</span>
        <span style="color: #536471;"> 查看</span>
      </div>

      <!-- 只显示喜欢数 -->
      <div class="detail-tweet-likes">
        <span style="font-weight: 700; color: #0f1419;">0</span>
        <span style="color: #536471; margin-left: 4px;">喜欢</span>
      </div>

      <!-- 操作按钮 -->
      <div class="detail-action-bar">
        <div class="detail-action-icon" data-action="reply">
          ${icons.comment}
        </div>
        <div class="detail-action-icon" data-action="retweet">
          ${icons.retweet}
        </div>
        <div class="detail-action-icon" data-action="like">
          ${icons.like}
        </div>
        <div class="detail-action-icon" data-action="bookmark">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M4 4.5C4 3.12 5.119 2 6.5 2h11C18.881 2 20 3.12 20 4.5v18.44l-8-5.71-8 5.71V4.5z"></path></svg>
        </div>
        <div class="detail-action-icon" data-action="share">
          ${icons.share}
        </div>
      </div>

      <!-- 回复排序 -->
      <div class="detail-replies-header">
        <span style="font-weight: 700; font-size: 15px;">最相关的回复</span>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="#536471"><path d="M3.543 8.96l1.414-1.42L12 14.59l7.043-7.05 1.414 1.42L12 17.41 3.543 8.96z"></path></svg>
      </div>

      <!-- 发现更多 -->
      <div class="detail-discover-more">
        <div style="font-weight: 700; font-size: 20px; color: #0f1419;">发现更多</div>
      </div>

      <!-- 来源标签 -->
      <div class="detail-source-label">
        <span style="color: #536471; font-size: 13px;">源自于整个 X</span>
      </div>

      <!-- 回复列表 -->
      <div class="detail-replies" id="detail-replies">
        <div style="padding: 40px 20px; text-align: center; color: #536471;">暂无回复</div>
      </div>
    </div>
  `;

  // 更新回复输入框头像
  document.getElementById('detail-reply-avatar').src = currentUserData.avatar;

  // 绑定翻译按钮
  const translateLink = document.getElementById('translate-link');
  const translationDiv = document.getElementById('detail-tweet-translation');
  const contentDiv = document.getElementById('detail-tweet-content');
  let isTranslated = false;

  if (translateLink) {
    translateLink.addEventListener('click', async () => {
      if (isTranslated) {
        // 隐藏翻译
        translationDiv.style.display = 'none';
        translateLink.querySelector('span').textContent = '显示翻译';
        isTranslated = false;
      } else {
        // 显示翻译
        translationDiv.style.display = 'block';
        translateLink.querySelector('span').textContent = '显示原文';
        isTranslated = true;

        // 使用 AI 翻译
        try {
          translationDiv.textContent = '正在翻译...';
          const originalText = newsData.snippet || newsData.title || '';
          const response = await roche.ai.chat([
            { role: 'user', content: `请将以下内容翻译成中文，只返回翻译结果，不要任何解释：\n\n${originalText}` }
          ]);
          translationDiv.textContent = response.content;
        } catch (error) {
          console.error('[Twitter] Translation failed:', error);
          translationDiv.textContent = '翻译失败，请稍后重试';
        }
      }
    });
  }

  // 绑定详情页操作按钮
  detailMain.querySelectorAll('.detail-action-icon').forEach(el => {
    el.addEventListener('click', (e) => {
      const action = el.dataset.action;
      if (action === 'reply' || action === 'retweet' || action === 'like' || action === 'bookmark' || action === 'share') {
        showToast(`${action === 'reply' ? '回复' : action === 'retweet' ? '转发' : action === 'like' ? '点赞' : action === 'bookmark' ? '书签' : '分享'}功能开发中...`, 'info');
      }
    });
  });

  // 切换到详情视图
  switchView('tweetDetail');
}

/**
 * 显示确认对话框
 */
function showConfirmDialog(message, onConfirm, onCancel) {
  // 创建遮罩层
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    animation: fadeIn 0.2s;
  `;

  // 创建对话框
  const dialog = document.createElement('div');
  dialog.style.cssText = `
    background: white;
    border-radius: 16px;
    padding: 24px;
    max-width: 320px;
    width: 90%;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    animation: slideUp 0.3s;
  `;

  dialog.innerHTML = `
    <div style="font-size: 20px; font-weight: 700; color: #0f1419; margin-bottom: 8px;">
      确认退出？
    </div>
    <div style="font-size: 15px; color: #536471; margin-bottom: 24px;">
      ${message}
    </div>
    <div style="display: flex; gap: 12px;">
      <button id="dialog-cancel" style="
        flex: 1;
        padding: 12px;
        border: 1px solid #cfd9de;
        background: white;
        color: #0f1419;
        border-radius: 24px;
        font-weight: 700;
        font-size: 15px;
        cursor: pointer;
        transition: all 0.2s;
      ">
        取消
      </button>
      <button id="dialog-confirm" style="
        flex: 1;
        padding: 12px;
        border: none;
        background: #0f1419;
        color: white;
        border-radius: 24px;
        font-weight: 700;
        font-size: 15px;
        cursor: pointer;
        transition: all 0.2s;
      ">
        退出
      </button>
    </div>
  `;

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  // 按钮事件
  const cancelBtn = dialog.querySelector('#dialog-cancel');
  const confirmBtn = dialog.querySelector('#dialog-confirm');

  cancelBtn.addEventListener('mouseenter', () => {
    cancelBtn.style.background = '#f7f9f9';
  });
  cancelBtn.addEventListener('mouseleave', () => {
    cancelBtn.style.background = 'white';
  });

  confirmBtn.addEventListener('mouseenter', () => {
    confirmBtn.style.background = '#272c26';
  });
  confirmBtn.addEventListener('mouseleave', () => {
    confirmBtn.style.background = '#0f1419';
  });

  cancelBtn.addEventListener('click', () => {
    document.body.removeChild(overlay);
    if (onCancel) onCancel();
  });

  confirmBtn.addEventListener('click', () => {
    document.body.removeChild(overlay);
    if (onConfirm) onConfirm();
  });

  // 点击遮罩层关闭
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      document.body.removeChild(overlay);
      if (onCancel) onCancel();
    }
  });
}

/**
 * 退出应用
 */
function exitApp(container, roche) {
  console.log('[Twitter] 退出应用');

  // 显示确认对话框
  showConfirmDialog(
    '你确定要退出 Twitter 吗？',
    () => {
      // 确认退出
      try {
        // 使用 Roche 官方退出 API
        if (roche && roche.ui && roche.ui.closeApp) {
          console.log('[Twitter] 调用 roche.ui.closeApp()');
          roche.ui.closeApp();
        } else {
          console.error('[Twitter] roche.ui.closeApp 不可用');
          // 后备方案
          showToast('退出失败，请手动返回', 'error');
        }
      } catch (error) {
        console.error('[Twitter] 退出失败:', error);
        showToast('退出失败: ' + error.message, 'error');
      }
    },
    () => {
      // 取消退出
      console.log('[Twitter] 用户取消退出');
    }
  );
}

/**
 * 处理新闻推文操作
 */
async function handleNewsTweetAction(action, tweetId, roche) {
  // 新闻推文的操作简化处理（暂不保存到主数据）
  if (action === 'like' || action === 'retweet') {
    showToast('已' + (action === 'like' ? '点赞' : '转发'), 'success');
  } else if (action === 'reply') {
    showToast('回复功能开发中...', 'info');
  } else if (action === 'share') {
    showToast('分享功能开发中...', 'info');
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

/**
 * 渲染搜索页
 */
function renderSearch(roche) {
  // 更新顶部栏头像
  const avatarImg = document.getElementById('search-avatar-img');
  const currentUserData = twitterData.users[currentUser];
  if (avatarImg && currentUserData) {
    avatarImg.src = currentUserData.avatar;
  }

  // 绑定头像按钮点击事件
  const avatarBtn = document.getElementById('search-avatar-btn');
  if (avatarBtn) {
    avatarBtn.onclick = () => {
      showSidebar(roche);
    };
  }

  // 绑定设置按钮点击事件
  const settingsBtn = document.getElementById('search-settings-btn');
  if (settingsBtn) {
    settingsBtn.onclick = () => {
      switchView('settings');
    };
  }

  // 绑定标签页切换
  document.querySelectorAll('.search-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.search-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      // 这里可以根据不同标签页加载不同内容
      const tabType = tab.dataset.searchTab;
      console.log('[搜索] 切换到标签:', tabType);
    });
  });

  const recommendedEl = document.getElementById('recommended-users');
  // 只显示其他 Persona（不是当前用户）
  const users = Object.values(twitterData.users).filter(u => u.id !== currentUser && u.isPersona);

  recommendedEl.innerHTML = users.slice(0, 5).map(user => {
    const isFollowing = twitterData.follows[currentUser]?.includes(user.id);
    return `
      <div class="recommended-user">
        <img class="recommended-avatar" src="${user.avatar}" alt="">
        <div class="recommended-info">
          <div class="recommended-name">${user.name}</div>
          <div class="recommended-username">${user.username}</div>
          <div class="recommended-bio">${escapeHtml(user.bio)}</div>
        </div>
        <button class="follow-btn ${isFollowing ? 'following' : ''}" data-user-id="${user.id}">
          ${isFollowing ? '正在关注' : '关注'}
        </button>
      </div>
    `;
  }).join('');

  // 绑定关注按钮
  recommendedEl.querySelectorAll('.follow-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const userId = btn.dataset.userId;
      await toggleFollow(userId, roche);
      renderSearch(roche);
    });
  });
}

/**
 * 渲染通知页
 */
function renderNotifications(roche) {
  const notificationsEl = document.getElementById('notifications-list');
  const filter = twitterData.notificationFilter || 'all';

  // 更新顶部栏头像
  const avatarImg = document.getElementById('notifications-avatar-img');
  const currentUserData = twitterData.users[currentUser];
  if (avatarImg && currentUserData) {
    avatarImg.src = currentUserData.avatar;
  }

  // 绑定头像按钮点击事件（打开侧边栏）
  const avatarBtn = document.getElementById('notifications-avatar-btn');
  if (avatarBtn) {
    avatarBtn.onclick = () => {
      showSidebar(roche);
    };
  }

  // 绑定设置按钮点击事件
  const settingsBtn = document.getElementById('notifications-settings-btn');
  if (settingsBtn) {
    settingsBtn.onclick = () => {
      switchView('settings');
    };
  }

  // 生成一些示例通知
  if (twitterData.notifications.length === 0) {
    // 为每条推文生成一些随机通知
    const users = Object.values(twitterData.users).filter(u => u.id !== currentUser && u.isPersona);

    twitterData.tweets.forEach(tweet => {
      if (tweet.userId === currentUser && users.length > 0) {
        // 随机选择一些用户来点赞、转发
        const likeUser = users[Math.floor(Math.random() * users.length)];
        const retweetUser = users[Math.floor(Math.random() * users.length)];

        if (Math.random() > 0.5) {
          twitterData.notifications.push({
            id: Date.now() + Math.random(),
            type: 'like',
            userId: likeUser.id,
            tweetId: tweet.id,
            timestamp: Date.now() - Math.floor(Math.random() * 86400000)
          });
        }

        if (Math.random() > 0.6) {
          twitterData.notifications.push({
            id: Date.now() + Math.random(),
            type: 'retweet',
            userId: retweetUser.id,
            tweetId: tweet.id,
            timestamp: Date.now() - Math.floor(Math.random() * 86400000)
          });
        }
      }
    });

    // 添加关注通知
    users.slice(0, 2).forEach(user => {
      twitterData.notifications.push({
        id: Date.now() + Math.random(),
        type: 'follow',
        userId: user.id,
        timestamp: Date.now() - Math.floor(Math.random() * 86400000)
      });
    });
  }

  // 过滤通知
  let filteredNotifications = twitterData.notifications;
  if (filter === 'mentions') {
    // 只显示提及（@）的通知 - 暂时显示所有回复类型
    filteredNotifications = twitterData.notifications.filter(n => n.type === 'reply' || n.type === 'mention');
  }

  if (filteredNotifications.length === 0) {
    const emptyMessage = filter === 'mentions' ? '还没有提及你的通知' : '还没有通知';
    notificationsEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔔</div>
        <div>${emptyMessage}</div>
      </div>
    `;
    return;
  }

  // 按时间排序
  filteredNotifications.sort((a, b) => b.timestamp - a.timestamp);

  notificationsEl.innerHTML = filteredNotifications.map(notif => {
    const user = twitterData.users[notif.userId];
    if (!user) return '';

    let typeIcon = '';
    let text = '';
    let preview = '';

    if (notif.type === 'like') {
      typeIcon = `<span style="color: #f91880;">${icons.likeFilled}</span>`;
      text = `<strong>${user.name}</strong> 赞了你的推文`;
      const tweet = twitterData.tweets.find(t => t.id === notif.tweetId);
      if (tweet) preview = `<div class="notification-preview">${escapeHtml(tweet.content.substring(0, 100))}</div>`;
    } else if (notif.type === 'retweet') {
      typeIcon = `<span style="color: #00ba7c;">${icons.retweet}</span>`;
      text = `<strong>${user.name}</strong> 转发了你的推文`;
      const tweet = twitterData.tweets.find(t => t.id === notif.tweetId);
      if (tweet) preview = `<div class="notification-preview">${escapeHtml(tweet.content.substring(0, 100))}</div>`;
    } else if (notif.type === 'follow') {
      typeIcon = `<span style="color: #1d9bf0;">${icons.follow}</span>`;
      text = `<strong>${user.name}</strong> 关注了你`;
    } else if (notif.type === 'reply') {
      typeIcon = `<span style="color: #1d9bf0;">${icons.comment}</span>`;
      text = `<strong>${user.name}</strong> 回复了你的推文`;
    }

    return `
      <div class="notification-item">
        <div class="notification-avatar-wrapper">
          <img class="notification-avatar" src="${user.avatar}" alt="">
          <div class="notification-type-icon">${typeIcon}</div>
        </div>
        <div class="notification-content">
          <div class="notification-text">${text}</div>
          <div class="notification-time">${getTimeAgo(notif.timestamp)}</div>
          ${preview}
        </div>
      </div>
    `;
  }).join('');
}

/**
 * 渲染私信页
 */
let currentChatUser = null;

async function renderMessages(roche) {
  // 更新顶部栏头像
  const avatarImg = document.getElementById('messages-avatar-img');
  const currentUserData = twitterData.users[currentUser];
  if (avatarImg && currentUserData) {
    avatarImg.src = currentUserData.avatar;
  }

  // 绑定头像按钮点击事件
  const avatarBtn = document.getElementById('messages-avatar-btn');
  if (avatarBtn) {
    avatarBtn.onclick = () => {
      showSidebar(roche);
    };
  }

  // 绑定筛选按钮点击事件
  const filterBtn = document.getElementById('messages-filter-btn');
  if (filterBtn) {
    filterBtn.onclick = () => {
      showMessagesFilterMenu();
    };
  }

  // 绑定写私信按钮
  const writeBtn = document.getElementById('messages-write-btn');
  if (writeBtn) {
    writeBtn.onclick = () => {
      showNewMessageDialog(roche);
    };
  }

  // 绑定浮动按钮
  const fabBtn = document.getElementById('messages-fab');
  if (fabBtn) {
    fabBtn.onclick = () => {
      showNewMessageDialog(roche);
    };
  }

  const messagesEl = document.getElementById('messages-list');
  const welcomeEl = document.getElementById('messages-welcome');

  try {
    // 从 Roche 加载真实的对话列表
    const conversations = await roche.conversation.list();
    console.log('[Twitter] 加载的对话列表:', conversations);

    if (!conversations || conversations.length === 0) {
      // 显示欢迎界面
      if (welcomeEl) welcomeEl.style.display = 'block';
      if (messagesEl) messagesEl.style.display = 'none';
      return;
    }

    // 隐藏欢迎界面，显示对话列表
    if (welcomeEl) welcomeEl.style.display = 'none';
    if (messagesEl) messagesEl.style.display = 'block';

    // 为每个对话获取最后一条消息和头像
    const conversationsWithMessages = await Promise.all(conversations.map(async (conv) => {
      try {
        // 获取最近的记忆作为最后一条消息
        const longTerm = await roche.memory.getLongTerm({
          conversationId: conv.id,
          limit: 1
        });

        const memories = [...(longTerm.facts || []), ...(longTerm.vectors || [])];
        const lastMessage = memories.length > 0
          ? (memories[0].summaryText || memories[0].text || '开始新对话...')
          : '开始新对话...';

        const lastTimestamp = memories.length > 0
          ? (memories[0].timestamp || Date.now())
          : Date.now();

        // 获取 Char 头像
        let avatarUrl = null;

        // 1. 尝试通过 persona API 获取
        if (conv.id) {
          try {
            const persona = await roche.persona.get(conv.id);
            console.log('[Twitter] 尝试获取 persona 头像:', conv.title, persona);
            if (persona?.avatar) {
              avatarUrl = persona.avatar;
              console.log('[Twitter] 通过 persona 获取头像成功:', avatarUrl);
            }
          } catch (e) {
            console.log('[Twitter] persona API 调用失败:', e);
          }
        }

        // 2. 如果还没有头像，检查 conversation 本身的字段
        if (!avatarUrl) {
          const possibleFields = ['avatar', 'avatarUrl', 'image', 'imageUrl', 'icon', 'picture'];
          for (const field of possibleFields) {
            if (conv[field]) {
              avatarUrl = conv[field];
              console.log(`[Twitter] 在 conversation.${field} 找到头像:`, avatarUrl);
              break;
            }
          }
        }

        if (!avatarUrl) {
          console.log('[Twitter] 未找到头像，将使用首字母:', conv.title);
        }

        return {
          ...conv,
          lastMessage,
          lastTimestamp,
          avatarUrl,
          unread: false // 可以后续添加未读逻辑
        };
      } catch (e) {
        return {
          ...conv,
          lastMessage: '加载失败',
          lastTimestamp: Date.now(),
          unread: false
        };
      }
    }));

    // 按时间排序
    conversationsWithMessages.sort((a, b) => b.lastTimestamp - a.lastTimestamp);

    // 渲染对话列表
    messagesEl.innerHTML = conversationsWithMessages.map(conv => {
      // 头像处理
      const initial = conv.title ? conv.title.charAt(0).toUpperCase() : '?';
      const avatarGradient = `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`;

      // 如果有真实头像，显示图片；否则显示首字母
      const avatarHtml = conv.avatarUrl
        ? `<img src="${conv.avatarUrl}" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; flex-shrink: 0;" alt="${conv.title || '头像'}">`
        : `<div style="width: 48px; height: 48px; border-radius: 50%; background: ${avatarGradient}; display: flex; align-items: center; justify-content: center; color: white; font-size: 20px; font-weight: 700; flex-shrink: 0;">${initial}</div>`;

      return `
        <div class="message-item" data-conv-id="${conv.id}" style="padding: 16px; display: flex; align-items: center; gap: 12px; cursor: pointer; transition: background 0.2s; border-bottom: 1px solid #eff3f4;">
          ${avatarHtml}
          <div class="message-info" style="flex: 1; min-width: 0;">
            <div class="message-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <div class="message-name" style="font-size: 15px; font-weight: 700; color: #0f1419;">${conv.title || '未命名对话'}</div>
              <div class="message-time" style="font-size: 13px; color: #536471;">${getTimeAgo(conv.lastTimestamp)}</div>
            </div>
            <div class="message-preview" style="font-size: 15px; color: #536471; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(conv.lastMessage.substring(0, 80))}</div>
          </div>
          ${conv.unread ? '<div class="message-unread-dot" style="width: 8px; height: 8px; border-radius: 50%; background: #1d9bf0; flex-shrink: 0;"></div>' : ''}
        </div>
      `;
    }).join('');

    // 绑定点击事件
    messagesEl.querySelectorAll('.message-item').forEach(item => {
      item.addEventListener('click', () => {
        const convId = item.dataset.convId;
        openChatWithConv(convId, roche);
      });
    });

    // 添加悬停效果
    const style = document.createElement('style');
    style.textContent = `
      .message-item:hover {
        background: rgba(0, 0, 0, 0.03);
      }
    `;
    if (!document.getElementById('message-item-styles')) {
      style.id = 'message-item-styles';
      document.head.appendChild(style);
    }

  } catch (error) {
    console.error('加载私信列表失败:', error);
    // 显示欢迎界面
    if (welcomeEl) welcomeEl.style.display = 'block';
    if (messagesEl) messagesEl.style.display = 'none';
  }
}

/**
 * 显示私信筛选菜单
 */
function showMessagesFilterMenu() {
  // 创建遮罩层（透明，用于点击关闭）
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: transparent;
    z-index: 10000;
  `;

  // 获取按钮位置
  const filterBtn = document.getElementById('messages-filter-btn');
  const rect = filterBtn.getBoundingClientRect();

  // 创建菜单（右上角下拉）
  const menu = document.createElement('div');
  menu.style.cssText = `
    position: fixed;
    top: ${rect.bottom + 8}px;
    right: 16px;
    background: white;
    border-radius: 8px;
    min-width: 200px;
    padding: 8px 0;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.1);
    animation: dropdownMenu 0.2s ease-out;
  `;

  // 添加动画
  const style = document.createElement('style');
  style.textContent = `
    @keyframes dropdownMenu {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `;
  document.head.appendChild(style);

  // 获取当前筛选状态
  const currentFilter = twitterData.messageFilter || 'all';

  menu.innerHTML = `
    <div class="filter-menu-option" data-filter="all">
      <svg viewBox="0 0 24 24" width="24" height="24" fill="#0f1419" style="margin-right: 16px;"><path d="M1.998 5.5c0-1.381 1.119-2.5 2.5-2.5h15c1.381 0 2.5 1.119 2.5 2.5v13c0 1.381-1.119 2.5-2.5 2.5h-15c-1.381 0-2.5-1.119-2.5-2.5v-13zm2.5-.5c-.276 0-.5.224-.5.5v.511l8.5 5.312 8.5-5.312v-.511c0-.276-.224-.5-.5-.5h-15zm-.5 2.49v10.51c0 .276.224.5.5.5h15c.276 0 .5-.224.5-.5v-10.51l-7.928 4.954c-.32.2-.73.2-1.05 0l-7.928-4.955z"></path></svg>
      <div style="flex: 1; color: #0f1419; font-size: 15px; font-weight: 500;">全部</div>
      ${currentFilter === 'all' ? '<svg viewBox="0 0 24 24" width="20" height="20" fill="#1d9bf0"><path d="M9 20l-7-7 1.41-1.41L9 17.17 20.59 5.59 22 7l-13 13z"></path></svg>' : ''}
    </div>

    <div class="filter-menu-option" data-filter="unread">
      <svg viewBox="0 0 24 24" width="24" height="24" fill="#0f1419" style="margin-right: 16px;"><g><path d="M1.998 5.5c0-1.381 1.119-2.5 2.5-2.5h15c1.381 0 2.5 1.119 2.5 2.5v13c0 1.381-1.119 2.5-2.5 2.5h-15c-1.381 0-2.5-1.119-2.5-2.5v-13zm2.5-.5c-.276 0-.5.224-.5.5v.511l8.5 5.312 8.5-5.312v-.511c0-.276-.224-.5-.5-.5h-15zm-.5 2.49v10.51c0 .276.224.5.5.5h15c.276 0 .5-.224.5-.5v-10.51l-7.928 4.954c-.32.2-.73.2-1.05 0l-7.928-4.955z"></path><circle cx="19" cy="6" r="3" fill="#1d9bf0"></circle></g></svg>
      <div style="flex: 1; color: #0f1419; font-size: 15px; font-weight: 500;">未读</div>
      ${currentFilter === 'unread' ? '<svg viewBox="0 0 24 24" width="20" height="20" fill="#1d9bf0"><path d="M9 20l-7-7 1.41-1.41L9 17.17 20.59 5.59 22 7l-13 13z"></path></svg>' : ''}
    </div>

    <div class="filter-menu-option" data-filter="direct">
      <svg viewBox="0 0 24 24" width="24" height="24" fill="#0f1419" style="margin-right: 16px;"><path d="M5.651 19h12.698c-.337-1.8-1.023-3.21-1.945-4.19C15.318 13.65 13.838 13 12 13s-3.317.65-4.404 1.81c-.922.98-1.608 2.39-1.945 4.19zm.486-5.56C7.627 11.85 9.648 11 12 11s4.373.85 5.863 2.44c1.477 1.58 2.366 3.8 2.632 6.46l.11 1.1H3.395l.11-1.1c.266-2.66 1.155-4.88 2.632-6.46zM12 4c-1.105 0-2 .9-2 2s.895 2 2 2 2-.9 2-2-.895-2-2-2zM8 6c0-2.21 1.791-4 4-4s4 1.79 4 4-1.791 4-4 4-4-1.79-4-4z"></path></svg>
      <div style="flex: 1; color: #0f1419; font-size: 15px; font-weight: 500;">直接</div>
      ${currentFilter === 'direct' ? '<svg viewBox="0 0 24 24" width="20" height="20" fill="#1d9bf0"><path d="M9 20l-7-7 1.41-1.41L9 17.17 20.59 5.59 22 7l-13 13z"></path></svg>' : ''}
    </div>

    <div class="filter-menu-option" data-filter="group">
      <svg viewBox="0 0 24 24" width="24" height="24" fill="#0f1419" style="margin-right: 16px;"><path d="M17.5 4c.828 0 1.5.67 1.5 1.5v2c0 .83-.672 1.5-1.5 1.5h-15C1.67 9 1 8.33 1 7.5v-2C1 4.67 1.67 4 2.5 4h15zM19 7.5v-2c0-1.93-1.57-3.5-3.5-3.5h-15C-1.57 2-3 3.57-3 5.5v2C-3 9.43-1.57 11-.5 11h15c1.93 0 3.5-1.57 3.5-3.5zm2 7c0-.83-.672-1.5-1.5-1.5h-15c-.828 0-1.5.67-1.5 1.5v2c0 .83.672 1.5 1.5 1.5h15c.828 0 1.5-.67 1.5-1.5v-2zm2 0v2c0 1.93-1.57 3.5-3.5 3.5h-15c-1.93 0-3.5-1.57-3.5-3.5v-2c0-1.93 1.57-3.5 3.5-3.5h15c1.93 0 3.5 1.57 3.5 3.5z"></path></svg>
      <div style="flex: 1; color: #0f1419; font-size: 15px; font-weight: 500;">群组</div>
      ${currentFilter === 'group' ? '<svg viewBox="0 0 24 24" width="20" height="20" fill="#1d9bf0"><path d="M9 20l-7-7 1.41-1.41L9 17.17 20.59 5.59 22 7l-13 13z"></path></svg>' : ''}
    </div>

    <div class="filter-menu-option" data-filter="request">
      <svg viewBox="0 0 24 24" width="24" height="24" fill="#0f1419" style="margin-right: 16px;"><path d="M17.5 7H17v-.25c0-2.76-2.24-5-5-5s-5 2.24-5 5V7h-.5C5.12 7 4 8.12 4 9.5v9c0 1.38 1.12 2.5 2.5 2.5h11c1.38 0 2.5-1.12 2.5-2.5v-9C20 8.12 18.88 7 17.5 7zM9 6.75c0-1.66 1.34-3 3-3s3 1.34 3 3V7H9v-.25zm9 11.75c0 .28-.22.5-.5.5h-11c-.28 0-.5-.22-.5-.5v-9c0-.28.22-.5.5-.5h11c.28 0 .5.22.5.5v9zm-7-4c0 .55-.45 1-1 1s-1-.45-1-1 .45-1 1-1 1 .45 1 1zm3 0c0 .55-.45 1-1 1s-1-.45-1-1 .45-1 1-1 1 .45 1 1zm3 0c0 .55-.45 1-1 1s-1-.45-1-1 .45-1 1-1 1 .45 1 1z"></path></svg>
      <div style="flex: 1; color: #0f1419; font-size: 15px; font-weight: 500;">请求</div>
      ${currentFilter === 'request' ? '<svg viewBox="0 0 24 24" width="20" height="20" fill="#1d9bf0"><path d="M9 20l-7-7 1.41-1.41L9 17.17 20.59 5.59 22 7l-13 13z"></path></svg>' : ''}
    </div>

    <div style="height: 1px; background: #eff3f4; margin: 8px 0;"></div>

    <div class="filter-menu-option" data-action="settings">
      <svg viewBox="0 0 24 24" width="24" height="24" fill="#0f1419" style="margin-right: 16px;"><path d="M10.54 1.75h2.92l1.57 2.36c.11.17.32.25.53.21l2.53-.59 2.17 2.17-.58 2.54c-.05.2.04.41.21.53l2.36 1.57v2.92l-2.36 1.57c-.17.12-.26.33-.21.53l.58 2.54-2.17 2.17-2.53-.59c-.21-.04-.42.04-.53.21l-1.57 2.36h-2.92l-1.58-2.36c-.11-.17-.32-.25-.52-.21l-2.54.59-2.17-2.17.58-2.54c.05-.2-.03-.41-.21-.53l-2.35-1.57v-2.92L4.1 8.97c.18-.12.26-.33.21-.53L3.73 5.9 5.9 3.73l2.54.59c.2.04.41-.04.52-.21l1.58-2.36zm1.07 2l-.98 1.47C10.05 6.08 9 6.5 7.99 6.27l-1.46-.34-.6.6.33 1.46c.24 1.01-.18 2.07-1.05 2.64l-1.46.98v.78l1.46.98c.87.57 1.29 1.63 1.05 2.64l-.33 1.46.6.6 1.46-.34c1.01-.23 2.06.19 2.64 1.05l.98 1.47h.78l.97-1.47c.58-.86 1.63-1.28 2.65-1.05l1.45.34.61-.6-.34-1.46c-.23-1.01.18-2.07 1.05-2.64l1.47-.98v-.78l-1.47-.98c-.87-.57-1.28-1.63-1.05-2.64l.34-1.46-.61-.6-1.45.34c-1.02.23-2.07-.19-2.65-1.05l-.97-1.47h-.78zM12 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5c.82 0 1.5-.67 1.5-1.5s-.68-1.5-1.5-1.5zM8.5 12c0-1.93 1.56-3.5 3.5-3.5 1.93 0 3.5 1.57 3.5 3.5s-1.57 3.5-3.5 3.5c-1.94 0-3.5-1.57-3.5-3.5z"></path></svg>
      <div style="flex: 1; color: #0f1419; font-size: 15px; font-weight: 500;">设置</div>
    </div>

    <div style="height: 1px; background: #eff3f4; margin: 8px 0;"></div>

    <div class="filter-menu-option" data-action="mark-read">
      <svg viewBox="0 0 24 24" width="24" height="24" fill="#0f1419" style="margin-right: 16px;"><path d="M9 20l-7-7 1.41-1.41L9 17.17 20.59 5.59 22 7l-13 13z"></path></svg>
      <div style="flex: 1; color: #0f1419; font-size: 15px; font-weight: 500;">全部标记为已读</div>
    </div>

    <style>
      .filter-menu-option {
        display: flex;
        align-items: center;
        padding: 16px;
        cursor: pointer;
        transition: background 0.2s;
      }

      .filter-menu-option:hover {
        background: rgba(0, 0, 0, 0.03);
      }
    </style>
  `;

  overlay.appendChild(menu);
  document.body.appendChild(overlay);

  // 绑定选项点击事件
  menu.querySelectorAll('.filter-menu-option').forEach(option => {
    option.addEventListener('click', () => {
      const filter = option.dataset.filter;
      const action = option.dataset.action;

      if (filter) {
        // 特殊处理：点击"请求"显示请求页面
        if (filter === 'request') {
          document.body.removeChild(overlay);
          showMessageRequestsPage();
          return;
        }

        // 更新筛选状态
        twitterData.messageFilter = filter;

        // 更新按钮文字
        const filterBtn = document.getElementById('messages-filter-btn');
        const filterNames = {
          'all': '全部',
          'unread': '未读',
          'direct': '直接',
          'group': '群组',
          'request': '请求'
        };
        filterBtn.querySelector('span').textContent = filterNames[filter];

        // 重新渲染消息列表
        const messagesEl = document.getElementById('messages-list');
        const conversations = Object.values(twitterData.conversations);

        let filtered = conversations;

        if (filter === 'unread') {
          filtered = conversations.filter(c => c.unread);
        } else if (filter === 'direct') {
          filtered = conversations.filter(c => !c.isGroup);
        } else if (filter === 'group') {
          filtered = conversations.filter(c => c.isGroup);
        }

        if (filtered.length === 0) {
          const welcomeEl = document.getElementById('messages-welcome');
          if (welcomeEl) welcomeEl.style.display = 'block';
          if (messagesEl) messagesEl.style.display = 'none';
        } else {
          const welcomeEl = document.getElementById('messages-welcome');
          if (welcomeEl) welcomeEl.style.display = 'none';
          if (messagesEl) messagesEl.style.display = 'block';

          messagesEl.innerHTML = filtered.sort((a, b) => {
            const aLast = a.messages[a.messages.length - 1]?.timestamp || 0;
            const bLast = b.messages[b.messages.length - 1]?.timestamp || 0;
            return bLast - aLast;
          }).map(conv => {
            const user = twitterData.users[conv.userId];
            if (!user) return '';

            const lastMsg = conv.messages[conv.messages.length - 1];
            return `
              <div class="message-item" data-user-id="${user.id}">
                <img class="message-avatar" src="${user.avatar}" alt="">
                <div class="message-info">
                  <div class="message-header">
                    <div class="message-name">${user.name}</div>
                    <div class="message-time">${getTimeAgo(lastMsg.timestamp)}</div>
                  </div>
                  <div class="message-preview">${escapeHtml(lastMsg.content)}</div>
                </div>
                ${conv.unread ? '<div class="message-unread-dot"></div>' : ''}
              </div>
            `;
          }).join('');

          // 重新绑定点击事件
          messagesEl.querySelectorAll('.message-item').forEach(item => {
            item.addEventListener('click', () => {
              const userId = item.dataset.userId;
              openChat(userId, window.roche);
            });
          });
        }

        document.body.removeChild(overlay);
        // 移除 Toast 提示
      } else if (action === 'settings') {
        document.body.removeChild(overlay);
        switchView('settings');
      } else if (action === 'mark-read') {
        // 全部标记为已读
        Object.values(twitterData.conversations).forEach(conv => {
          conv.unread = false;
        });
        saveData(window.roche);
        document.body.removeChild(overlay);
        showToast('已全部标记为已读', 'success');
        renderMessages(window.roche);
      }
    });
  });

  // 点击遮罩层关闭
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      document.body.removeChild(overlay);
    }
  });
}

/**
 * 显示私信请求页面（Char 匹配系统）
 */
function showMessageRequestsPage() {
  // 隐藏私信列表页
  const messagesListView = document.getElementById('messages-list-view');
  if (messagesListView) {
    messagesListView.style.display = 'none';
  }

  // 创建请求页面
  const requestsPage = document.createElement('div');
  requestsPage.id = 'message-requests-page';
  requestsPage.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: white;
    z-index: 200;
    display: flex;
    flex-direction: column;
  `;

  requestsPage.innerHTML = `
    <!-- 顶部栏 -->
    <div style="position: fixed; top: env(safe-area-inset-top); left: 0; right: 0; height: 60px; background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(12px); border-bottom: 1px solid #eff3f4; display: flex; align-items: center; padding: 0 16px; z-index: 100; max-width: 768px; margin: 0 auto;">
      <div id="requests-back-btn" style="width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 50%; cursor: pointer; transition: background 0.2s; margin-right: 24px;">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="#0f1419"><path d="M7.414 13l5.043 5.04-1.414 1.42L3.586 12l7.457-7.46 1.414 1.42L7.414 11H21v2H7.414z"></path></svg>
      </div>
      <div style="font-size: 20px; font-weight: 700; color: #0f1419;">私信请求</div>
    </div>

    <!-- 标签栏 -->
    <div style="position: fixed; top: calc(60px + env(safe-area-inset-top)); left: 0; right: 0; display: flex; background: white; border-bottom: 1px solid #eff3f4; z-index: 99; max-width: 768px; margin: 0 auto;">
      <div class="request-tab active" data-tab="priority" style="flex: 1; text-align: center; padding: 16px; font-size: 15px; font-weight: 700; color: #0f1419; cursor: pointer; position: relative; border-bottom: 3px solid #1d9bf0;">
        优先
      </div>
      <div class="request-tab" data-tab="hidden" style="flex: 1; text-align: center; padding: 16px; font-size: 15px; font-weight: 700; color: #536471; cursor: pointer; position: relative; border-bottom: 3px solid transparent;">
        已隐藏
      </div>
    </div>

    <!-- 内容区域 -->
    <div style="margin-top: calc(120px + env(safe-area-inset-top)); flex: 1; overflow-y: auto;">
      <!-- 优先标签内容 -->
      <div id="priority-content" class="tab-content">
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 40px; text-align: center;">
          <div style="width: 96px; height: 96px; border-radius: 50%; background: #eff3f4; display: flex; align-items: center; justify-content: center; margin-bottom: 24px;">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="#536471">
              <path d="M1.998 5.5c0-1.381 1.119-2.5 2.5-2.5h15c1.381 0 2.5 1.119 2.5 2.5v13c0 1.381-1.119 2.5-2.5 2.5h-15c-1.381 0-2.5-1.119-2.5-2.5v-13zm2.5-.5c-.276 0-.5.224-.5.5v.511l8.5 5.312 8.5-5.312v-.511c0-.276-.224-.5-.5-.5h-15zm-.5 2.49v10.51c0 .276.224.5.5.5h15c.276 0 .5-.224.5-.5v-10.51l-7.928 4.954c-.32.2-.73.2-1.05 0l-7.928-4.955z"></path>
              <path d="M20 10l2 2-2 2" stroke="#536471" stroke-width="1.5" fill="none"></path>
            </svg>
          </div>
          <div style="font-size: 31px; font-weight: 800; color: #0f1419; margin-bottom: 8px;">无私信请求</div>
          <div style="font-size: 15px; color: #536471; line-height: 20px;">你暂无来自自己社交圈账号的私信请求</div>
        </div>
      </div>

      <!-- 已隐藏标签内容 -->
      <div id="hidden-content" class="tab-content" style="display: none;">
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 40px; text-align: center;">
          <div style="width: 96px; height: 96px; border-radius: 50%; background: #eff3f4; display: flex; align-items: center; justify-content: center; margin-bottom: 24px;">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="#536471">
              <path d="M1.998 5.5c0-1.381 1.119-2.5 2.5-2.5h15c1.381 0 2.5 1.119 2.5 2.5v13c0 1.381-1.119 2.5-2.5 2.5h-15c-1.381 0-2.5-1.119-2.5-2.5v-13zm2.5-.5c-.276 0-.5.224-.5.5v.511l8.5 5.312 8.5-5.312v-.511c0-.276-.224-.5-.5-.5h-15zm-.5 2.49v10.51c0 .276.224.5.5.5h15c.276 0 .5-.224.5-.5v-10.51l-7.928 4.954c-.32.2-.73.2-1.05 0l-7.928-4.955z"></path>
            </svg>
          </div>
          <div style="font-size: 31px; font-weight: 800; color: #0f1419; margin-bottom: 8px;">无隐藏请求</div>
          <div style="font-size: 15px; color: #536471; line-height: 20px;">隐藏的私信请求将显示在这里</div>
        </div>
      </div>
    </div>

    <style>
      .request-tab:hover {
        background: rgba(0, 0, 0, 0.03);
      }

      .request-tab.active {
        color: #0f1419;
        border-bottom-color: #1d9bf0 !important;
      }

      #requests-back-btn:hover {
        background: rgba(0, 0, 0, 0.05);
      }
    </style>
  `;

  document.body.appendChild(requestsPage);

  // 返回按钮事件
  const backBtn = requestsPage.querySelector('#requests-back-btn');
  backBtn.addEventListener('click', () => {
    document.body.removeChild(requestsPage);
    if (messagesListView) {
      messagesListView.style.display = 'block';
    }
    // 恢复筛选按钮为"全部"
    const filterBtn = document.getElementById('messages-filter-btn');
    if (filterBtn) {
      filterBtn.querySelector('span').textContent = '全部';
    }
    twitterData.messageFilter = 'all';
  });

  // 标签切换事件
  const tabs = requestsPage.querySelectorAll('.request-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.dataset.tab;

      // 更新标签样式
      tabs.forEach(t => {
        t.classList.remove('active');
        t.style.color = '#536471';
        t.style.borderBottomColor = 'transparent';
      });
      tab.classList.add('active');
      tab.style.color = '#0f1419';
      tab.style.borderBottomColor = '#1d9bf0';

      // 切换内容
      const priorityContent = requestsPage.querySelector('#priority-content');
      const hiddenContent = requestsPage.querySelector('#hidden-content');

      if (targetTab === 'priority') {
        priorityContent.style.display = 'block';
        hiddenContent.style.display = 'none';
      } else {
        priorityContent.style.display = 'none';
        hiddenContent.style.display = 'block';
      }
    });
  });
}

/**
 * 显示新建私信对话框
 */
async function showNewMessageDialog(roche) {
  // 获取对话角色列表（char）
  const conversations = await roche.conversation.list();

  // 为每个对话获取记忆摘要
  const conversationsWithInfo = await Promise.all(conversations.map(async (conv) => {
    try {
      // 获取长期记忆
      const longTerm = await roche.memory.getLongTerm({ conversationId: conv.id, limit: 5 });
      const memories = [...(longTerm.facts || []), ...(longTerm.vectors || [])];
      const memorySummary = memories.length > 0
        ? (memories[0].summaryText || memories[0].text || '').substring(0, 50)
        : '暂无记忆';

      return {
        ...conv,
        memorySummary,
        avatar: null // 先设为 null，后续可以从记忆中提取
      };
    } catch (e) {
      return {
        ...conv,
        memorySummary: '暂无记忆',
        avatar: null
      };
    }
  }));

  // 创建遮罩层
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    animation: fadeIn 0.2s;
    padding: 20px;
  `;

  // 创建对话框
  const dialog = document.createElement('div');
  dialog.style.cssText = `
    background: white;
    border-radius: 16px;
    width: 100%;
    max-width: 600px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    animation: scaleIn 0.2s;
  `;

  dialog.innerHTML = `
    <div style="padding: 16px; border-bottom: 1px solid #eff3f4; display: flex; align-items: center; justify-content: space-between;">
      <div style="font-size: 20px; font-weight: 700; color: #0f1419;">新建私信</div>
      <div class="dialog-close-btn" style="width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 50%; cursor: pointer; transition: background 0.2s;">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="#0f1419"><path d="M10.59 12L4.54 5.96l1.42-1.42L12 10.59l6.04-6.05 1.42 1.42L13.41 12l6.05 6.04-1.42 1.42L12 13.41l-6.04 6.05-1.42-1.42L10.59 12z"></path></svg>
      </div>
    </div>

    <div style="padding: 16px; border-bottom: 1px solid #eff3f4;">
      <div style="display: flex; align-items: center; background: #eff3f4; border-radius: 24px; padding: 10px 16px; gap: 12px;">
        ${icons.search}
        <input type="text" placeholder="搜索对话" id="new-message-search" style="flex: 1; background: transparent; border: none; outline: none; font-size: 15px; color: #0f1419;">
      </div>
    </div>

    <div style="flex: 1; overflow-y: auto;" id="contact-list">
      ${conversationsWithInfo.map(conv => {
        const initial = conv.title ? conv.title.charAt(0).toUpperCase() : '?';
        return `
        <div class="contact-item" data-conv-id="${conv.id}" style="padding: 16px; display: flex; align-items: center; gap: 12px; cursor: pointer; transition: background 0.2s;">
          <div style="width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; color: white; font-size: 20px; font-weight: 700;">
            ${initial}
          </div>
          <div style="flex: 1; min-width: 0;">
            <div style="font-size: 15px; font-weight: 700; color: #0f1419;">${conv.title || '未命名对话'}</div>
            <div style="font-size: 13px; color: #536471; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${conv.memorySummary}</div>
          </div>
        </div>
      `}).join('')}
    </div>

    <style>
      @keyframes scaleIn {
        from { transform: scale(0.9); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
      }

      .dialog-close-btn:hover {
        background: rgba(0, 0, 0, 0.05);
      }

      .contact-item:hover {
        background: rgba(0, 0, 0, 0.03);
      }
    </style>
  `;

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  // 绑定关闭按钮
  dialog.querySelector('.dialog-close-btn').addEventListener('click', () => {
    document.body.removeChild(overlay);
  });

  // 绑定搜索功能
  const searchInput = dialog.querySelector('#new-message-search');
  const contactList = dialog.querySelector('#contact-list');

  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const contacts = contactList.querySelectorAll('.contact-item');

    contacts.forEach(contact => {
      const name = contact.querySelector('div > div:first-child').textContent.toLowerCase();
      const username = contact.querySelector('div > div:last-child').textContent.toLowerCase();

      if (name.includes(query) || username.includes(query)) {
        contact.style.display = 'flex';
      } else {
        contact.style.display = 'none';
      }
    });
  });

  // 绑定联系人点击事件
  dialog.querySelectorAll('.contact-item').forEach(item => {
    item.addEventListener('click', () => {
      const convId = item.dataset.convId;

      // 关闭对话框
      document.body.removeChild(overlay);

      // 打开聊天界面（使用对话 ID）
      openChatWithConv(convId, roche);
    });
  });

  // 点击遮罩层关闭
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      document.body.removeChild(overlay);
    }
  });
}

/**
 * 打开聊天界面
 */
function openChat(userId, roche) {
  currentChatUser = userId;
  const user = twitterData.users[userId];
  const conversation = twitterData.conversations[userId];

  // 标记为已读
  if (conversation) {
    conversation.unread = false;
  }

  // 更新聊天头部
  document.getElementById('chat-user-name').textContent = user.name;

  // 渲染消息
  const chatMessages = document.getElementById('chat-messages');
  chatMessages.innerHTML = conversation.messages.map(msg => {
    const isOwn = msg.from === currentUser;
    const msgUser = twitterData.users[msg.from];
    return `
      <div class="chat-message ${isOwn ? 'own' : ''}">
        <img class="chat-message-avatar" src="${msgUser.avatar}" alt="">
        <div class="chat-message-bubble">${escapeHtml(msg.content)}</div>
      </div>
    `;
  }).join('');

  // 滚动到底部
  setTimeout(() => {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }, 100);

  // 显示聊天界面
  const messagesListView = document.getElementById('messages-list-view');
  const chatView = document.getElementById('chat-view');
  if (messagesListView) {
    messagesListView.classList.add('hidden');
  }
  if (chatView) {
    chatView.classList.add('active');
  }
}

/**
 * 使用 conversationId 打开聊天界面（连接到 Roche Char）
 */
let currentConversationId = null;

async function openChatWithConv(convId, roche) {
  try {
    currentConversationId = convId;

    // 获取对话信息
    const conversations = await roche.conversation.list();
    const conv = conversations.find(c => c.id === convId);

    if (!conv) {
      showToast('对话不存在', 'error');
      return;
    }

    // 更新聊天头部
    document.getElementById('chat-user-name').textContent = conv.title || '未命名对话';

    // 获取聊天历史（通过 Roche 的对话记忆）
    const longTerm = await roche.memory.getLongTerm({ conversationId: convId, limit: 50 });
    const memories = [...(longTerm.facts || []), ...(longTerm.vectors || [])];

    // 渲染消息（从记忆中提取）
    const chatMessages = document.getElementById('chat-messages');

    if (memories.length === 0) {
      chatMessages.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: #536471;">
          <div style="font-size: 15px; margin-bottom: 8px;">还没有聊天记录</div>
          <div style="font-size: 13px;">发送第一条消息开始对话</div>
        </div>
      `;
    } else {
      // 从记忆中构建消息列表
      chatMessages.innerHTML = memories.map((mem, idx) => {
        const text = mem.summaryText || mem.text || '';
        const isOwn = idx % 2 === 0; // 简化处理：交替显示

        return `
          <div class="chat-message ${isOwn ? 'own' : ''}" style="margin-bottom: 16px;">
            <div class="chat-message-bubble" style="
              background: ${isOwn ? '#1d9bf0' : '#eff3f4'};
              color: ${isOwn ? 'white' : '#0f1419'};
              padding: 12px 16px;
              border-radius: 18px;
              max-width: 70%;
              word-wrap: break-word;
              ${isOwn ? 'margin-left: auto;' : 'margin-right: auto;'}
            ">${escapeHtml(text)}</div>
          </div>
        `;
      }).join('');
    }

    // 滚动到底部
    setTimeout(() => {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }, 100);

    // 显示聊天界面
    const messagesListView = document.getElementById('messages-list-view');
    const chatView = document.getElementById('chat-view');
    if (messagesListView) {
      messagesListView.classList.add('hidden');
    }
    if (chatView) {
      chatView.classList.add('active');
    }

    // 绑定发送按钮（如果还没绑定）
    const chatInput = document.getElementById('chat-input');
    const chatSendBtn = document.getElementById('chat-send-btn');

    if (chatInput && chatSendBtn) {
      // 移除旧的事件监听器
      const newChatInput = chatInput.cloneNode(true);
      chatInput.parentNode.replaceChild(newChatInput, chatInput);
      const newChatSendBtn = chatSendBtn.cloneNode(true);
      chatSendBtn.parentNode.replaceChild(newChatSendBtn, chatSendBtn);

      // 输入框事件
      newChatInput.addEventListener('input', () => {
        newChatSendBtn.disabled = !newChatInput.value.trim();
      });

      newChatInput.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter' && newChatInput.value.trim()) {
          await sendMessageToConv(roche, newChatInput.value.trim());
          newChatInput.value = '';
          newChatSendBtn.disabled = true;
        }
      });

      // 发送按钮事件
      newChatSendBtn.addEventListener('click', async () => {
        if (newChatInput.value.trim()) {
          await sendMessageToConv(roche, newChatInput.value.trim());
          newChatInput.value = '';
          newChatSendBtn.disabled = true;
        }
      });
    }

  } catch (error) {
    console.error('打开聊天失败:', error);
    showToast('加载聊天失败', 'error');
  }
}

/**
 * 发送消息到 Roche 对话
 */
async function sendMessageToConv(roche, content) {
  if (!content || !currentConversationId) return;

  try {
    // 使用 Roche 的 AI 聊天 API 发送消息
    const response = await roche.ai.chat({
      conversationId: currentConversationId,
      message: content,
      stream: false
    });

    // 保存到记忆
    if (settings.enableMemory) {
      await roche.memory.saveLongTerm({
        conversationId: currentConversationId,
        text: `用户: ${content}\nAI: ${response.text || ''}`,
        importance: 5
      });
    }

    // 重新加载聊天界面
    await openChatWithConv(currentConversationId, roche);

    showToast('消息已发送', 'success');
  } catch (error) {
    console.error('发送消息失败:', error);
    showToast('发送失败', 'error');
  }
}

/**
 * 发送消息
 */
async function sendMessage(roche, content) {
  if (!content || !currentChatUser) return;

  const conversation = twitterData.conversations[currentChatUser];
  if (!conversation) return;

  const message = {
    id: Date.now(),
    from: currentUser,
    content: content,
    timestamp: Date.now()
  };

  conversation.messages.push(message);
  await saveData(roche);

  // 重新渲染聊天
  openChat(currentChatUser, roche);

  showToast('消息已发送', 'success');
}

/**
 * 显示侧边栏菜单（点击头像）
 */
function showSidebar(roche) {
  const currentUserData = twitterData.users[currentUser];
  if (!currentUserData) return;

  // 创建遮罩层
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 10000;
    animation: fadeIn 0.2s;
  `;

  // 创建侧边栏
  const sidebar = document.createElement('div');
  sidebar.style.cssText = `
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    width: 280px;
    max-width: 80%;
    background: white;
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.15);
    display: flex;
    flex-direction: column;
    animation: slideInLeft 0.3s;
    overflow-y: auto;
  `;

  // 获取所有可切换的用户
  const allUsers = Object.values(twitterData.users).filter(u => u.isPersona);

  sidebar.innerHTML = `
    <div style="padding: 16px; border-bottom: 1px solid #eff3f4;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
        <div style="font-size: 20px; font-weight: 700; color: #0f1419;">账号信息</div>
        <div class="sidebar-close-btn" style="width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 50%; cursor: pointer; transition: background 0.2s;">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="#0f1419"><path d="M10.59 12L4.54 5.96l1.42-1.42L12 10.59l6.04-6.05 1.42 1.42L13.41 12l6.05 6.04-1.42 1.42L12 13.41l-6.04 6.05-1.42-1.42L10.59 12z"></path></svg>
        </div>
      </div>

      <!-- 当前用户信息 -->
      <div style="margin-bottom: 12px;">
        <img src="${currentUserData.avatar}" style="width: 40px; height: 40px; border-radius: 50%; margin-bottom: 4px;" alt="">
        <div style="font-size: 15px; font-weight: 700; color: #0f1419;">${currentUserData.name}</div>
        <div style="font-size: 15px; color: #536471;">${currentUserData.username}</div>
      </div>

      <!-- 关注信息 -->
      <div style="display: flex; gap: 16px; font-size: 14px;">
        <div>
          <span style="font-weight: 700; color: #0f1419;">${twitterData.follows[currentUser]?.length || 0}</span>
          <span style="color: #536471;"> 正在关注</span>
        </div>
        <div>
          <span style="font-weight: 700; color: #0f1419;">${Object.values(twitterData.follows).filter(list => list.includes(currentUser)).length}</span>
          <span style="color: #536471;"> 关注者</span>
        </div>
      </div>
    </div>

    <!-- 菜单选项 -->
    <div style="flex: 1;">
      <div class="sidebar-menu-item" data-action="profile">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="#0f1419" style="margin-right: 16px;"><path d="M5.651 19h12.698c-.337-1.8-1.023-3.21-1.945-4.19C15.318 13.65 13.838 13 12 13s-3.317.65-4.404 1.81c-.922.98-1.608 2.39-1.945 4.19zm.486-5.56C7.627 11.85 9.648 11 12 11s4.373.85 5.863 2.44c1.477 1.58 2.366 3.8 2.632 6.46l.11 1.1H3.395l.11-1.1c.266-2.66 1.155-4.88 2.632-6.46zM12 4c-1.105 0-2 .9-2 2s.895 2 2 2 2-.9 2-2-.895-2-2-2zM8 6c0-2.21 1.791-4 4-4s4 1.79 4 4-1.791 4-4 4-4-1.79-4-4z"></path></svg>
        <span>个人资料</span>
      </div>

      <div class="sidebar-menu-item" data-action="bookmarks">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="#0f1419" style="margin-right: 16px;"><path d="M4 4.5C4 3.12 5.119 2 6.5 2h11C18.881 2 20 3.12 20 4.5v18.44l-8-5.71-8 5.71V4.5zM6.5 4c-.276 0-.5.224-.5.5v14.56l6-4.29 6 4.29V4.5c0-.276-.224-.5-.5-.5h-11z"></path></svg>
        <span>书签</span>
      </div>

      <div class="sidebar-menu-item" data-action="lists">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="#0f1419" style="margin-right: 16px;"><path d="M3 4.5C3 3.12 4.12 2 5.5 2h13C19.88 2 21 3.12 21 4.5v15c0 1.38-1.12 2.5-2.5 2.5h-13C4.12 22 3 20.88 3 19.5v-15zM5.5 4c-.28 0-.5.22-.5.5v15c0 .28.22.5.5.5h13c.28 0 .5-.22.5-.5v-15c0-.28-.22-.5-.5-.5h-13zM16 10H8V8h8v2zm-8 2h8v2H8v-2z"></path></svg>
        <span>列表</span>
      </div>

      <div style="height: 1px; background: #eff3f4; margin: 8px 0;"></div>

      <div class="sidebar-menu-item" data-action="settings">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="#0f1419" style="margin-right: 16px;"><path d="M10.54 1.75h2.92l1.57 2.36c.11.17.32.25.53.21l2.53-.59 2.17 2.17-.58 2.54c-.05.2.04.41.21.53l2.36 1.57v2.92l-2.36 1.57c-.17.12-.26.33-.21.53l.58 2.54-2.17 2.17-2.53-.59c-.21-.04-.42.04-.53.21l-1.57 2.36h-2.92l-1.58-2.36c-.11-.17-.32-.25-.52-.21l-2.54.59-2.17-2.17.58-2.54c.05-.2-.03-.41-.21-.53l-2.35-1.57v-2.92L4.1 8.97c.18-.12.26-.33.21-.53L3.73 5.9 5.9 3.73l2.54.59c.2.04.41-.04.52-.21l1.58-2.36zm1.07 2l-.98 1.47C10.05 6.08 9 6.5 7.99 6.27l-1.46-.34-.6.6.33 1.46c.24 1.01-.18 2.07-1.05 2.64l-1.46.98v.78l1.46.98c.87.57 1.29 1.63 1.05 2.64l-.33 1.46.6.6 1.46-.34c1.01-.23 2.06.19 2.64 1.05l.98 1.47h.78l.97-1.47c.58-.86 1.63-1.28 2.65-1.05l1.45.34.61-.6-.34-1.46c-.23-1.01.18-2.07 1.05-2.64l1.47-.98v-.78l-1.47-.98c-.87-.57-1.28-1.63-1.05-2.64l.34-1.46-.61-.6-1.45.34c-1.02.23-2.07-.19-2.65-1.05l-.97-1.47h-.78zM12 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5c.82 0 1.5-.67 1.5-1.5s-.68-1.5-1.5-1.5zM8.5 12c0-1.93 1.56-3.5 3.5-3.5 1.93 0 3.5 1.57 3.5 3.5s-1.57 3.5-3.5 3.5c-1.94 0-3.5-1.57-3.5-3.5z"></path></svg>
        <span>设置和隐私</span>
      </div>

      ${allUsers.length > 1 ? `
        <div style="height: 1px; background: #eff3f4; margin: 8px 0;"></div>
        <div style="padding: 12px 16px; color: #536471; font-size: 13px; font-weight: 700;">切换账号</div>
        ${allUsers.filter(u => u.id !== currentUser).map(user => `
          <div class="sidebar-menu-item sidebar-user-item" data-user-id="${user.id}">
            <img src="${user.avatar}" style="width: 32px; height: 32px; border-radius: 50%; margin-right: 12px;" alt="">
            <div style="flex: 1;">
              <div style="font-size: 15px; font-weight: 700; color: #0f1419;">${user.name}</div>
              <div style="font-size: 13px; color: #536471;">${user.username}</div>
            </div>
          </div>
        `).join('')}
      ` : ''}
    </div>

    <style>
      @keyframes slideInLeft {
        from { transform: translateX(-100%); }
        to { transform: translateX(0); }
      }

      .sidebar-close-btn:hover {
        background: rgba(0, 0, 0, 0.05);
      }

      .sidebar-menu-item {
        display: flex;
        align-items: center;
        padding: 16px;
        cursor: pointer;
        transition: background 0.2s;
        font-size: 15px;
        font-weight: 500;
        color: #0f1419;
      }

      .sidebar-menu-item:hover {
        background: rgba(0, 0, 0, 0.03);
      }
    </style>
  `;

  overlay.appendChild(sidebar);
  document.body.appendChild(overlay);

  // 绑定关闭按钮
  sidebar.querySelector('.sidebar-close-btn').addEventListener('click', () => {
    document.body.removeChild(overlay);
  });

  // 绑定菜单项点击
  sidebar.querySelectorAll('.sidebar-menu-item').forEach(item => {
    item.addEventListener('click', () => {
      const action = item.dataset.action;
      const userId = item.dataset.userId;

      document.body.removeChild(overlay);

      if (action === 'profile') {
        showProfile(currentUser, roche);
      } else if (action === 'bookmarks') {
        showToast('书签功能开发中...', 'info');
      } else if (action === 'lists') {
        showToast('列表功能开发中...', 'info');
      } else if (action === 'settings') {
        switchView('settings');
      } else if (userId) {
        // 切换账号
        currentUser = userId;
        saveData(roche);
        showToast(`已切换到 ${twitterData.users[userId].name}`, 'success');
        // 刷新当前页面
        const currentView = document.querySelector('.page-view:not([style*="display: none"])');
        if (currentView) {
          const viewId = currentView.id;
          if (viewId === 'timeline-view') {
            renderTimeline(roche);
          } else if (viewId === 'search-view') {
            renderSearch(roche);
          } else if (viewId === 'notifications-view') {
            renderNotifications(roche);
          } else if (viewId === 'messages-view') {
            renderMessages(roche);
          }
        }
      }
    });
  });

  // 点击遮罩层关闭
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      document.body.removeChild(overlay);
    }
  });
}

/**
 * 显示个人资料页
 */
function showProfile(userId, roche) {
  const user = twitterData.users[userId];
  if (!user) return;

  const isOwnProfile = userId === currentUser;
  const userTweets = twitterData.tweets.filter(t => t.userId === userId);

  // 更新头部信息
  document.getElementById('profile-header-name').textContent = user.name;
  document.getElementById('profile-header-tweets').textContent = `${userTweets.length} 推文`;

  // 更新个人信息
  document.getElementById('profile-avatar').src = user.avatar;
  document.getElementById('profile-name').textContent = user.name;
  document.getElementById('profile-username').textContent = user.username;
  document.getElementById('profile-bio').textContent = user.bio;
  document.getElementById('profile-joined').textContent = '加入于 2024年1月';
  document.getElementById('profile-following').textContent = user.following || 0;
  document.getElementById('profile-followers').textContent = user.followers || 0;

  // 设置按钮
  const actionBtn = document.getElementById('profile-action-btn');
  if (isOwnProfile) {
    actionBtn.textContent = '编辑资料';
    actionBtn.onclick = () => showToast('编辑功能开发中...', 'info');
  } else {
    const isFollowing = twitterData.follows[currentUser]?.includes(userId);
    actionBtn.textContent = isFollowing ? '正在关注' : '关注';
    actionBtn.className = `profile-edit-btn ${isFollowing ? 'following' : ''}`;
    actionBtn.onclick = async () => {
      await toggleFollow(userId, roche);
      showProfile(userId, roche);
    };
  }

  // 渲染推文列表
  const tweetsListEl = document.getElementById('profile-tweets-list');
  if (userTweets.length === 0) {
    tweetsListEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🐦</div>
        <div>还没有推文</div>
      </div>
    `;
  } else {
    tweetsListEl.innerHTML = userTweets.map(tweet => {
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

    // 绑定事件
    tweetsListEl.querySelectorAll('.tweet-item').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('.tweet-action')) return;
        const tweetId = parseInt(el.dataset.tweetId);
        showTweetDetail(tweetId, roche);
      });
    });

    tweetsListEl.querySelectorAll('.tweet-action').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = el.dataset.action;
        const tweetId = parseInt(el.closest('.tweet-item').dataset.tweetId);
        handleTweetAction(action, tweetId, roche);
      });
    });
  }

  // 绑定标签切换
  document.querySelectorAll('.profile-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const tabType = tab.dataset.tab;
      if (tabType !== 'tweets') {
        showToast('功能开发中...', 'info');
      }
    });
  });

  // 切换到个人资料视图
  switchView('profile');
}

/**
 * 显示设置页面
 */
function showSettings(roche) {
  // 绑定设置页返回按钮
  const backBtn = document.getElementById('settings-back-btn');
  if (backBtn) {
    backBtn.replaceWith(backBtn.cloneNode(true));
    document.getElementById('settings-back-btn').addEventListener('click', () => {
      switchView('timeline');
    });
  }

  // 加载当前设置
  const toggleMemory = document.getElementById('toggle-memory');
  const toggleSummary = document.getElementById('toggle-summary');

  if (toggleMemory) {
    toggleMemory.checked = settings.enableMemory;
    toggleMemory.replaceWith(toggleMemory.cloneNode(true));
    document.getElementById('toggle-memory').addEventListener('change', async (e) => {
      settings.enableMemory = e.target.checked;
      await saveSettings(roche);
      showToast(settings.enableMemory ? '已启用推文记忆' : '已禁用推文记忆', 'success');
    });
  }

  if (toggleSummary) {
    toggleSummary.checked = settings.autoSummary;
    toggleSummary.replaceWith(toggleSummary.cloneNode(true));
    document.getElementById('toggle-summary').addEventListener('change', async (e) => {
      settings.autoSummary = e.target.checked;
      await saveSettings(roche);
      showToast(settings.autoSummary ? '已启用自动总结' : '已禁用自动总结', 'success');
    });
  }

  // 绑定设置项点击
  const editProfile = document.getElementById('setting-edit-profile');
  if (editProfile) {
    editProfile.replaceWith(editProfile.cloneNode(true));
    document.getElementById('setting-edit-profile').addEventListener('click', () => {
      showToast('编辑个人资料功能开发中...', 'info');
    });
  }

  const privacy = document.getElementById('setting-privacy');
  if (privacy) {
    privacy.replaceWith(privacy.cloneNode(true));
    document.getElementById('setting-privacy').addEventListener('click', () => {
      showPrivacySettings(roche);
    });
  }

  const notifications = document.getElementById('setting-notifications');
  if (notifications) {
    notifications.replaceWith(notifications.cloneNode(true));
    document.getElementById('setting-notifications').addEventListener('click', () => {
      showToast('通知设置功能开发中...', 'info');
    });
  }

  const clearMemory = document.getElementById('setting-clear-memory');
  if (clearMemory) {
    clearMemory.replaceWith(clearMemory.cloneNode(true));
    document.getElementById('setting-clear-memory').addEventListener('click', async () => {
      if (confirm('确定要清除所有记忆吗？此操作无法撤销。')) {
        await clearAllMemories(roche);
        showToast('已清除所有记忆', 'success');
      }
    });
  }

  const about = document.getElementById('setting-about');
  if (about) {
    about.replaceWith(about.cloneNode(true));
    document.getElementById('setting-about').addEventListener('click', () => {
      showToast('Twitter 插件 v2.0.0 - AI 搜索 | 完整详情页 | 记忆集成', 'info');
    });
  }

  // 切换到设置视图
  switchView('settings');
}

/**
 * 显示设置和隐私页面
 */
function showPrivacySettings(roche) {
  // 绑定返回按钮
  const backBtn = document.getElementById('privacy-settings-back-btn');
  if (backBtn) {
    backBtn.replaceWith(backBtn.cloneNode(true)); // 移除旧事件
    document.getElementById('privacy-settings-back-btn').addEventListener('click', () => {
      switchView('settings');
    });
  }

  // 绑定账号信息
  const accountInfo = document.getElementById('setting-account-info');
  if (accountInfo) {
    accountInfo.replaceWith(accountInfo.cloneNode(true));
    document.getElementById('setting-account-info').addEventListener('click', () => {
      showToast('账号信息功能开发中...', 'info');
    });
  }

  // 绑定切换账号
  const switchAccount = document.getElementById('setting-switch-account');
  if (switchAccount) {
    switchAccount.replaceWith(switchAccount.cloneNode(true));
    document.getElementById('setting-switch-account').addEventListener('click', () => {
      showSwitchAccount(roche);
    });
  }

  // 绑定停用账号
  const deactivateAccount = document.getElementById('setting-deactivate-account');
  if (deactivateAccount) {
    deactivateAccount.replaceWith(deactivateAccount.cloneNode(true));
    document.getElementById('setting-deactivate-account').addEventListener('click', () => {
      showToast('停用账号功能开发中...', 'info');
    });
  }

  // 绑定广告偏好
  const adPreferences = document.getElementById('setting-ad-preferences');
  if (adPreferences) {
    adPreferences.replaceWith(adPreferences.cloneNode(true));
    document.getElementById('setting-ad-preferences').addEventListener('click', () => {
      showToast('广告偏好设置功能开发中...', 'info');
    });
  }

  // 绑定数据共享
  const dataSharing = document.getElementById('setting-data-sharing');
  if (dataSharing) {
    dataSharing.replaceWith(dataSharing.cloneNode(true));
    document.getElementById('setting-data-sharing').addEventListener('click', () => {
      showToast('数据共享功能开发中...', 'info');
    });
  }

  // 绑定安全性
  const security = document.getElementById('setting-security');
  if (security) {
    security.replaceWith(security.cloneNode(true));
    document.getElementById('setting-security').addEventListener('click', () => {
      showToast('安全性功能开发中...', 'info');
    });
  }

  // 绑定密码
  const password = document.getElementById('setting-password');
  if (password) {
    password.replaceWith(password.cloneNode(true));
    document.getElementById('setting-password').addEventListener('click', () => {
      showToast('密码功能开发中...', 'info');
    });
  }

  // 切换到设置和隐私视图
  switchView('privacySettings');
}

/**
 * 显示切换账号页面
 */
async function showSwitchAccount(roche) {
  // 绑定返回按钮
  const backBtn = document.getElementById('switch-account-back-btn');
  backBtn.replaceWith(backBtn.cloneNode(true)); // 移除旧事件
  document.getElementById('switch-account-back-btn').addEventListener('click', () => {
    switchView('timeline');
  });

  // 先显示加载状态
  const currentAccountSection = document.getElementById('current-account-section');
  const otherAccountsSection = document.getElementById('other-accounts-section');

  currentAccountSection.innerHTML = '<div style="padding: 20px; text-align: center; color: #536471;">加载中...</div>';
  otherAccountsSection.innerHTML = '<div style="padding: 20px; text-align: center; color: #536471;">加载中...</div>';

  try {
    // 重新获取所有 Persona
    const allPersonas = await roche.persona.getUserPersonas();
    console.log('[Twitter] 获取到的所有 Persona:', allPersonas);

    if (!allPersonas || allPersonas.length === 0) {
      currentAccountSection.innerHTML = `
        <div style="padding: 40px 20px; text-align: center; color: #536471;">
          <div>没有找到任何账号</div>
          <div style="margin-top: 8px; font-size: 13px;">请先在 Roche 中创建 Persona</div>
        </div>
      `;
      otherAccountsSection.innerHTML = '';
      switchView('switchAccount');
      return;
    }

    // 更新 twitterData.users
    for (const persona of allPersonas) {
      if (!twitterData.users[persona.id]) {
        twitterData.users[persona.id] = {
          id: persona.id,
          name: persona.name,
          username: `@${persona.handle || persona.name}`,
          avatar: persona.avatar || generateAvatar(persona.name),
          bio: persona.bio || '',
          followers: 0,
          following: 0,
          conversationId: persona.conversationId,
          isPersona: true
        };
      } else {
        // 更新已存在的 Persona 信息
        twitterData.users[persona.id].name = persona.name;
        twitterData.users[persona.id].username = `@${persona.handle || persona.name}`;
        twitterData.users[persona.id].avatar = persona.avatar || generateAvatar(persona.name);
        twitterData.users[persona.id].bio = persona.bio || '';
      }
    }

    await saveData(roche);

    // 渲染当前账号
    const currentUserData = twitterData.users[currentUser];
    if (currentUserData) {
      currentAccountSection.innerHTML = `
        <div class="setting-item" style="padding: 16px;">
          <img src="${currentUserData.avatar}" style="width: 48px; height: 48px; border-radius: 50%; margin-right: 12px; vertical-align: middle;">
          <div style="display: inline-block; vertical-align: middle;">
            <div style="font-weight: 700; font-size: 15px; color: #0f1419;">${currentUserData.name}</div>
            <div style="font-size: 15px; color: #536471;">${currentUserData.username}</div>
          </div>
          <span style="float: right; color: #1d9bf0; font-size: 18px; margin-left: auto;">✓</span>
        </div>
      `;
    }

    // 渲染其他账号
    const otherPersonas = allPersonas.filter(p => p.id !== currentUser);

    if (otherPersonas.length === 0) {
      otherAccountsSection.innerHTML = `
        <div style="padding: 40px 20px; text-align: center; color: #536471;">
          <div>没有其他账号</div>
        </div>
      `;
    } else {
      otherAccountsSection.innerHTML = otherPersonas.map(persona => `
        <div class="setting-item account-switch-item" data-persona-id="${persona.id}" style="cursor: pointer;">
          <img src="${persona.avatar || generateAvatar(persona.name)}" style="width: 48px; height: 48px; border-radius: 50%; margin-right: 12px; vertical-align: middle;">
          <div style="display: inline-block; vertical-align: middle;">
            <div style="font-weight: 700; font-size: 15px; color: #0f1419;">${persona.name}</div>
            <div style="font-size: 15px; color: #536471;">@${persona.handle || persona.name}</div>
          </div>
          <div class="setting-arrow" style="margin-left: auto;">›</div>
        </div>
      `).join('');

      // 绑定切换事件
      otherAccountsSection.querySelectorAll('.account-switch-item').forEach(item => {
        item.addEventListener('click', async () => {
          const personaId = item.dataset.personaId;
          await switchPersona(personaId, roche);
          // 切换成功后返回主页
          switchView('timeline');
        });
      });
    }
  } catch (error) {
    console.error('[Twitter] 获取 Persona 失败:', error);
    currentAccountSection.innerHTML = `
      <div style="padding: 40px 20px; text-align: center; color: #f4212e;">
        <div>加载失败</div>
        <div style="margin-top: 8px; font-size: 13px;">${error.message}</div>
      </div>
    `;
    otherAccountsSection.innerHTML = '';
  }

  // 绑定刷新按钮
  const addAccountBtn = document.getElementById('add-account-btn');
  if (addAccountBtn) {
    addAccountBtn.replaceWith(addAccountBtn.cloneNode(true));
    document.getElementById('add-account-btn').addEventListener('click', async () => {
      showToast('正在刷新...', 'info');
      await showSwitchAccount(roche);
      showToast('已刷新', 'success');
    });
  }

  // 切换到切换账号视图
  switchView('switchAccount');
}

/**
 * 保存设置到存储
 */
async function saveSettings(roche) {
  await roche.storage.set('twitter_settings', JSON.stringify(settings));
}

/**
 * 加载设置
 */
async function loadSettings(roche) {
  const stored = await roche.storage.get('twitter_settings');
  if (stored) {
    settings = { ...settings, ...JSON.parse(stored) };
  }
}

/**
 * 保存推文到记忆系统
 */
async function saveTweetToMemory(tweet, roche) {
  if (!settings.enableMemory) return;

  try {
    const user = twitterData.users[tweet.userId];
    const content = `推文 by ${user.name} (@${user.username}): ${tweet.content}`;

    // 保存到当前 Persona 的会话记忆
    const conversationId = currentUser;

    // 使用 roche.memory.addFact 保存
    if (roche.memory && roche.memory.addFact) {
      await roche.memory.addFact({
        conversationId: conversationId,
        content: content,
        tags: ['twitter', 'tweet', 'post'],
        metadata: {
          tweetId: tweet.id,
          userId: tweet.userId,
          timestamp: tweet.timestamp
        }
      });
    }
  } catch (error) {
    console.error('保存推文到记忆失败:', error);
  }
}

/**
 * 自动总结对话（推文线程）
 */
async function summarizeConversation(tweet, replies, roche) {
  if (!settings.autoSummary) return;

  try {
    // 构建对话内容
    const user = twitterData.users[tweet.userId];
    let conversationText = `原推文 by ${user.name}: ${tweet.content}\n\n回复:\n`;

    replies.forEach(reply => {
      const replyUser = twitterData.users[reply.userId];
      conversationText += `- ${replyUser.name}: ${reply.content}\n`;
    });

    // 使用 AI 总结（如果有足够的回复）
    if (replies.length >= 2 && roche.ai && roche.ai.chat) {
      const response = await roche.ai.chat({
        messages: [
          { role: 'user', content: `请简要总结这个推文对话（50字以内）:\n${conversationText}` }
        ]
      });

      const summary = response.content || '对话总结';

      // 保存总结到记忆
      if (roche.memory && roche.memory.addFact) {
        await roche.memory.addFact({
          conversationId: currentUser,
          content: `对话总结: ${summary}`,
          tags: ['twitter', 'summary', 'conversation'],
          metadata: {
            tweetId: tweet.id,
            replyCount: replies.length,
            timestamp: Date.now()
          }
        });
      }
    }
  } catch (error) {
    console.error('自动总结失败:', error);
  }
}

/**
 * 从记忆中加载历史推文
 */
async function loadTwitterMemories(roche) {
  if (!settings.enableMemory) return [];

  try {
    if (roche.memory && roche.memory.getLongTerm) {
      const result = await roche.memory.getLongTerm({
        conversationId: currentUser,
        tags: ['twitter'],
        limit: 50
      });

      return result.facts || [];
    }
  } catch (error) {
    console.error('加载记忆失败:', error);
  }

  return [];
}

/**
 * 清除所有记忆
 */
async function clearAllMemories(roche) {
  try {
    // 如果 Roche 提供了清除记忆的 API
    if (roche.memory && roche.memory.clear) {
      await roche.memory.clear({
        conversationId: currentUser,
        tags: ['twitter']
      });
    }
  } catch (error) {
    console.error('清除记忆失败:', error);
  }
}

/**
 * 显示关注列表
 */
function showFollowingList(userId, roche) {
  const user = twitterData.users[userId];
  if (!user) return;

  // 绑定返回按钮
  const backBtn = document.getElementById('following-list-back-btn');
  if (backBtn) {
    backBtn.replaceWith(backBtn.cloneNode(true));
    document.getElementById('following-list-back-btn').addEventListener('click', () => {
      switchView('timeline');
    });
  }

  // 获取关注列表
  const followingIds = twitterData.follows[userId] || [];
  const followingUsers = followingIds.map(id => twitterData.users[id]).filter(u => u);

  const content = document.getElementById('following-list-content');
  if (!content) return;

  if (followingUsers.length === 0) {
    content.innerHTML = `
      <div style="padding: 40px 20px; text-align: center; color: #536471;">
        <div>还没有关注任何人</div>
      </div>
    `;
  } else {
    content.innerHTML = followingUsers.map(followUser => {
      const isFollowing = twitterData.follows[currentUser]?.includes(followUser.id);
      const isSelf = followUser.id === currentUser;

      return `
        <div class="setting-item" style="padding: 16px; cursor: pointer;" data-user-id="${followUser.id}">
          <img src="${followUser.avatar}" style="width: 48px; height: 48px; border-radius: 50%; margin-right: 12px; vertical-align: middle;">
          <div style="display: inline-block; vertical-align: middle; flex: 1;">
            <div style="font-weight: 700; font-size: 15px; color: #0f1419;">${followUser.name}</div>
            <div style="font-size: 15px; color: #536471;">${followUser.username}</div>
            ${followUser.bio ? `<div style="font-size: 14px; color: #0f1419; margin-top: 4px;">${followUser.bio}</div>` : ''}
          </div>
          ${!isSelf ? `
            <button class="follow-user-btn ${isFollowing ? 'following' : ''}" data-follow-user-id="${followUser.id}" style="
              padding: 6px 16px;
              border-radius: 20px;
              border: 1px solid ${isFollowing ? '#536471' : '#0f1419'};
              background: ${isFollowing ? 'transparent' : '#0f1419'};
              color: ${isFollowing ? '#0f1419' : '#ffffff'};
              font-weight: 700;
              font-size: 14px;
              cursor: pointer;
              margin-left: 12px;
            ">
              ${isFollowing ? '正在关注' : '关注'}
            </button>
          ` : ''}
        </div>
      `;
    }).join('');

    // 绑定关注按钮事件
    content.querySelectorAll('.follow-user-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const targetUserId = btn.dataset.followUserId;
        await toggleFollow(targetUserId, roche);
        showFollowingList(userId, roche); // 刷新列表
      });
    });

    // 绑定用户卡片点击事件
    content.querySelectorAll('[data-user-id]').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.follow-user-btn')) return;
        const targetUserId = card.dataset.userId;
        showProfile(targetUserId, roche);
      });
    });
  }

  switchView('followingList');
}

/**
 * 显示粉丝列表
 */
function showFollowersList(userId, roche) {
  const user = twitterData.users[userId];
  if (!user) return;

  // 绑定返回按钮
  const backBtn = document.getElementById('followers-list-back-btn');
  if (backBtn) {
    backBtn.replaceWith(backBtn.cloneNode(true));
    document.getElementById('followers-list-back-btn').addEventListener('click', () => {
      switchView('timeline');
    });
  }

  // 获取粉丝列表（谁关注了这个用户）
  const followerIds = Object.keys(twitterData.follows)
    .filter(followerId => twitterData.follows[followerId]?.includes(userId));
  const followerUsers = followerIds.map(id => twitterData.users[id]).filter(u => u);

  const content = document.getElementById('followers-list-content');
  if (!content) return;

  if (followerUsers.length === 0) {
    content.innerHTML = `
      <div style="padding: 40px 20px; text-align: center; color: #536471;">
        <div>还没有粉丝</div>
      </div>
    `;
  } else {
    content.innerHTML = followerUsers.map(follower => {
      const isFollowing = twitterData.follows[currentUser]?.includes(follower.id);
      const isSelf = follower.id === currentUser;

      return `
        <div class="setting-item" style="padding: 16px; cursor: pointer;" data-user-id="${follower.id}">
          <img src="${follower.avatar}" style="width: 48px; height: 48px; border-radius: 50%; margin-right: 12px; vertical-align: middle;">
          <div style="display: inline-block; vertical-align: middle; flex: 1;">
            <div style="font-weight: 700; font-size: 15px; color: #0f1419;">${follower.name}</div>
            <div style="font-size: 15px; color: #536471;">${follower.username}</div>
            ${follower.bio ? `<div style="font-size: 14px; color: #0f1419; margin-top: 4px;">${follower.bio}</div>` : ''}
          </div>
          ${!isSelf ? `
            <button class="follow-user-btn ${isFollowing ? 'following' : ''}" data-follow-user-id="${follower.id}" style="
              padding: 6px 16px;
              border-radius: 20px;
              border: 1px solid ${isFollowing ? '#536471' : '#0f1419'};
              background: ${isFollowing ? 'transparent' : '#0f1419'};
              color: ${isFollowing ? '#0f1419' : '#ffffff'};
              font-weight: 700;
              font-size: 14px;
              cursor: pointer;
              margin-left: 12px;
            ">
              ${isFollowing ? '正在关注' : '关注'}
            </button>
          ` : ''}
        </div>
      `;
    }).join('');

    // 绑定关注按钮事件
    content.querySelectorAll('.follow-user-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const targetUserId = btn.dataset.followUserId;
        await toggleFollow(targetUserId, roche);
        showFollowersList(userId, roche); // 刷新列表
      });
    });

    // 绑定用户卡片点击事件
    content.querySelectorAll('[data-user-id]').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.follow-user-btn')) return;
        const targetUserId = card.dataset.userId;
        showProfile(targetUserId, roche);
      });
    });
  }

  switchView('followersList');
}

/**
 * 执行搜索 - 调用智能 MCP
 */
async function performSearch(query, roche) {
  const resultsSection = document.getElementById('search-results-section');
  const defaultSection = document.getElementById('search-default-section');
  const resultsList = document.getElementById('search-results-list');

  // 显示搜索结果区域
  resultsSection.style.display = 'block';
  defaultSection.style.display = 'none';

  // 显示加载状态
  resultsList.innerHTML = `
    <div style="padding: 40px 20px; text-align: center; color: #536471;">
      <div>搜索中...</div>
    </div>
  `;

  try {
    // 调用 AI 搜索（使用 roche.ai.chat）
    const response = await roche.ai.chat({
      messages: [{
        role: 'user',
        content: `请使用智能 MCP 搜索工具搜索以下内容：${query}

要求：
1. 返回 3-5 条最相关的搜索结果
2. 每条结果包括：标题、摘要（100字以内）、来源
3. 以 JSON 数组格式返回，格式如下：
[
  {
    "title": "标题",
    "summary": "摘要内容",
    "source": "来源网站",
    "url": "链接（如有）"
  }
]`
      }],
      conversationId: currentUser,
      stream: false
    });

    console.log('[搜索] AI 返回:', response);

    // 解析 AI 返回的内容
    let searchResults = [];
    try {
      // 尝试从响应中提取 JSON
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        searchResults = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('[搜索] 解析结果失败:', e);
    }

    if (searchResults.length === 0) {
      resultsList.innerHTML = `
        <div style="padding: 40px 20px; text-align: center; color: #536471;">
          <div>未找到相关结果</div>
          <div style="margin-top: 8px; font-size: 14px;">试试其他关键词吧</div>
        </div>
      `;
      return;
    }

    // 渲染搜索结果为推文形式
    resultsList.innerHTML = searchResults.map((result, index) => {
      const newsId = `search-${Date.now()}-${index}`;
      const newsUser = {
        id: 'news-bot',
        name: '𝕏 搜索',
        username: '@XSearch',
        avatar: generateAvatar('搜索')
      };

      return `
        <div class="tweet-item" data-tweet-id="${newsId}" data-is-news="true" data-search-result='${JSON.stringify(result).replace(/'/g, '&apos;')}'>
          <img class="tweet-avatar" src="${newsUser.avatar}" alt="">
          <div class="tweet-content">
            <div class="tweet-header">
              <span class="tweet-author">${newsUser.name}</span>
              <span class="tweet-username">${newsUser.username}</span>
              <span class="tweet-time">刚刚</span>
            </div>
            <div class="tweet-text">
              <div style="font-weight: 700; margin-bottom: 8px;">${escapeHtml(result.title)}</div>
              <div>${escapeHtml(result.summary)}</div>
              ${result.source ? `<div style="margin-top: 8px; color: #1d9bf0; font-size: 14px;">📰 ${escapeHtml(result.source)}</div>` : ''}
            </div>
            <div class="tweet-actions">
              <div class="tweet-action" data-action="reply">
                <span class="action-icon">${icons.reply}</span>
              </div>
              <div class="tweet-action" data-action="retweet">
                <span class="action-icon">${icons.retweet}</span>
              </div>
              <div class="tweet-action" data-action="like">
                <span class="action-icon">${icons.like}</span>
              </div>
              <div class="tweet-action" data-action="share">
                <span class="action-icon">${icons.share}</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // 绑定搜索结果的操作事件
    resultsList.querySelectorAll('.tweet-action').forEach(el => {
      el.addEventListener('click', async (e) => {
        e.stopPropagation();
        const action = el.dataset.action;
        const tweetItem = el.closest('.tweet-item');
        const searchResult = JSON.parse(tweetItem.dataset.searchResult);

        await handleSearchResultAction(action, searchResult, roche);
      });
    });

  } catch (error) {
    console.error('[搜索] 搜索失败:', error);
    resultsList.innerHTML = `
      <div style="padding: 40px 20px; text-align: center; color: #f4212e;">
        <div>搜索失败</div>
        <div style="margin-top: 8px; font-size: 14px;">${escapeHtml(error.message)}</div>
      </div>
    `;
  }
}

/**
 * 处理搜索结果的操作（转发/评论后才保存到记忆）
 */
async function handleSearchResultAction(action, searchResult, roche) {
  const currentUserData = twitterData.users[currentUser];

  if (action === 'retweet') {
    // 转发：保存到记忆
    const memoryText = `转发了搜索结果：${searchResult.title}\n${searchResult.summary}\n来源：${searchResult.source || '未知'}`;

    try {
      await roche.memory.addEpisodic({
        content: memoryText,
        conversationId: currentUser,
        tags: ['twitter', 'search', 'retweet']
      });
      showToast('已转发并保存到记忆', 'success');
    } catch (error) {
      console.error('[搜索] 保存记忆失败:', error);
      showToast('转发成功', 'success');
    }

  } else if (action === 'reply') {
    // 评论：显示输入框，提交后保存到记忆
    const comment = prompt('评论这条搜索结果：');
    if (comment && comment.trim()) {
      const memoryText = `评论了搜索结果：${searchResult.title}\n我的评论：${comment}\n原文摘要：${searchResult.summary}`;

      try {
        await roche.memory.addEpisodic({
          content: memoryText,
          conversationId: currentUser,
          tags: ['twitter', 'search', 'comment']
        });
        showToast('评论已保存到记忆', 'success');
      } catch (error) {
        console.error('[搜索] 保存记忆失败:', error);
        showToast('评论成功', 'success');
      }
    }

  } else if (action === 'like') {
    // 点赞：简单提示，不保存记忆
    showToast('已点赞', 'success');

  } else if (action === 'share') {
    // 分享：显示分享选项
    showToast('分享功能开发中...', 'info');
  }
}

})(); // 立即执行函数结束
