/**
 * Roche Twitter - 完整推特克隆插件
 * 黑白配色，完整功能实现
 */

(function() {
  'use strict';

const PLUGIN_ID = 'twitter-x-2026';
const STORAGE_KEY = 'twitter_data';

// NPC 生态系统配置
const NPC_CONFIG = {
  dailyNewNPCs: 3,           // 每天生成新 NPC 数量
  maxNPCs: 50,               // NPC 总数上限
  cleanupDays: 7,            // 清理无互动 NPC 的天数
  dailyActiveNPCs: 10,       // 每天随机抽取发帖的 NPC 数量
  postsPerActiveNPC: 3,      // 每个活跃 NPC 每天发帖数
  postIntervalMin: 2,        // 最小发帖间隔（分钟）- 改为 2 分钟
  postIntervalMax: 15,       // 最大发帖间隔（分钟）- 改为 15 分钟
  interestDecayRate: 0.95,   // 兴趣度每天衰减率
  minInterestForRecommend: 0.3,  // 推荐的最小兴趣度
  // NPC 智能回复配置
  enableAutoReply: true,     // 启用 NPC 自动回复
  replyProbability: 0.3,     // 基础回复概率（30%）
  maxRepliesPerNPCDaily: 5,  // 每个 NPC 每天最多回复次数
  minInterestForReply: 0.4,  // 回复的最小兴趣度阈值
  replyCheckInterval: 3      // 检查新推文的间隔（分钟）
};

// 初始化数据结构
let twitterData = {
  tweets: [],
  users: {},
  follows: {},
  bookmarks: {},
  nextTweetId: 1,
  // NPC 系统
  npcs: {},                  // NPC 数据 { npcId: { ...persona, lastPostTime, postCount, ... } }
  npcInterests: {},          // 用户对 NPC 的兴趣度 { userId: { npcId: score } }
  lastNPCCleanup: Date.now(), // 上次清理时间
  lastNPCGeneration: Date.now(), // 上次生成时间
  lastReplyCheck: Date.now(), // 上次检查回复的时间
  npcReplyCounts: {}          // NPC 每日回复计数 { npcId: { date: '2026-07-31', count: 3 } }
};

// 插件设置
let settings = {
  enableMemory: true,        // 启用记忆
  autoSummary: true,         // 自动总结
  memoryTarget: 'current',   // 保存到当前会话
  notificationSound: true,
  // NPC 系统设置
  enableNPC: true,           // 启用 NPC 系统
  npcBackendAPI: '',         // NPC 后端 API 地址（用于发帖）
  useSystemChatForDM: true,  // 私信使用系统 roche.ai.chat
  // API 配置
  apiConfig: {
    url: '',                 // API 网址
    apiKey: '',              // API 密钥
    model: 'gpt-3.5-turbo',  // 模型
    temperature: 0.7         // 温度 (0-2)
  }
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
    version: '5.6.0',
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

          // 初始化 NPC 系统（异步，不阻塞界面）
          initNPCSystem(roche).catch(error => {
            console.error('[NPC] NPC 系统初始化失败:', error);
          });

          // 初始化 Char 自动发推系统
          initCharTweetSystem(roche).catch(error => {
            console.error('[Char] Char 发推系统初始化失败:', error);
          });

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

    // 兼容旧版本数据：添加 NPC 相关字段
    if (!twitterData.npcs) {
      twitterData.npcs = {};
    }
    if (!twitterData.npcInterests) {
      twitterData.npcInterests = {};
    }
    if (!twitterData.lastNPCCleanup) {
      twitterData.lastNPCCleanup = Date.now();
    }
    if (!twitterData.lastNPCGeneration) {
      twitterData.lastNPCGeneration = Date.now();
    }
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
        position: relative;
        left: 0;
        right: 0;
        height: 60px;
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
        padding-bottom: env(safe-area-inset-bottom);
      }

      .sidebar-drawer.active {
        left: 0;
      }

      .sidebar-header {
        padding: 16px;
        padding-top: calc(16px + env(safe-area-inset-top));
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
        padding-bottom: calc(60px + env(safe-area-inset-bottom));
        min-height: 100vh;
      }

      /* 主页标签 */
      .timeline-tabs {
        position: relative;
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
        padding-top: 0; /* 顶部栏和标签栏不再固定，不需要 padding */
        padding-bottom: calc(60px + env(safe-area-inset-bottom));
        overflow-y: auto;
        height: 100vh;
        box-sizing: border-box;
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
        z-index: 300;
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
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: #ffffff;
        z-index: 200;
        overflow-y: auto;
      }

      .tweet-detail-view.active {
        display: block;
      }

      .detail-header {
        position: sticky;
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
        z-index: 201;
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
        padding-bottom: calc(80px + env(safe-area-inset-bottom));
        overflow-y: auto;
        min-height: 100vh;
      }

      .detail-tweet {
        padding: 0 16px;
      }

      .detail-tweet-header {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        margin-bottom: 12px;
        padding: 0 16px 0 16px;
      }

      .detail-tweet-avatar {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        flex-shrink: 0;
      }

      .detail-tweet-author {
        flex: 1;
        min-width: 0;
      }

      .detail-tweet-author-top {
        display: flex;
        align-items: center;
        gap: 4px;
        margin-bottom: 2px;
      }

      .detail-tweet-name {
        font-weight: 700;
        font-size: 15px;
        color: #0f1419;
      }

      .detail-tweet-username {
        color: #536471;
        font-size: 15px;
      }

      .detail-tweet-translate {
        color: #1d9bf0;
        font-size: 13px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 4px;
        margin-top: 8px;
        padding: 4px 16px;
      }

      .detail-tweet-translate:hover {
        text-decoration: underline;
      }

      .detail-tweet-text {
        font-size: 17px;
        line-height: 24px;
        margin: 4px 0 12px 0;
        padding: 0 16px;
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
        margin: 4px 0 16px 0;
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
        padding: 12px 16px;
        padding-bottom: calc(12px + env(safe-area-inset-bottom));
        border-top: 1px solid #eff3f4;
        background: #ffffff;
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        z-index: 201;
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
        padding: 10px 16px;
        resize: none;
        outline: none;
        font-family: inherit;
        min-height: 40px;
        max-height: 120px;
        line-height: 20px;
      }

      .detail-reply-textarea::placeholder {
        color: #536471;
      }

      .detail-reply-textarea:focus {
        border-color: #1d9bf0;
      }

      /* 页面视图 */
      .page-view {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: #ffffff;
        z-index: 200;
        overflow-y: auto;
      }

      .page-view.active {
        display: block;
      }

      /* 搜索页 */
      .search-top-bar {
        position: relative;
        left: 0;
        right: 0;
        padding-top: env(safe-area-inset-top);
        height: calc(60px + env(safe-area-inset-top));
        background: rgba(255, 255, 255, 0.85);
        backdrop-filter: blur(12px);
        border-bottom: 1px solid #eff3f4;
        display: flex;
        align-items: center;
        padding-left: 16px;
        padding-right: 16px;
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
        border-radius: 18px;
        padding: 6px 12px;
        gap: 8px;
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
        position: relative;
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
        padding-bottom: calc(60px + env(safe-area-inset-bottom));
        overflow-y: auto;
        height: 100vh;
        box-sizing: border-box;
      }

      .search-header {
        position: relative;
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
        position: relative;
        left: 0;
        right: 0;
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
        position: relative;
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
        padding-top: 0; /* 顶部栏不再固定，不需要 padding */
        padding-bottom: calc(60px + env(safe-area-inset-bottom));
        overflow-y: auto;
        height: 100vh;
        box-sizing: border-box;
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
        position: relative;
        left: 0;
        right: 0;
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
        position: relative;
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
        border-radius: 18px;
        padding: 6px 12px;
        gap: 8px;
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
        padding-top: 0; /* 顶部栏不再固定，不需要 padding */
        padding-bottom: calc(60px + env(safe-area-inset-bottom));
        overflow-y: auto;
        height: 100vh;
        box-sizing: border-box;
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
        bottom: env(safe-area-inset-bottom);
        left: 0;
        right: 0;
        padding: 8px 12px;
        padding-bottom: calc(8px + env(safe-area-inset-bottom));
        background: rgba(255, 255, 255, 0.85);
        backdrop-filter: blur(12px);
        border-top: 1px solid #eff3f4;
        display: flex;
        gap: 8px;
        max-width: 768px;
        margin: 0 auto;
        z-index: 1000;
      }

      .chat-input {
        flex: 1;
        background: #eff3f4;
        border: none;
        border-radius: 18px;
        padding: 8px 12px;
        font-size: 14px;
        outline: none;
        color: #0f1419;
        min-height: 36px;
      }

      .chat-input::placeholder {
        color: #536471;
      }

      .chat-send-btn {
        background: #1d9bf0;
        color: #ffffff;
        border: none;
        border-radius: 18px;
        padding: 8px 16px;
        font-weight: 600;
        font-size: 14px;
        cursor: pointer;
        transition: background 0.2s;
        min-height: 36px;
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
        position: sticky;
        top: 0;
        left: 0;
        right: 0;
        padding-top: env(safe-area-inset-top);
        height: calc(53px + env(safe-area-inset-top));
        background: rgba(255, 255, 255, 0.85);
        backdrop-filter: blur(12px);
        border-bottom: 1px solid #eff3f4;
        display: flex;
        align-items: center;
        padding-left: 16px;
        padding-right: 16px;
        gap: 24px;
        z-index: 100;
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
        padding-bottom: calc(80px + env(safe-area-inset-bottom));
        overflow-y: auto;
        height: 100vh;
        box-sizing: border-box;
      }

      .profile-banner {
        width: 100%;
        height: 200px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        position: relative;
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
            <textarea class="detail-reply-textarea" id="detail-reply-textarea" placeholder="发布你的回复（按回车发送）" rows="1"></textarea>
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

        <h2 class="section-title" style="margin-top: 20px;">API 配置</h2>
        <div class="settings-section">
          <div class="setting-item" id="setting-api-url">
            <div class="setting-info">
              <div class="setting-label">API 网址</div>
              <div class="setting-description" id="api-url-status">未配置</div>
            </div>
            <div class="setting-arrow">›</div>
          </div>
          <div class="setting-item" id="setting-api-key">
            <div class="setting-info">
              <div class="setting-label">API 密钥</div>
              <div class="setting-description" id="api-key-status">未配置</div>
            </div>
            <div class="setting-arrow">›</div>
          </div>
          <div class="setting-item" id="setting-api-model">
            <div class="setting-info">
              <div class="setting-label">智能模型</div>
              <div class="setting-description" id="api-model-value">gpt-3.5-turbo</div>
            </div>
            <div class="setting-arrow">›</div>
          </div>
          <div class="setting-item" id="setting-api-temperature">
            <div class="setting-info">
              <div class="setting-label">温度</div>
              <div class="setting-description" id="api-temperature-value">0.7</div>
            </div>
            <div class="setting-arrow">›</div>
          </div>
        </div>

        <h2 class="section-title" style="margin-top: 20px;">AI 角色</h2>
        <div class="settings-section">
          <div class="setting-item" id="setting-char-tweets">
            <div class="setting-info">
              <div class="setting-label">Char 发推文管理</div>
              <div class="setting-description">让你的 Char 角色发推文</div>
            </div>
            <div class="setting-arrow">›</div>
          </div>
        </div>

        <h2 class="section-title" style="margin-top: 20px;">NPC 系统设置</h2>
        <div class="settings-section">
          <div class="setting-item setting-toggle">
            <div class="setting-info">
              <div class="setting-label">启用 NPC 系统</div>
              <div class="setting-description">AI NPC 会自动发帖和互动</div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" id="toggle-npc" checked>
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="setting-item setting-toggle">
            <div class="setting-info">
              <div class="setting-label">启用智能回复</div>
              <div class="setting-description">NPC 会自动回复你的推文</div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" id="toggle-npc-reply" checked>
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="setting-item" id="setting-npc-count">
            <div class="setting-info">
              <div class="setting-label">NPC 数量</div>
              <div class="setting-description">当前: <span id="npc-count-value">8</span> 个</div>
            </div>
            <div class="setting-arrow">›</div>
          </div>
          <div class="setting-item" id="setting-npc-frequency">
            <div class="setting-info">
              <div class="setting-label">发帖频率</div>
              <div class="setting-description">当前: <span id="npc-frequency-value">30-120 分钟</span></div>
            </div>
            <div class="setting-arrow">›</div>
          </div>
          <div class="setting-item" id="setting-npc-api">
            <div class="setting-info">
              <div class="setting-label">后端 API 地址</div>
              <div class="setting-description" id="npc-api-status">未配置</div>
            </div>
            <div class="setting-arrow">›</div>
          </div>
          <div class="setting-item" id="setting-npc-manage">
            <div class="setting-label">管理 NPC</div>
            <div class="setting-arrow">›</div>
          </div>
          <div class="setting-item" id="setting-test-npc-api">
            <div class="setting-info">
              <div class="setting-label">测试 NPC 发帖</div>
              <div class="setting-description">测试 API 是否能正常生成内容</div>
            </div>
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

    <!-- 书签页 -->
    <div class="page-view" id="bookmarks-view">
      <div class="profile-header">
        <div class="profile-back-btn" id="bookmarks-back-btn">${icons.back}</div>
        <div class="profile-header-info">
          <div class="profile-header-name">书签</div>
        </div>
      </div>
      <div class="profile-content">
        <div id="bookmarks-tweets-list">
          <!-- 动态加载书签推文 -->
        </div>
      </div>
    </div>

    <!-- 列表页 -->
    <div class="page-view" id="lists-view">
      <div class="profile-header">
        <div class="profile-back-btn" id="lists-back-btn">${icons.back}</div>
        <div class="profile-header-info">
          <div class="profile-header-name">好友列表</div>
        </div>
      </div>
      <div class="profile-content">
        <div id="lists-content">
          <!-- 动态加载好友列表 -->
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

  // 添加下拉刷新功能
  const timelineContent = document.querySelector('.timeline-content');
  let startY = 0;
  let currentY = 0;
  let isDragging = false;
  let refreshIndicator = null;

  timelineContent.addEventListener('touchstart', (e) => {
    // 只在滚动到顶部时触发
    if (timelineContent.scrollTop === 0) {
      startY = e.touches[0].pageY;
      isDragging = true;
    }
  });

  timelineContent.addEventListener('touchmove', (e) => {
    if (!isDragging || timelineContent.scrollTop > 0) return;

    currentY = e.touches[0].pageY;
    const deltaY = currentY - startY;

    // 只在下拉时显示
    if (deltaY > 0) {
      e.preventDefault();

      // 创建刷新指示器
      if (!refreshIndicator) {
        refreshIndicator = document.createElement('div');
        refreshIndicator.style.cssText = `
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: ${Math.min(deltaY, 80)}px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #1d9bf0;
          font-size: 14px;
          font-weight: 600;
          background: rgba(255, 255, 255, 0.95);
          z-index: 100;
          transition: height 0.2s;
        `;
        refreshIndicator.innerHTML = deltaY > 60
          ? '<span>🔄 松开刷新</span>'
          : '<span>⬇️ 下拉刷新</span>';
        timelineContent.style.position = 'relative';
        timelineContent.insertBefore(refreshIndicator, timelineContent.firstChild);
      } else {
        refreshIndicator.style.height = `${Math.min(deltaY, 80)}px`;
        refreshIndicator.innerHTML = deltaY > 60
          ? '<span>🔄 松开刷新</span>'
          : '<span>⬇️ 下拉刷新</span>';
      }
    }
  });

  timelineContent.addEventListener('touchend', async (e) => {
    if (!isDragging) return;

    const deltaY = currentY - startY;

    if (deltaY > 60 && refreshIndicator) {
      // 触发刷新
      refreshIndicator.innerHTML = '<span>🔄 刷新中...</span>';

      try {
        // 获取当前标签
        const activeTab = document.querySelector('.timeline-tab.active');
        const tabType = activeTab ? activeTab.dataset.tab : 'recommended';

        // 刷新推文列表
        await renderTweets(roche, tabType);

        refreshIndicator.innerHTML = '<span>✅ 刷新成功</span>';
        setTimeout(() => {
          if (refreshIndicator && refreshIndicator.parentNode) {
            refreshIndicator.parentNode.removeChild(refreshIndicator);
            refreshIndicator = null;
          }
        }, 500);
      } catch (error) {
        console.error('刷新失败:', error);
        refreshIndicator.innerHTML = '<span>❌ 刷新失败</span>';
        setTimeout(() => {
          if (refreshIndicator && refreshIndicator.parentNode) {
            refreshIndicator.parentNode.removeChild(refreshIndicator);
            refreshIndicator = null;
          }
        }, 500);
      }
    } else {
      // 没有达到刷新阈值，移除指示器
      if (refreshIndicator && refreshIndicator.parentNode) {
        refreshIndicator.parentNode.removeChild(refreshIndicator);
        refreshIndicator = null;
      }
    }

    isDragging = false;
    startY = 0;
    currentY = 0;
  });

  // 鼠标拖动支持（桌面端）
  let isMouseDragging = false;
  let mouseStartY = 0;
  let mouseCurrentY = 0;

  timelineContent.addEventListener('mousedown', (e) => {
    if (timelineContent.scrollTop === 0) {
      mouseStartY = e.pageY;
      isMouseDragging = true;
      e.preventDefault();
    }
  });

  timelineContent.addEventListener('mousemove', (e) => {
    if (!isMouseDragging || timelineContent.scrollTop > 0) return;

    mouseCurrentY = e.pageY;
    const deltaY = mouseCurrentY - mouseStartY;

    if (deltaY > 0) {
      e.preventDefault();

      if (!refreshIndicator) {
        refreshIndicator = document.createElement('div');
        refreshIndicator.style.cssText = `
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: ${Math.min(deltaY, 80)}px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #1d9bf0;
          font-size: 14px;
          font-weight: 600;
          background: rgba(255, 255, 255, 0.95);
          z-index: 100;
          transition: height 0.2s;
        `;
        refreshIndicator.innerHTML = deltaY > 60
          ? '<span>🔄 松开刷新</span>'
          : '<span>⬇️ 下拉刷新</span>';
        timelineContent.style.position = 'relative';
        timelineContent.insertBefore(refreshIndicator, timelineContent.firstChild);
      } else {
        refreshIndicator.style.height = `${Math.min(deltaY, 80)}px`;
        refreshIndicator.innerHTML = deltaY > 60
          ? '<span>🔄 松开刷新</span>'
          : '<span>⬇️ 下拉刷新</span>';
      }
    }
  });

  timelineContent.addEventListener('mouseup', async (e) => {
    if (!isMouseDragging) return;

    const deltaY = mouseCurrentY - mouseStartY;

    if (deltaY > 60 && refreshIndicator) {
      refreshIndicator.innerHTML = '<span>🔄 刷新中...</span>';

      try {
        const activeTab = document.querySelector('.timeline-tab.active');
        const tabType = activeTab ? activeTab.dataset.tab : 'recommended';
        await renderTweets(roche, tabType);

        refreshIndicator.innerHTML = '<span>✅ 刷新成功</span>';
        setTimeout(() => {
          if (refreshIndicator && refreshIndicator.parentNode) {
            refreshIndicator.parentNode.removeChild(refreshIndicator);
            refreshIndicator = null;
          }
        }, 500);
      } catch (error) {
        console.error('刷新失败:', error);
        refreshIndicator.innerHTML = '<span>❌ 刷新失败</span>';
        setTimeout(() => {
          if (refreshIndicator && refreshIndicator.parentNode) {
            refreshIndicator.parentNode.removeChild(refreshIndicator);
            refreshIndicator = null;
          }
        }, 500);
      }
    } else {
      if (refreshIndicator && refreshIndicator.parentNode) {
        refreshIndicator.parentNode.removeChild(refreshIndicator);
        refreshIndicator = null;
      }
    }

    isMouseDragging = false;
    mouseStartY = 0;
    mouseCurrentY = 0;
  });

  document.addEventListener('mouseleave', () => {
    if (isMouseDragging && refreshIndicator && refreshIndicator.parentNode) {
      refreshIndicator.parentNode.removeChild(refreshIndicator);
      refreshIndicator = null;
      isMouseDragging = false;
    }
  });

  // 详情页返回按钮
  // ============================================
  // 统一绑定所有返回按钮
  // ============================================
  const backButtons = {
    'detail-back-btn': 'timeline',
    'chat-back-btn': 'messages',
    'settings-back-btn': 'timeline',
    'profile-back-btn': 'timeline',
    'bookmarks-back-btn': 'timeline',
    'lists-back-btn': 'timeline',
    'privacy-settings-back-btn': 'settings',
    'switch-account-back-btn': 'settings',
    'following-list-back-btn': 'profile',
    'followers-list-back-btn': 'profile'
  };

  Object.keys(backButtons).forEach(btnId => {
    const btn = document.getElementById(btnId);
    if (btn) {
      btn.addEventListener('click', () => {
        const targetView = backButtons[btnId];
        if (targetView === 'settings') {
          showSettings(roche);
        } else if (targetView === 'profile' && currentUser) {
          showProfile(currentUser, roche);
        } else {
          switchView(targetView);
        }
      });
    }
  });

  // 详情页回复功能
  const replyTextarea = document.getElementById('detail-reply-textarea');

  replyTextarea.addEventListener('input', () => {
    // 自动调整高度
    replyTextarea.style.height = 'auto';
    replyTextarea.style.height = Math.min(replyTextarea.scrollHeight, 120) + 'px';
  });

  // 回车键发送回复
  replyTextarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const content = replyTextarea.value.trim();
      if (content) {
        postReply(roche, currentTweetId, content);
        replyTextarea.value = '';
        replyTextarea.style.height = 'auto';
      }
    }
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
    const bottomNav = document.querySelector('.mobile-bottom-nav');

    if (chatView) {
      chatView.classList.remove('active');
    }
    if (messagesListView) {
      messagesListView.classList.remove('hidden');
    }
    // 显示底部导航栏
    if (bottomNav) {
      bottomNav.style.display = 'flex';
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
    // 调用 Roche API 切换 Persona（如果有 conversationId 且 API 存在）
    if (persona.conversationId && roche.persona?.setActiveUserPersona) {
      console.log('[Twitter] 正在切换 Persona...', personaId);
      await roche.persona.setActiveUserPersona(personaId);
      console.log('[Twitter] Persona 切换成功');
    } else if (persona.conversationId) {
      console.log('[Twitter] roche.persona.setActiveUserPersona 不可用，仅切换本地状态');
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
      // 侧边栏的"设置和隐私"打开设置页面
      showSettings(roche);
      break;
    case 'bookmarks':
      showBookmarks(roche);
      break;
    case 'lists':
      showLists(roche);
      break;
    case 'premium':
    case 'communities':
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

  // 不再生成模拟新闻推文
  return [];
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

  // 触发 NPC 智能回复（异步，不阻塞）
  setTimeout(() => {
    npcSmartReply(tweet.id, roche).catch(err => {
      console.error('[NPC 回复] 触发失败:', err);
    });
  }, 2000 + Math.random() * 3000); // 2-5秒后随机触发，模拟真实延迟
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
    // "为你推荐" 标签：基于兴趣度的智能推荐
    const newsTweets = await fetchNewsTweets(roche);

    // 确保 npcs 和 npcInterests 已初始化
    if (!twitterData.npcs) twitterData.npcs = {};
    if (!twitterData.npcInterests) twitterData.npcInterests = {};
    if (!twitterData.npcInterests[currentUser]) twitterData.npcInterests[currentUser] = {};

    // 对推文进行智能排序
    filteredTweets = [...twitterData.tweets].map(tweet => {
      let score = 0;

      // 如果是 NPC 的推文，根据兴趣度加权
      if (twitterData.npcs && twitterData.npcs[tweet.userId]) {
        const interest = twitterData.npcInterests[currentUser]?.[tweet.userId] || 0.5;
        score = interest;
      } else {
        // 普通用户推文默认权重
        score = 0.3;
      }

      // 如果是关注的用户，提高权重
      const following = twitterData.follows[currentUser] || [];
      if (following.includes(tweet.userId)) {
        score += 0.4;
      }

      // 时间衰减（越新的推文权重越高）
      const ageInHours = (Date.now() - tweet.timestamp) / (1000 * 60 * 60);
      const timeFactor = Math.exp(-ageInHours / 24); // 24小时衰减
      score *= timeFactor;

      return { tweet, score };
    }).sort((a, b) => b.score - a.score).map(item => item.tweet);

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
    let user = twitterData.users[tweet.userId];
    const isLiked = tweet.likes.includes(currentUser);
    const isRetweeted = tweet.retweets.includes(currentUser);
    const timeAgo = getTimeAgo(tweet.timestamp);

    // 转发推文显示
    let retweetHeader = '';
    if (tweet.isRetweet) {
      const retweeter = user;
      const originalUser = twitterData.users[tweet.originalUserId];
      retweetHeader = `
        <div style="padding: 0 16px 8px 48px; color: #536471; font-size: 13px; display: flex; align-items: center; gap: 4px;">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z"></path></svg>
          <span>${retweeter.name} 转发了</span>
        </div>
      `;
      // 使用原作者信息
      user = originalUser;
    }

    // 新闻推文特殊样式
    const newsLabel = tweet.isNews ? `<span style="display: inline-block; background: #1d9bf0; color: white; font-size: 11px; padding: 2px 6px; border-radius: 4px; margin-left: 4px; font-weight: 700;">新闻</span>` : '';
    const sourceLabel = tweet.source ? `<span style="color: #536471; font-size: 13px; margin-left: 4px;">· 来源: ${tweet.source}</span>` : '';

    // 如果是当前用户的推文，显示菜单按钮
    const menuButton = tweet.userId === currentUser ? `
      <div class="tweet-menu-btn" data-action="menu" style="margin-left: auto; padding: 4px; cursor: pointer; border-radius: 50%; transition: background 0.2s;">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="#536471">
          <circle cx="5" cy="12" r="2"></circle>
          <circle cx="12" cy="12" r="2"></circle>
          <circle cx="19" cy="12" r="2"></circle>
        </svg>
      </div>
    ` : '';

    return `
      <div class="tweet-item" data-tweet-id="${tweet.id}" ${tweet.isNews ? 'data-is-news="true"' : ''}>
        ${retweetHeader}
        <div class="tweet-header">
          <img class="tweet-avatar" src="${user.avatar}" alt="">
          <div class="tweet-content">
            <div class="tweet-author" style="display: flex; align-items: center;">
              <div style="flex: 1; display: flex; align-items: center; flex-wrap: wrap;">
                <span class="tweet-author-name">${user.name}${newsLabel}</span>
                <span class="tweet-author-username">${user.username}</span>
                <span class="tweet-time">· ${timeAgo}</span>
                ${sourceLabel}
              </div>
              ${menuButton}
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

  // 绑定推文菜单按钮
  listEl.querySelectorAll('.tweet-menu-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const tweetItem = btn.closest('.tweet-item');
      const tweetId = parseInt(tweetItem.dataset.tweetId);
      showTweetMenu(tweetId, btn, roche);
    });

    // 悬停效果
    btn.addEventListener('mouseenter', () => {
      btn.style.background = 'rgba(29, 155, 240, 0.1)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'transparent';
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
  const bookmarksView = document.getElementById('bookmarks-view');
  const listsView = document.getElementById('lists-view');
  const topBar = document.querySelector('.mobile-top-bar');
  const bottomNav = document.querySelector('.mobile-bottom-nav');

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
  if (bookmarksView) bookmarksView.classList.remove('active');
  if (listsView) listsView.classList.remove('active');

  // 只在主页、搜索、通知、私信四个页面显示底部导航栏
  const showBottomNav = ['timeline', 'search', 'notifications', 'messages'].includes(view);
  if (bottomNav) {
    bottomNav.style.display = showBottomNav ? 'flex' : 'none';
  }

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
  } else if (view === 'bookmarks') {
    // 显示书签页
    if (bookmarksView) bookmarksView.classList.add('active');
    if (topBar) topBar.style.display = 'none'; // 隐藏全局顶部栏
  } else if (view === 'lists') {
    // 显示列表页
    if (listsView) listsView.classList.add('active');
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

  // 如果是 NPC 的推文，更新查看兴趣度
  if (twitterData.npcs[tweet.userId]) {
    updateNPCInterest(currentUser, tweet.userId, 'view');
  }

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
      <!-- 头部：头像 + 用户信息 + 关注按钮 -->
      <div class="detail-tweet-header">
        <img class="detail-tweet-avatar" src="${user.avatar}" alt="">
        <div class="detail-tweet-author">
          <div class="detail-tweet-author-top">
            <span class="detail-tweet-name">${user.name}</span>
          </div>
          <div class="detail-tweet-username">${user.username}</div>
        </div>
        ${!isSelf ? `
          <button class="detail-follow-btn ${isFollowing ? 'following' : ''}" id="detail-follow-btn" style="margin-left: auto;">
            <span>${isFollowing ? '正在关注' : '关注'}</span>
          </button>
        ` : ''}
      </div>

      <!-- 翻译链接 -->
      <div class="detail-tweet-translate" id="translate-link">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"></path></svg>
        <span>显示翻译</span>
      </div>

      <!-- 推文内容 -->
      <div class="detail-tweet-text" id="detail-tweet-content">
        ${escapeHtml(tweet.content)}
      </div>

      <!-- 翻译内容（隐藏） -->
      <div class="detail-tweet-translation" id="detail-tweet-translation" style="display: none; padding: 12px 16px; background: #f7f9f9; border-radius: 12px; margin: 12px 16px; color: #0f1419; font-size: 15px; line-height: 20px;">
        正在翻译...
      </div>

      <!-- 时间和查看数 -->
      <div class="detail-tweet-time" style="color: #536471; font-size: 15px; margin: 16px 0; padding: 0 16px 16px 16px; border-bottom: 1px solid #eff3f4;">
        <span>${formattedDateTime}</span>
        <span style="margin: 0 4px;">·</span>
        <span style="font-weight: 700; color: #0f1419;">${viewCount}</span>
        <span> 查看</span>
      </div>

      <!-- 点赞数 -->
      <div class="detail-tweet-stats" style="padding: 12px 16px; border-bottom: 1px solid #eff3f4;">
        <span style="font-weight: 700; color: #0f1419; font-size: 15px;">${tweet.likes.length}</span>
        <span style="color: #536471; margin-left: 4px; font-size: 15px;">喜欢</span>
      </div>

      <!-- 操作按钮 -->
      <div class="detail-tweet-actions" style="display: flex; justify-content: space-around; padding: 12px 16px; border-bottom: 1px solid #eff3f4;">
        <div class="detail-action-btn" data-action="reply" style="display: flex; align-items: center; justify-content: center; padding: 8px; cursor: pointer; border-radius: 50%; transition: background 0.2s; color: #536471;">
          ${icons.comment}
        </div>
        <div class="detail-action-btn ${isRetweeted ? 'retweeted' : ''}" data-action="retweet" style="display: flex; align-items: center; justify-content: center; padding: 8px; cursor: pointer; border-radius: 50%; transition: background 0.2s; color: ${isRetweeted ? '#00ba7c' : '#536471'};">
          ${icons.retweet}
        </div>
        <div class="detail-action-btn ${isLiked ? 'liked' : ''}" data-action="like" style="display: flex; align-items: center; justify-content: center; padding: 8px; cursor: pointer; border-radius: 50%; transition: background 0.2s; color: ${isLiked ? '#f91880' : '#536471'};">
          ${isLiked ? icons.likeFilled : icons.like}
        </div>
        <div class="detail-action-btn ${isBookmarked ? 'bookmarked' : ''}" data-action="bookmark" style="display: flex; align-items: center; justify-content: center; padding: 8px; cursor: pointer; border-radius: 50%; transition: background 0.2s; color: ${isBookmarked ? '#1d9bf0' : '#536471'};">
          ${isBookmarked
            ? '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M4 4.5C4 3.12 5.119 2 6.5 2h11C18.881 2 20 3.12 20 4.5v18.44l-8-5.71-8 5.71V4.5z"></path></svg>'
            : '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M4 4.5C4 3.12 5.119 2 6.5 2h11C18.881 2 20 3.12 20 4.5v18.44l-8-5.71-8 5.71V4.5zM6.5 4c-.276 0-.5.224-.5.5v14.56l6-4.29 6 4.29V4.5c0-.276-.224-.5-.5-.5h-11z"></path></svg>'}
        </div>
        <div class="detail-action-btn" data-action="share" style="display: flex; align-items: center; justify-content: center; padding: 8px; cursor: pointer; border-radius: 50%; transition: background 0.2s; color: #536471;">
          ${icons.share}
        </div>
      </div>

      <!-- 最相关的回复 -->
      <div class="detail-replies-header" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; color: #0f1419; border-bottom: 1px solid #eff3f4;">
        <span style="font-weight: 700; font-size: 15px;">最相关的回复</span>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="#536471"><path d="M3.543 8.96l1.414-1.42L12 14.59l7.043-7.05 1.414 1.42L12 17.41 3.543 8.96z"></path></svg>
      </div>

      <!-- 发现更多 -->
      <div class="detail-discover-more" style="padding: 32px 16px;">
        <div style="font-weight: 700; font-size: 20px; color: #0f1419; margin-bottom: 8px;">发现更多</div>
        <div style="color: #536471; font-size: 15px;">源自于整个 𝕏</div>
      </div>

      <!-- 来源标签 -->
      <div class="detail-source-label" style="padding: 12px 16px; border-top: 1px solid #eff3f4;">
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
  detailMain.querySelectorAll('.detail-action-btn').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
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
        // 取消转发 - 删除转发的推文
        tweet.retweets.splice(retweetIndex, 1);

        // 找到并删除转发的推文
        const retweetedTweetIndex = twitterData.tweets.findIndex(t =>
          t.isRetweet && t.originalTweetId === tweetId && t.userId === currentUser
        );
        if (retweetedTweetIndex > -1) {
          twitterData.tweets.splice(retweetedTweetIndex, 1);
        }
      } else {
        // 转发 - 创建一条新的转发推文
        tweet.retweets.push(currentUser);

        // 创建转发推文
        const retweetedTweet = {
          id: twitterData.nextTweetId++,
          userId: currentUser,
          content: tweet.content,
          timestamp: Date.now(),
          likes: [],
          retweets: [],
          replies: [],
          isRetweet: true,
          originalTweetId: tweetId,
          originalUserId: tweet.userId
        };

        twitterData.tweets.unshift(retweetedTweet);

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
      } else {
        twitterData.bookmarks[currentUser].push(tweetId);
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
        // 通过私信发送
        document.body.removeChild(overlay);
        await showSendViaDMDialog(tweet, roche);
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
 * 显示通过私信发送对话框
 */
async function showSendViaDMDialog(tweet, roche) {
  const user = twitterData.users[tweet.userId];

  // 创建遮罩层
  const overlay = document.createElement('div');
  overlay.className = 'select-dialog';
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
    z-index: 10001;
    padding: 20px;
  `;

  // 获取对话列表
  const conversations = await roche.conversation.list();

  // 创建对话框
  const dialog = document.createElement('div');
  dialog.style.cssText = `
    background: white;
    border-radius: 16px;
    width: 100%;
    max-width: 400px;
    max-height: 600px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  `;

  dialog.innerHTML = `
    <div style="padding: 20px; border-bottom: 1px solid #eff3f4;">
      <h3 style="margin: 0; font-size: 20px; font-weight: 700; color: #0f1419;">发送给</h3>
      <div style="margin-top: 8px; font-size: 13px; color: #536471;">
        ${user.name}：${tweet.content.substring(0, 50)}${tweet.content.length > 50 ? '...' : ''}
      </div>
    </div>
    <div style="overflow-y: auto; flex: 1;">
      ${conversations.length === 0 ? '<div style="padding: 40px 20px; text-align: center; color: #536471;">暂无对话</div>' : ''}
    </div>
    <div style="padding: 16px; border-top: 1px solid #eff3f4;">
      <button class="select-dialog-cancel" style="width: 100%; padding: 12px; border: none; background: #eff3f4; color: #0f1419; font-weight: 700; border-radius: 20px; cursor: pointer;">取消</button>
    </div>
  `;

  // 添加对话列表
  const listContainer = dialog.querySelector('div[style*="overflow-y"]');
  conversations.forEach(conv => {
    const item = document.createElement('div');
    item.className = 'select-dialog-item';
    item.style.cssText = `
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 20px;
      cursor: pointer;
      transition: background 0.2s;
    `;

    // 获取真实 Char 头像
    const charAvatar = conv.avatar || conv.avatarUrl || conv.image || conv.imageUrl || conv.icon || conv.picture;
    const firstChar = (conv.name || conv.title || 'C')[0].toUpperCase();

    const avatar = charAvatar
      ? `<img src="${charAvatar}" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; flex-shrink: 0;" alt="">`
      : `<div style="width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 20px; flex-shrink: 0;">
          ${firstChar}
        </div>`;

    item.innerHTML = `
      ${avatar}
      <div style="flex: 1; min-width: 0;">
        <div style="font-weight: 700; font-size: 15px; color: #0f1419;">${conv.name || conv.title || '未命名对话'}</div>
      </div>
    `;

    item.addEventListener('click', async () => {
      // 发送推文到私信
      try {
        const message = `分享了 ${user.name} 的推文：\n\n${tweet.content}\n\nhttps://twitter.com/${user.username}/status/${tweet.id}`;

        // 保存到记忆
        await roche.memory.saveLongTerm({
          conversationId: conv.id,
          text: message,
          metadata: { role: 'user', timestamp: Date.now(), type: 'tweet_share' },
          importance: 3
        });

        showToast('已发送到私信', 'success');
        document.body.removeChild(overlay);

        // 切换到私信页面并打开对话
        setTimeout(() => {
          switchView('messages');
          // 加载消息列表后打开对话
          setTimeout(() => {
            showChatWithConversation(conv.id, roche);
          }, 100);
        }, 300);
      } catch (error) {
        console.error('[Twitter] 发送私信失败:', error);
        showToast('发送失败', 'error');
      }
    });

    item.addEventListener('mouseenter', () => {
      item.style.background = 'rgba(0, 0, 0, 0.03)';
    });

    item.addEventListener('mouseleave', () => {
      item.style.background = 'transparent';
    });

    listContainer.appendChild(item);
  });

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  // 取消按钮
  dialog.querySelector('.select-dialog-cancel').addEventListener('click', () => {
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
 * 显示回复对话框
 */
function showReplyDialog(tweet, roche) {
  const tweetUser = twitterData.users[tweet.userId];
  if (!tweetUser) return;

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

  const dialog = document.createElement('div');
  dialog.style.cssText = `
    background: white;
    border-radius: 16px 16px 0 0;
    width: 100%;
    max-width: 600px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    animation: slideUp 0.3s;
  `;

  const avatarHtml = tweetUser.avatar
    ? `<img src="${tweetUser.avatar}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">`
    : generateAvatar(tweetUser.name);

  const currentUserData = twitterData.users[currentUser];
  const currentUserAvatar = currentUserData?.avatar
    ? `<img src="${currentUserData.avatar}" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover;">`
    : generateAvatar(currentUserData?.name || 'User');

  dialog.innerHTML = `
    <div style="padding: 16px; border-bottom: 1px solid #eff3f4; display: flex; justify-content: space-between; align-items: center;">
      <button id="reply-cancel" style="background: none; border: none; color: #0f1419; font-size: 15px; font-weight: 600; cursor: pointer;">取消</button>
      <div style="font-size: 17px; font-weight: 700;">回复</div>
      <button id="reply-send" style="background: #1d9bf0; color: white; border: none; padding: 8px 16px; border-radius: 20px; font-weight: 700; font-size: 15px; cursor: pointer;" disabled>回复</button>
    </div>

    <div style="flex: 1; overflow-y: auto; padding: 16px;">
      <!-- 原推文 -->
      <div style="display: flex; gap: 12px; margin-bottom: 16px;">
        <div style="display: flex; flex-direction: column; align-items: center;">
          ${avatarHtml}
          <div style="flex: 1; width: 2px; background: #cfd9de; margin-top: 4px;"></div>
        </div>
        <div style="flex: 1;">
          <div style="display: flex; align-items: center; gap: 4px; margin-bottom: 4px;">
            <span style="font-weight: 700; font-size: 15px;">${escapeHtml(tweetUser.name)}</span>
            <span style="color: #536471; font-size: 15px;">${tweetUser.username}</span>
          </div>
          <div style="font-size: 15px; color: #0f1419; line-height: 1.5; margin-bottom: 8px;">${escapeHtml(tweet.content)}</div>
          <div style="color: #536471; font-size: 15px;">回复 ${tweetUser.username}</div>
        </div>
      </div>

      <!-- 回复输入区 -->
      <div style="display: flex; gap: 12px;">
        ${currentUserAvatar}
        <div style="flex: 1;">
          <textarea id="reply-input" placeholder="发布你的回复" style="width: 100%; min-height: 80px; border: none; outline: none; font-size: 17px; resize: none; font-family: inherit;"></textarea>
        </div>
      </div>
    </div>
  `;

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  const replyInput = document.getElementById('reply-input');
  const sendBtn = document.getElementById('reply-send');

  // 监听输入
  replyInput.addEventListener('input', () => {
    sendBtn.disabled = !replyInput.value.trim();
  });

  // 自动聚焦
  setTimeout(() => replyInput.focus(), 100);

  // 取消按钮
  document.getElementById('reply-cancel').addEventListener('click', () => {
    document.body.removeChild(overlay);
  });

  // 发送回复
  sendBtn.addEventListener('click', async () => {
    const content = replyInput.value.trim();
    if (!content) return;

    try {
      // 创建回复推文
      const replyTweet = {
        id: twitterData.nextTweetId++,
        userId: currentUser,
        content: content,
        timestamp: Date.now(),
        likes: [],
        retweets: [],
        replies: [],
        replyTo: tweet.id
      };

      twitterData.tweets.unshift(replyTweet);
      tweet.replies.push(replyTweet.id);

      await saveData(roche);

      showToast('回复成功', 'success');
      document.body.removeChild(overlay);

      // 刷新推文列表
      renderTweets(roche);
    } catch (error) {
      console.error('回复失败:', error);
      showToast('回复失败', 'error');
    }
  });

  // 点击背景关闭
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      document.body.removeChild(overlay);
    }
  });
}

/**
 * 显示分享对话框
 */
async function showShareDialog(tweet, roche) {
  try {
    // 获取所有对话列表
    const conversations = await roche.conversation.list();

    if (!conversations || conversations.length === 0) {
      showToast('暂无可分享的对话', 'info');
      return;
    }

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
      max-width: 500px;
      width: 100%;
      max-height: 70vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      animation: scaleIn 0.2s;
      overflow: hidden;
    `;

    // 获取帖子作者信息
    const tweetUser = twitterData.users[tweet.userId];
    if (!tweetUser) {
      console.error('[Twitter] 找不到推文作者:', tweet.userId);
      showToast('推文信息错误', 'error');
      return;
    }
    const tweetContent = tweet.content.length > 100 ? tweet.content.substring(0, 100) + '...' : tweet.content;

    dialog.innerHTML = `
      <div style="padding: 20px; border-bottom: 1px solid #eff3f4; display: flex; justify-content: space-between; align-items: center;">
        <div style="font-size: 20px; font-weight: 700; color: #0f1419;">分享推文</div>
        <div class="dialog-close-btn" style="width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background 0.2s;">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M13.414 12l5.793-5.793c.39-.39.39-1.023 0-1.414s-1.023-.39-1.414 0L12 10.586 6.207 4.793c-.39-.39-1.023-.39-1.414 0s-.39 1.023 0 1.414L10.586 12l-5.793 5.793c-.39.39-.39 1.023 0 1.414.195.195.45.293.707.293s.512-.098.707-.293L12 13.414l5.793 5.793c.195.195.45.293.707.293s.512-.098.707-.293c.39-.39.39-1.023 0-1.414L13.414 12z"></path>
          </svg>
        </div>
      </div>

      <!-- 推文预览 -->
      <div style="padding: 16px; border-bottom: 1px solid #eff3f4; background: #f7f9f9;">
        <div style="font-size: 13px; color: #536471; margin-bottom: 8px;">分享内容</div>
        <div style="display: flex; gap: 12px;">
          <img src="${tweetUser.avatar}" style="width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0; object-fit: cover;" alt="">
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 700; font-size: 14px; color: #0f1419;">${tweetUser.name}</div>
            <div style="font-size: 14px; color: #0f1419; margin-top: 4px;">${escapeHtml(tweetContent)}</div>
          </div>
        </div>
      </div>

      <!-- 对话列表 -->
      <div style="flex: 1; overflow-y: auto; padding: 12px;" id="share-conversation-list">
        <div style="font-size: 15px; font-weight: 700; color: #0f1419; margin-bottom: 12px; padding: 0 8px;">选择对话</div>
        ${conversations.map(conv => {
          const charAvatar = conv.avatar || conv.avatarUrl || conv.image || conv.imageUrl || conv.icon || conv.picture;
          const initial = conv.title ? conv.title.charAt(0).toUpperCase() : '?';

          const avatarHtml = charAvatar
            ? `<img src="${charAvatar}" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; flex-shrink: 0;" alt="">`
            : `<div style="width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; color: white; font-size: 20px; font-weight: 700; flex-shrink: 0;">
                ${initial}
              </div>`;

          return `
            <div class="share-conversation-item" data-conv-id="${conv.id}" style="padding: 12px; display: flex; align-items: center; gap: 12px; cursor: pointer; transition: background 0.2s; border-radius: 8px;">
              ${avatarHtml}
              <div style="flex: 1; min-width: 0;">
                <div style="font-size: 15px; font-weight: 700; color: #0f1419;">${conv.title || '未命名对话'}</div>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <style>
        .share-conversation-item:hover {
          background: rgba(0, 0, 0, 0.03);
        }
        .dialog-close-btn:hover {
          background: rgba(0, 0, 0, 0.05);
        }
      </style>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // 绑定关闭按钮
    dialog.querySelector('.dialog-close-btn').addEventListener('click', () => {
      document.body.removeChild(overlay);
    });

    // 绑定对话项点击事件
    dialog.querySelectorAll('.share-conversation-item').forEach(item => {
      item.addEventListener('click', async () => {
        const convId = item.dataset.convId;
        document.body.removeChild(overlay);

        // 分享推文到私信
        await shareTweetToConversation(tweet, convId, roche);
      });
    });

  } catch (error) {
    console.error('显示分享对话框失败:', error);
    showToast('加载失败', 'error');
  }
}

/**
 * 分享推文到对话
 */
async function shareTweetToConversation(tweet, convId, roche) {
  try {
    const tweetUser = twitterData.users[tweet.userId];
    if (!tweetUser) {
      console.error('[Twitter] 找不到推文作者:', tweet.userId);
      showToast('推文信息错误', 'error');
      return;
    }

    const shareMessage = `【分享推文】\n\n@${tweetUser.username}: ${tweet.content}\n\n—— 来自 Twitter`;

    // 使用 roche.ai.chat 发送分享消息（这样会自动保存到记忆）
    await roche.ai.chat({
      conversationId: convId,
      messages: [
        {
          role: 'user',
          content: shareMessage
        }
      ],
      stream: false
    });

    showToast('已分享到私信', 'success');

    // 切换到私信页面并打开对话
    setTimeout(() => {
      switchView('messages');
      // 加载消息列表后打开对话
      setTimeout(() => {
        openChatWithConv(roche, convId);
      }, 100);
    }, 300);
  } catch (error) {
    console.error('分享失败:', error);
    showToast('分享失败: ' + error.message, 'error');
  }
}

/**
 * 处理推文操作
 */
async function handleTweetAction(action, tweetId, roche) {
  const tweet = twitterData.tweets.find(t => t.id === tweetId);
  if (!tweet) return;

  // 如果是 NPC 的推文，更新兴趣度
  if (twitterData.npcs[tweet.userId]) {
    updateNPCInterest(currentUser, tweet.userId, action);
  }

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
        // 取消转发 - 删除转发的推文
        tweet.retweets.splice(retweetIndex, 1);

        // 找到并删除转发的推文
        const retweetedTweetIndex = twitterData.tweets.findIndex(t =>
          t.isRetweet && t.originalTweetId === tweetId && t.userId === currentUser
        );
        if (retweetedTweetIndex > -1) {
          twitterData.tweets.splice(retweetedTweetIndex, 1);
        }
      } else {
        // 转发 - 创建一条新的转发推文
        tweet.retweets.push(currentUser);

        // 创建转发推文
        const retweetedTweet = {
          id: twitterData.nextTweetId++,
          userId: currentUser,
          content: tweet.content,
          timestamp: Date.now(),
          likes: [],
          retweets: [],
          replies: [],
          isRetweet: true,
          originalTweetId: tweetId,
          originalUserId: tweet.userId
        };

        twitterData.tweets.unshift(retweetedTweet);
      }
      break;

    case 'bookmark':
      if (!twitterData.bookmarks[currentUser]) {
        twitterData.bookmarks[currentUser] = [];
      }
      const bookmarkIndex = twitterData.bookmarks[currentUser].indexOf(tweetId);
      if (bookmarkIndex > -1) {
        twitterData.bookmarks[currentUser].splice(bookmarkIndex, 1);
      } else {
        twitterData.bookmarks[currentUser].push(tweetId);
      }
      break;

    case 'reply':
      showReplyDialog(tweet, roche);
      return;

    case 'share':
      showShareDialog(tweet, roche);
      return;
  }

  await saveData(roche);

  // 只更新当前推文的按钮状态，不重新渲染整个列表
  updateTweetButtons(tweetId);
}

/**
 * 更新推文按钮状态（不重新渲染整个列表）
 */
function updateTweetButtons(tweetId) {
  const tweet = twitterData.tweets.find(t => t.id === tweetId);
  if (!tweet) return;

  // 查找所有显示这条推文的元素
  document.querySelectorAll(`[data-tweet-id="${tweetId}"]`).forEach(tweetEl => {
    // 更新点赞按钮
    const likeBtn = tweetEl.querySelector('[data-action="like"]');
    if (likeBtn) {
      const isLiked = tweet.likes.includes(currentUser);
      if (isLiked) {
        likeBtn.classList.add('liked');
      } else {
        likeBtn.classList.remove('liked');
      }
      const likeIcon = likeBtn.querySelector('.action-icon');
      if (likeIcon) {
        likeIcon.innerHTML = isLiked ? icons.likeFilled : icons.like;
      }
      const likeCount = likeBtn.querySelector('span:last-child');
      if (likeCount) {
        likeCount.textContent = tweet.likes.length || '';
      }
    }

    // 更新转发按钮
    const retweetBtn = tweetEl.querySelector('[data-action="retweet"]');
    if (retweetBtn) {
      const isRetweeted = tweet.retweets.includes(currentUser);
      if (isRetweeted) {
        retweetBtn.classList.add('retweeted');
      } else {
        retweetBtn.classList.remove('retweeted');
      }
      const retweetCount = retweetBtn.querySelector('span:last-child');
      if (retweetCount) {
        retweetCount.textContent = tweet.retweets.length || '';
      }
    }

    // 更新书签按钮
    const bookmarkBtn = tweetEl.querySelector('[data-action="bookmark"]');
    if (bookmarkBtn) {
      const isBookmarked = twitterData.bookmarks[currentUser]?.includes(tweetId);
      if (isBookmarked) {
        bookmarkBtn.classList.add('bookmarked');
      } else {
        bookmarkBtn.classList.remove('bookmarked');
      }
      const bookmarkIcon = bookmarkBtn.querySelector('.action-icon');
      if (bookmarkIcon) {
        bookmarkIcon.innerHTML = isBookmarked ? icons.bookmarkFilled : icons.bookmark;
      }
    }
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
  if (!recommendedEl) {
    console.log('[Twitter] 推荐用户容器未找到，跳过渲染');
    return;
  }

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
 * 显示删除对话确认对话框
 */
function showDeleteConversationDialog(roche, convId) {
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

  const dialog = document.createElement('div');
  dialog.style.cssText = `
    background: white;
    border-radius: 16px;
    width: 85%;
    max-width: 320px;
    overflow: hidden;
    animation: slideUp 0.3s;
  `;

  dialog.innerHTML = `
    <div style="padding: 24px 24px 16px;">
      <h3 style="margin: 0 0 8px; font-size: 20px; font-weight: 700; color: #0f1419;">删除对话？</h3>
      <p style="margin: 0; font-size: 15px; color: #536471; line-height: 20px;">此操作无法撤销，对话记录将被永久删除。</p>
    </div>
    <div style="padding: 12px; border-top: 1px solid #eff3f4; display: flex; gap: 12px;">
      <button id="cancel-delete" style="flex: 1; padding: 10px; border: 1px solid #cfd9de; background: white; color: #0f1419; border-radius: 20px; font-weight: 600; font-size: 15px; cursor: pointer;">取消</button>
      <button id="confirm-delete" style="flex: 1; padding: 10px; border: none; background: #f4212e; color: white; border-radius: 20px; font-weight: 600; font-size: 15px; cursor: pointer;">删除</button>
    </div>
  `;

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  // 取消按钮
  document.getElementById('cancel-delete').addEventListener('click', () => {
    document.body.removeChild(overlay);
  });

  // 确认删除
  document.getElementById('confirm-delete').addEventListener('click', async () => {
    try {
      await roche.conversation.delete({ conversationId: convId });
      showToast('对话已删除', 'success');
      document.body.removeChild(overlay);
      renderMessages(roche);
    } catch (error) {
      console.error('删除对话失败:', error);
      showToast('删除失败', 'error');
      document.body.removeChild(overlay);
    }
  });

  // 点击背景关闭
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      document.body.removeChild(overlay);
    }
  });
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
        // 获取对话历史（使用短期记忆）
        let lastMessage = '开始新对话...';
        let lastTimestamp = conv.updatedAt || Date.now();

        try {
          const history = await roche.memory.getShortTerm({
            conversationId: conv.id,
            limit: 10  // 获取最近10条，确保能拿到最新的
          });

          if (history && history.length > 0) {
            // 取最后一条消息（最新的）
            const lastMsg = history[history.length - 1];
            lastMessage = lastMsg.text || lastMsg.content || '开始新对话...';
            lastTimestamp = lastMsg.timestamp || lastTimestamp;
          }
        } catch (e) {
          console.log('[Twitter] 获取对话历史失败:', e);
          // 保持默认值
        }

        // 获取 Char 头像
        let avatarUrl = null;

        // 1. 尝试通过 character API 获取
        if (conv.id) {
          try {
            const character = await roche.character.get(conv.id);
            if (character?.avatar) {
              avatarUrl = character.avatar;
            }
          } catch (e) {
            console.log('[Twitter] character API 调用失败:', e);
          }
        }

        // 2. 如果还没有头像，检查 conversation 本身的字段
        if (!avatarUrl) {
          const possibleFields = ['avatar', 'avatarUrl', 'image', 'imageUrl', 'icon', 'picture'];
          for (const field of possibleFields) {
            if (conv[field]) {
              avatarUrl = conv[field];
              break;
            }
          }
        }

        return {
          ...conv,
          lastMessage,
          lastTimestamp,
          avatarUrl,
          unread: false // 可以后续添加未读逻辑
        };
      } catch (e) {
        console.error('[Twitter] 处理对话失败:', e);
        return null;
      }
    }));

    // 过滤掉 null 值（没有消息记录的对话）
    const validConversations = conversationsWithMessages.filter(conv => conv !== null);

    // 如果没有有效对话，显示欢迎界面
    if (validConversations.length === 0) {
      if (welcomeEl) welcomeEl.style.display = 'block';
      if (messagesEl) messagesEl.style.display = 'none';
      return;
    }

    // 按时间排序
    validConversations.sort((a, b) => b.lastTimestamp - a.lastTimestamp);

    // 渲染对话列表
    messagesEl.innerHTML = validConversations.map(conv => {
      // 头像处理
      const initial = conv.title ? conv.title.charAt(0).toUpperCase() : '?';
      const avatarGradient = `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`;

      // 如果有真实头像，显示图片；否则显示首字母
      const avatarHtml = conv.avatarUrl
        ? `<img src="${conv.avatarUrl}" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; flex-shrink: 0;" alt="${conv.title || '头像'}">`
        : `<div style="width: 48px; height: 48px; border-radius: 50%; background: ${avatarGradient}; display: flex; align-items: center; justify-content: center; color: white; font-size: 20px; font-weight: 700; flex-shrink: 0;">${initial}</div>`;

      return `
        <div class="message-item-wrapper" style="position: relative;" data-conv-id="${conv.id}">
          <div class="message-item" data-conv-id="${conv.id}" style="padding: 16px; display: flex; align-items: center; gap: 12px; cursor: pointer; transition: background 0.2s; border-bottom: 1px solid #eff3f4; background: white;">
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

    // 添加长按删除功能
    messagesEl.querySelectorAll('.message-item-wrapper').forEach(wrapper => {
      const messageItem = wrapper.querySelector('.message-item');
      let pressTimer = null;
      let longPressTriggered = false;

      // 触摸开始
      messageItem.addEventListener('touchstart', (e) => {
        longPressTriggered = false;
        pressTimer = setTimeout(() => {
          longPressTriggered = true;
          // 长按触发删除确认
          const convId = wrapper.dataset.convId;
          showDeleteConversationDialog(roche, convId);
        }, 800); // 长按 800ms
      });

      // 触摸结束
      messageItem.addEventListener('touchend', () => {
        if (pressTimer) {
          clearTimeout(pressTimer);
        }
      });

      // 触摸移动时取消长按
      messageItem.addEventListener('touchmove', () => {
        if (pressTimer) {
          clearTimeout(pressTimer);
        }
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

  // 为每个对话获取记忆摘要和头像
  const conversationsWithInfo = await Promise.all(conversations.map(async (conv) => {
    try {
      // 获取长期记忆
      const longTerm = await roche.memory.getLongTerm({ conversationId: conv.id, limit: 5 });
      const memories = [...(longTerm.facts || []), ...(longTerm.vectors || [])];
      const memorySummary = memories.length > 0
        ? (memories[0].summaryText || memories[0].text || '').substring(0, 50)
        : '暂无记忆';

      // 获取 Char 头像
      let avatarUrl = null;

      // 1. 尝试通过 persona API 获取
      if (conv.id) {
        try {
          const persona = await roche.persona.get(conv.id);
          if (persona?.avatar) {
            avatarUrl = persona.avatar;
          }
        } catch (e) {
          // persona API 失败
        }
      }

      // 2. 检查 conversation 本身的字段
      if (!avatarUrl) {
        const possibleFields = ['avatar', 'avatarUrl', 'image', 'imageUrl', 'icon', 'picture'];
        for (const field of possibleFields) {
          if (conv[field]) {
            avatarUrl = conv[field];
            break;
          }
        }
      }

      return {
        ...conv,
        memorySummary,
        avatarUrl
      };
    } catch (e) {
      return {
        ...conv,
        memorySummary: '暂无记忆',
        avatarUrl: null
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
        const avatarGradient = `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`;

        // 如果有真实头像，显示图片；否则显示首字母
        const avatarHtml = conv.avatarUrl
          ? `<img src="${conv.avatarUrl}" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; flex-shrink: 0;" alt="${conv.title || '头像'}">`
          : `<div style="width: 48px; height: 48px; border-radius: 50%; background: ${avatarGradient}; display: flex; align-items: center; justify-content: center; color: white; font-size: 20px; font-weight: 700;">${initial}</div>`;

        return `
        <div class="contact-item" data-conv-id="${conv.id}" style="padding: 16px; display: flex; align-items: center; gap: 12px; cursor: pointer; transition: background 0.2s;">
          ${avatarHtml}
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
  const bottomNav = document.querySelector('.mobile-bottom-nav');

  if (messagesListView) {
    messagesListView.classList.add('hidden');
  }
  if (chatView) {
    chatView.classList.add('active');
  }
  // 隐藏底部导航栏
  if (bottomNav) {
    bottomNav.style.display = 'none';
  }
}

/**
 * 使用 conversationId 打开聊天界面（连接到 Roche Char）
 */
let currentConversationId = null;

async function openChatWithConv(convId, roche) {
  console.log('[Twitter] === 开始打开聊天 ===', convId);
  try {
    currentConversationId = convId;

    // 获取对话信息
    const conversations = await roche.conversation.list();
    console.log('[Twitter] 所有对话:', conversations);
    const conv = conversations.find(c => c.id === convId);
    console.log('[Twitter] 找到的对话:', conv);

    if (!conv) {
      showToast('对话不存在', 'error');
      return;
    }

    // 获取 Char 头像
    let charAvatar = null;
    console.log('[Twitter] 开始获取 Char 头像...');

    // 1. 检查 conversation 本身的字段
    const possibleFields = ['avatar', 'avatarUrl', 'image', 'imageUrl', 'icon', 'picture'];
    for (const field of possibleFields) {
      if (conv[field]) {
        charAvatar = conv[field];
        console.log(`[Twitter] 聊天页面 - 在 conversation.${field} 找到头像:`, charAvatar);
        break;
      }
    }

    // 2. 如果还没有，使用默认头像（首字母渐变）
    if (!charAvatar) {
      const initial = (conv.title || '?').charAt(0).toUpperCase();
      charAvatar = `data:image/svg+xml,${encodeURIComponent(`
        <svg width="48" height="48" xmlns="http://www.w3.org/2000/svg">
          <circle cx="24" cy="24" r="24" fill="#667eea"/>
          <text x="24" y="32" font-size="20" fill="white" text-anchor="middle" font-family="Arial">${initial}</text>
        </svg>
      `)}`;
      console.log('[Twitter] 聊天页面 - 使用默认头像（首字母）:', initial);
    }

    console.log('[Twitter] 最终使用的 Char 头像:', charAvatar);

    // 更新聊天头部
    document.getElementById('chat-user-name').textContent = conv.title || '未命名对话';

    // 获取聊天历史（使用短期记忆 API）
    const chatMessages = document.getElementById('chat-messages');

    try {
      const history = await roche.memory.getShortTerm({
        conversationId: convId,
        limit: 50
      });

      console.log('[Twitter] 获取到的聊天历史:', history);

      if (history && history.length > 0) {
        // 渲染聊天历史
        const currentUserData = twitterData.users[currentUser];
        const userAvatar = currentUserData?.avatar || generateAvatar(currentUserData?.name || 'User');

        chatMessages.innerHTML = history.map(msg => {
          const isOwn = msg.role === 'user' || msg.senderId === currentUser;
          const avatar = isOwn ? userAvatar : charAvatar;
          const content = msg.text || msg.content || '';

          return `
            <div class="chat-message ${isOwn ? 'own' : ''}" style="display: flex; gap: 8px; margin-bottom: 16px; ${isOwn ? 'flex-direction: row-reverse;' : ''}">
              <img class="chat-message-avatar" src="${avatar}" alt="" style="width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0; object-fit: cover;">
              <div class="chat-message-bubble" style="
                background: ${isOwn ? '#1d9bf0' : '#eff3f4'};
                color: ${isOwn ? 'white' : '#0f1419'};
                padding: 12px 16px;
                border-radius: 18px;
                max-width: 70%;
                word-wrap: break-word;
              ">${escapeHtml(content)}</div>
            </div>
          `;
        }).join('');
      } else {
        // 没有历史消息
        chatMessages.innerHTML = `
          <div style="text-align: center; padding: 40px 20px; color: #536471;">
            <div style="font-size: 15px; margin-bottom: 8px;">开始新对话</div>
            <div style="font-size: 13px;">发送消息与 ${conv.title || 'AI'} 聊天</div>
          </div>
        `;
      }
    } catch (error) {
      console.error('[Twitter] 获取聊天历史失败:', error);
      chatMessages.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: #536471;">
          <div style="font-size: 15px; margin-bottom: 8px;">开始新对话</div>
          <div style="font-size: 13px;">发送消息与 ${conv.title || 'AI'} 聊天</div>
        </div>
      `;
    }

    // 滚动到底部
    setTimeout(() => {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }, 100);

    // 显示聊天界面
    const messagesListView = document.getElementById('messages-list-view');
    const chatView = document.getElementById('chat-view');
    const bottomNav = document.querySelector('.mobile-bottom-nav');

    if (messagesListView) {
      messagesListView.classList.add('hidden');
    }
    if (chatView) {
      chatView.classList.add('active');
    }
    // 隐藏底部导航栏
    if (bottomNav) {
      bottomNav.style.display = 'none';
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

    // 绑定设置按钮
    const chatSettingsBtn = document.querySelector('.chat-settings-btn');
    if (chatSettingsBtn) {
      chatSettingsBtn.onclick = () => {
        showChatSettings(roche, currentConversationId);
      };
    }

  } catch (error) {
    console.error('打开聊天失败:', error);
    showToast('加载聊天失败', 'error');
  }
}

/**
 * 显示聊天设置对话框
 */
async function showChatSettings(roche, convId) {
  try {
    // 获取当前设置（对齐 Roche 原生设置）
    const chatSettings = await roche.storage.get(`twitter-chat-settings-${convId}`) || {
      enableLongTermMemory: true,        // 长期记忆开关
      summaryTriggerCount: 200,          // 总结触发条数
      coreMemoryLimit: 500,              // 核心记忆上限（字）
      recentFactsLimit: 2,               // 最新事实注入上限
      enableVectorSearch: true,          // 向量记忆检索
      enableRelevanceScoring: true,      // 记忆相关性打分
      manualSyncBatch: 8,                // 手动同步批量
      factCleaningRange: 30,             // 事实清洗范围
      singleCleaningLimit: 3             // 单次清洗上限
    };

    // 获取当前对话的所有记忆
    const longTerm = await roche.memory.getLongTerm({ conversationId: convId, limit: 100 });
    const memories = [...(longTerm.facts || []), ...(longTerm.vectors || [])];

    // 过滤出非消息类记忆（importance >= 5 的是总结记忆）
    const summaryMemories = memories.filter(m =>
      !m.metadata?.role && (m.importance >= 5 || m.summaryText)
    );

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
      max-width: 600px;
      width: 100%;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      animation: scaleIn 0.2s;
      overflow: hidden;
    `;

    dialog.innerHTML = `
      <div style="padding: 20px; border-bottom: 1px solid #eff3f4; display: flex; justify-content: space-between; align-items: center;">
        <div style="font-size: 20px; font-weight: 700; color: #0f1419;">聊天设置</div>
        <div class="dialog-close-btn" style="width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background 0.2s;">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M13.414 12l5.793-5.793c.39-.39.39-1.023 0-1.414s-1.023-.39-1.414 0L12 10.586 6.207 4.793c-.39-.39-1.023-.39-1.414 0s-.39 1.023 0 1.414L10.586 12l-5.793 5.793c-.39.39-.39 1.023 0 1.414.195.195.45.293.707.293s.512-.098.707-.293L12 13.414l5.793 5.793c.195.195.45.293.707.293s.512-.098.707-.293c.39-.39.39-1.023 0-1.414L13.414 12z"></path>
          </svg>
        </div>
      </div>

      <div style="flex: 1; overflow-y: auto; padding: 20px;">
        <!-- 总结记忆列表 -->
        <div>
          <div style="font-size: 15px; font-weight: 700; color: #0f1419; margin-bottom: 12px;">总结记忆 (${summaryMemories.length})</div>
          <div style="font-size: 13px; color: #536471; margin-bottom: 16px;">查看和管理由 Roche 自动总结的长期记忆</div>
          <div id="summary-memories-list" style="display: flex; flex-direction: column; gap: 12px;">
            ${summaryMemories.length === 0 ? `
              <div style="text-align: center; padding: 40px 20px; color: #536471;">
                <div style="font-size: 15px;">暂无总结记忆</div>
              </div>
            ` : summaryMemories.map((mem) => `
              <div class="memory-card" data-memory-index="${summaryMemories.indexOf(mem)}" style="position: relative; background: #f7f9f9; border-radius: 12px; padding: 16px; transition: background 0.2s;">
                <!-- 操作按钮（右上角，隐蔽） -->
                <div style="position: absolute; top: 8px; right: 8px; display: flex; gap: 4px; opacity: 0.3; transition: opacity 0.2s;" class="memory-actions">
                  <div class="memory-edit-btn" data-memory-index="${summaryMemories.indexOf(mem)}" style="width: 28px; height: 28px; border-radius: 50%; background: rgba(255,255,255,0.8); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background 0.2s;" title="编辑">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="#536471">
                      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"></path>
                    </svg>
                  </div>
                  <div class="memory-delete-btn" data-memory-index="${summaryMemories.indexOf(mem)}" style="width: 28px; height: 28px; border-radius: 50%; background: rgba(255,255,255,0.8); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background 0.2s;" title="删除">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="#f91880">
                      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"></path>
                    </svg>
                  </div>
                </div>

                <div style="font-size: 14px; color: #0f1419; line-height: 1.5; padding-right: 60px;">${escapeHtml(mem.summaryText || mem.text || '')}</div>
                <div style="font-size: 12px; color: #536471; margin-top: 8px;">重要度: ${mem.importance || 5}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <style>
        .memory-card:hover {
          background: #eff3f4;
        }
        .memory-card:hover .memory-actions {
          opacity: 1 !important;
        }
        .memory-edit-btn:hover, .memory-delete-btn:hover {
          background: white !important;
        }
      </style>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // 绑定关闭按钮
    dialog.querySelector('.dialog-close-btn').addEventListener('click', () => {
      document.body.removeChild(overlay);
    });

    // 绑定编辑按钮
    dialog.querySelectorAll('.memory-edit-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const memoryIndex = parseInt(e.currentTarget.dataset.memoryIndex);
        const memory = summaryMemories[memoryIndex];
        if (memory) {
          document.body.removeChild(overlay);
          editMemory(roche, convId, memory, summaryMemories);
        }
      });
    });

    // 绑定删除按钮
    dialog.querySelectorAll('.memory-delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const memoryIndex = parseInt(e.currentTarget.dataset.memoryIndex);
        const memory = summaryMemories[memoryIndex];
        if (memory && confirm('确定删除这条记忆吗？')) {
          try {
            // 调用 Roche 的删除记忆 API
            // 注意：可能需要根据 Roche 实际 API 调整
            if (memory.id) {
              await roche.memory.delete({
                conversationId: convId,
                id: memory.id
              });
            }
            showToast('记忆已删除', 'success');
            // 重新打开设置对话框
            document.body.removeChild(overlay);
            showChatSettings(roche, convId);
          } catch (error) {
            console.error('删除记忆失败:', error);
            showToast('删除失败: ' + error.message, 'error');
          }
        }
      });
    });

  } catch (error) {
    console.error('打开设置失败:', error);
    showToast('加载设置失败', 'error');
  }
}

/**
 * 编辑记忆
 */
function editMemory(roche, convId, memory, allMemories) {
  // 创建编辑对话框
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
    z-index: 10001;
    padding: 20px;
  `;

  const dialog = document.createElement('div');
  dialog.style.cssText = `
    background: white;
    border-radius: 16px;
    max-width: 500px;
    width: 100%;
    padding: 20px;
  `;

  dialog.innerHTML = `
    <div style="font-size: 18px; font-weight: 700; margin-bottom: 16px;">编辑记忆</div>
    <textarea id="edit-memory-text" style="width: 100%; height: 120px; padding: 12px; border: 1px solid #eff3f4; border-radius: 8px; font-size: 15px; resize: none; outline: none; font-family: inherit;">${escapeHtml(memory.summaryText || memory.text || '')}</textarea>
    <div style="margin-top: 16px; display: flex; gap: 12px;">
      <button id="cancel-edit-btn" style="flex: 1; padding: 12px; background: #eff3f4; color: #0f1419; border: none; border-radius: 24px; font-size: 15px; font-weight: 700; cursor: pointer;">
        取消
      </button>
      <button id="save-edit-btn" style="flex: 1; padding: 12px; background: #1d9bf0; color: white; border: none; border-radius: 24px; font-size: 15px; font-weight: 700; cursor: pointer;">
        保存
      </button>
    </div>
  `;

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  document.getElementById('cancel-edit-btn').addEventListener('click', () => {
    document.body.removeChild(overlay);
    showChatSettings(roche, convId);
  });

  document.getElementById('save-edit-btn').addEventListener('click', async () => {
    const newText = document.getElementById('edit-memory-text').value.trim();
    if (!newText) {
      showToast('内容不能为空', 'error');
      return;
    }

    try {
      // 调用 Roche 的更新记忆 API
      // 注意：可能需要根据 Roche 实际 API 调整
      if (memory.id) {
        await roche.memory.update({
          conversationId: convId,
          id: memory.id,
          text: newText
        });
      }
      showToast('记忆已更新', 'success');
      document.body.removeChild(overlay);
      // 重新打开设置对话框
      showChatSettings(roche, convId);
    } catch (error) {
      console.error('更新记忆失败:', error);
      showToast('更新失败: ' + error.message, 'error');
    }
  });
}

/**
 * 发送消息到 Roche 对话
 */
/**
 * 发送消息到对话（使用 Roche AI API）
 */
async function sendMessageToConv(roche, content) {
  if (!content || !currentConversationId) return;

  try {
    const chatMessages = document.getElementById('chat-messages');

    // 1. 立即显示用户消息
    const currentUserData = twitterData.users[currentUser];
    const userAvatar = currentUserData?.avatar || generateAvatar(currentUserData?.name || 'User');

    const userMessageHtml = `
      <div class="chat-message own" style="display: flex; gap: 8px; margin-bottom: 16px; flex-direction: row-reverse;">
        <img class="chat-message-avatar" src="${userAvatar}" alt="" style="width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0; object-fit: cover;">
        <div class="chat-message-bubble" style="
          background: #1d9bf0;
          color: white;
          padding: 12px 16px;
          border-radius: 18px;
          max-width: 70%;
          word-wrap: break-word;
        ">${escapeHtml(content)}</div>
      </div>
    `;
    chatMessages.insertAdjacentHTML('beforeend', userMessageHtml);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // 2. 获取短期记忆（最近的聊天历史）
    let messages = [];

    try {
      const history = await roche.memory.getShortTerm({
        conversationId: currentConversationId,
        limit: 20
      });

      console.log('[Twitter] 获取到的短期记忆:', history);

      if (history && history.length > 0) {
        messages = history.map(msg => ({
          role: msg.role || (msg.senderId === currentUser ? 'user' : 'assistant'),
          content: msg.text || msg.content || ''
        }));
      }
    } catch (e) {
      console.log('[Twitter] 获取短期记忆失败，使用空上下文:', e);
    }

    // 3. 添加当前用户消息
    messages.push({
      role: 'user',
      content: content
    });

    console.log('[Twitter] 发送给 AI 的完整消息列表:', messages);

    // 4. 获取长期记忆（向量召回测试）
    try {
      const longTermMemory = await roche.memory.getLongTerm({
        conversationId: currentConversationId,
        limit: 5
      });
      console.log('[Twitter] 长期记忆（向量数据）:', longTermMemory);
    } catch (e) {
      console.log('[Twitter] 无法访问长期记忆:', e);
    }

    // 5. 获取角色信息
    let character = null;
    try {
      character = await roche.character.get(currentConversationId);
      console.log('[Twitter] 角色信息:', character);
    } catch (e) {
      console.log('[Twitter] 获取角色信息失败:', e);
    }

    // 6. 调用 Roche AI API
    console.log('[Twitter] 开始调用 roche.ai.chat...');
    const response = await roche.ai.chat({
      conversationId: currentConversationId,
      messages: messages,
      stream: false
    });

    console.log('[Twitter] AI 回复:', response);

    // 7. 显示 AI 回复
    let charAvatar = null;

    // 使用角色头像
    if (character?.avatar) {
      charAvatar = character.avatar;
    }

    if (!charAvatar) {
      // 如果没有角色信息，尝试从 conversation 获取
      try {
        const conversations = await roche.conversation.list();
        const conv = conversations.find(c => c.id === currentConversationId);
        if (conv?.avatar) {
          charAvatar = conv.avatar;
        }
      } catch (e) {}
    }

    if (!charAvatar) {
      // 使用默认头像
      const conversations = await roche.conversation.list();
      const conv = conversations.find(c => c.id === currentConversationId);
      const initial = (conv?.title || '?').charAt(0).toUpperCase();
      charAvatar = `data:image/svg+xml,${encodeURIComponent(`
        <svg width="48" height="48" xmlns="http://www.w3.org/2000/svg">
          <circle cx="24" cy="24" r="24" fill="#667eea"/>
          <text x="24" y="32" font-size="20" fill="white" text-anchor="middle" font-family="Arial">${initial}</text>
        </svg>
      `)}`;
    }

    const aiMessageHtml = `
      <div class="chat-message" style="display: flex; gap: 8px; margin-bottom: 16px;">
        <img class="chat-message-avatar" src="${charAvatar}" alt="" style="width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0; object-fit: cover;">
        <div class="chat-message-bubble" style="
          background: #eff3f4;
          color: #0f1419;
          padding: 12px 16px;
          border-radius: 18px;
          max-width: 70%;
          word-wrap: break-word;
        ">${escapeHtml(response.text || response.message || '')}</div>
      </div>
    `;
    chatMessages.insertAdjacentHTML('beforeend', aiMessageHtml);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    console.log('[Twitter] 消息发送成功，AI 回复:', response.text);

  } catch (error) {
    console.error('[Twitter] 发送消息失败:', error);
    showToast('发送失败: ' + error.message, 'error');
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
    padding-top: env(safe-area-inset-top);
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
        showBookmarks(roche);
      } else if (action === 'lists') {
        showLists(roche);
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
/**
 * 显示书签页面
 */
function showBookmarks(roche) {
  switchView('bookmarks');

  const bookmarksList = document.getElementById('bookmarks-tweets-list');
  if (!bookmarksList) return;

  // 获取当前用户的书签
  const userBookmarks = twitterData.bookmarks?.[currentUser] || [];

  if (userBookmarks.length === 0) {
    bookmarksList.innerHTML = `
      <div style="padding: 60px 20px; text-align: center;">
        <div style="font-size: 31px; font-weight: 800; color: #0f1419; margin-bottom: 8px;">保存你的书签</div>
        <div style="font-size: 15px; color: #536471; max-width: 400px; margin: 0 auto;">
          将推文加入书签，以便日后轻松查找。
        </div>
      </div>
    `;
    return;
  }

  // 显示书签推文列表
  const bookmarkedTweets = userBookmarks
    .map(tweetId => twitterData.tweets.find(t => t.id === tweetId))
    .filter(tweet => tweet); // 过滤掉不存在的推文

  bookmarksList.innerHTML = bookmarkedTweets.map(tweet => {
    const user = twitterData.users[tweet.userId];
    const isLiked = tweet.likes.includes(currentUser);
    const isRetweeted = tweet.retweets.includes(currentUser);
    const isBookmarked = true; // 在书签页面，肯定是已收藏的
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
              <div class="tweet-action bookmarked" data-action="bookmark">
                <span class="action-icon">${icons.bookmarkFilled}</span>
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

  // 绑定推文点击事件
  bookmarksList.querySelectorAll('.tweet-item').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.tweet-action')) return;
      const tweetId = parseInt(el.dataset.tweetId);
      showTweetDetail(tweetId, roche);
    });
  });

  // 绑定操作按钮
  bookmarksList.querySelectorAll('.tweet-action').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = el.dataset.action;
      const tweetId = parseInt(el.closest('.tweet-item').dataset.tweetId);
      handleTweetAction(action, tweetId, roche);
    });
  });
}

/**
 * 显示好友列表页面
 */
function showLists(roche) {
  switchView('lists');

  const listsList = document.getElementById('lists-content');
  if (!listsList) return;

  // 获取关注列表（好友列表）
  const following = twitterData.follows[currentUser] || [];

  if (following.length === 0) {
    listsList.innerHTML = `
      <div style="padding: 60px 20px; text-align: center;">
        <div style="font-size: 31px; font-weight: 800; color: #0f1419; margin-bottom: 8px;">关注一些人</div>
        <div style="font-size: 15px; color: #536471; max-width: 400px; margin: 0 auto;">
          关注你感兴趣的人，在这里查看他们。
        </div>
      </div>
    `;
    return;
  }

  // 显示好友列表
  listsList.innerHTML = '';
  following.forEach(userId => {
    const user = twitterData.users[userId];
    if (!user) return;

    const userItem = document.createElement('div');
    userItem.style.cssText = `
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      cursor: pointer;
      transition: background 0.2s;
      border-bottom: 1px solid #eff3f4;
    `;

    userItem.innerHTML = `
      <img src="${user.avatar}" style="width: 48px; height: 48px; border-radius: 50%;" alt="">
      <div style="flex: 1; min-width: 0;">
        <div style="font-weight: 700; font-size: 15px; color: #0f1419;">${user.name}</div>
        <div style="font-size: 15px; color: #536471;">${user.username}</div>
      </div>
      <button class="detail-follow-btn following" style="padding: 6px 16px; border-radius: 20px; border: 1px solid #cfd9de; background: transparent; color: #0f1419; font-weight: 700; font-size: 14px; cursor: pointer; transition: all 0.2s; min-width: 100px;">
        <span>正在关注</span>
      </button>
    `;

    // 点击用户查看资料
    userItem.addEventListener('click', (e) => {
      if (!e.target.closest('button')) {
        showProfile(userId, roche);
      }
    });

    // 取消关注按钮
    const followBtn = userItem.querySelector('button');
    followBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await toggleFollow(userId, roche);
      showLists(roche); // 刷新列表
    });

    followBtn.addEventListener('mouseenter', () => {
      followBtn.style.background = 'rgba(244, 33, 46, 0.1)';
      followBtn.style.borderColor = 'rgba(244, 33, 46, 0.4)';
      followBtn.style.color = '#f4212e';
      followBtn.querySelector('span').textContent = '取消关注';
    });

    followBtn.addEventListener('mouseleave', () => {
      followBtn.style.background = 'transparent';
      followBtn.style.borderColor = '#cfd9de';
      followBtn.style.color = '#0f1419';
      followBtn.querySelector('span').textContent = '正在关注';
    });

    listsList.appendChild(userItem);
  });
}

/**
 * 显示个人资料页
 */
function showProfile(userId, roche) {
  const user = twitterData.users[userId];
  if (!user) return;

  const isOwnProfile = userId === currentUser;
  const userTweets = twitterData.tweets.filter(t => t.userId === userId && !t.replyTo);

  // 更新头部信息
  document.getElementById('profile-header-name').textContent = user.name;
  document.getElementById('profile-header-tweets').textContent = `${userTweets.length} 推文`;

  // 更新个人信息
  document.getElementById('profile-avatar').src = user.avatar;
  document.getElementById('profile-name').textContent = user.name;
  document.getElementById('profile-username').textContent = user.username;
  document.getElementById('profile-bio').textContent = user.bio;
  document.getElementById('profile-joined').textContent = '加入于 2024年1月';

  // 计算真实的关注数据
  const followingCount = twitterData.follows[userId]?.length || 0;

  // 计算关注者数（有多少人关注了这个用户）
  let followersCount = 0;
  for (const uid in twitterData.follows) {
    if (twitterData.follows[uid].includes(userId)) {
      followersCount++;
    }
  }

  document.getElementById('profile-following').textContent = followingCount;
  document.getElementById('profile-followers').textContent = followersCount;

  // 设置按钮
  const actionBtn = document.getElementById('profile-action-btn');
  if (isOwnProfile) {
    actionBtn.textContent = '编辑资料';
    actionBtn.onclick = () => showEditProfileDialog(roche);
  } else {
    const isFollowing = twitterData.follows[currentUser]?.includes(userId);

    // 创建按钮容器
    const buttonContainer = actionBtn.parentElement;

    // 关注按钮
    actionBtn.textContent = isFollowing ? '正在关注' : '关注';
    actionBtn.className = `profile-edit-btn ${isFollowing ? 'following' : ''}`;
    actionBtn.onclick = async () => {
      await toggleFollow(userId, roche);
      showProfile(userId, roche);
    };

    // 添加发私信按钮
    let messageBtn = document.getElementById('profile-message-btn');
    if (!messageBtn) {
      messageBtn = document.createElement('button');
      messageBtn.id = 'profile-message-btn';
      messageBtn.className = 'profile-edit-btn';
      messageBtn.style.cssText = 'margin-left: 8px;';
      messageBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" style="margin-right: 4px;">
          <path d="M1.998 5.5c0-1.381 1.119-2.5 2.5-2.5h15c1.381 0 2.5 1.119 2.5 2.5v13c0 1.381-1.119 2.5-2.5 2.5h-15c-1.381 0-2.5-1.119-2.5-2.5v-13zm2.5-.5c-.276 0-.5.224-.5.5v.511l8 3.848 8-3.848v-.511c0-.276-.224-.5-.5-.5h-15zm15.5 5.149l-8 3.848-8-3.848v8.351c0 .276.224.5.5.5h15c.276 0 .5-.224.5-.5v-8.351z"></path>
        </svg>
        私信
      `;
      buttonContainer.appendChild(messageBtn);
    }

    messageBtn.onclick = async () => {
      // 检查是否为 Char（有对应的 conversation）
      try {
        const conversations = await roche.conversation.list();
        const charConv = conversations.find(c => c.id === userId);

        if (charConv) {
          // 是 Char，打开对话
          switchView('messages');
          setTimeout(() => {
            openChatWithConv(roche, userId);
          }, 100);
        } else {
          // 不是 Char，提示用户
          showToast('此用户不是 AI 角色，暂不支持私信', 'info');
        }
      } catch (error) {
        console.error('打开私信失败:', error);
        showToast('无法发送私信', 'error');
      }
    };
  }

  // 渲染默认推文列表
  renderProfileTab('tweets', userId, user, roche);

  // 绑定标签切换
  document.querySelectorAll('.profile-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const tabType = tab.dataset.tab;
      renderProfileTab(tabType, userId, user, roche);
    });
  });

  // 切换到个人资料视图
  switchView('profile');
}

/**
 * 渲染个人资料标签页内容
 */
function renderProfileTab(tabType, userId, user, roche) {
  const tweetsListEl = document.getElementById('profile-tweets-list');
  let tweets = [];

  switch (tabType) {
    case 'tweets':
      // 只显示用户的原创推文（不包括回复）
      tweets = twitterData.tweets.filter(t => t.userId === userId && !t.replyTo);
      break;

    case 'replies':
      // 显示用户的回复
      tweets = twitterData.tweets.filter(t => t.userId === userId && t.replyTo);
      break;

    case 'media':
      // 显示包含媒体的推文（暂时为空，后续可以添加图片/视频支持）
      tweets = twitterData.tweets.filter(t => t.userId === userId && t.media && t.media.length > 0);
      break;

    case 'likes':
      // 显示用户喜欢的推文
      tweets = twitterData.tweets.filter(t => t.likes.includes(userId));
      break;
  }

  if (tweets.length === 0) {
    const emptyMessages = {
      tweets: '还没有推文',
      replies: '还没有回复',
      media: '还没有媒体',
      likes: '还没有喜欢的推文'
    };

    tweetsListEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🐦</div>
        <div>${emptyMessages[tabType]}</div>
      </div>
    `;
    return;
  }

  tweetsListEl.innerHTML = tweets.map(tweet => {
    const tweetUser = twitterData.users[tweet.userId];
    const isLiked = tweet.likes.includes(currentUser);
    const isRetweeted = tweet.retweets.includes(currentUser);
    const timeAgo = getTimeAgo(tweet.timestamp);

    // 如果是回复，显示回复对象
    let replyHeader = '';
    if (tweet.replyTo) {
      const parentTweet = twitterData.tweets.find(t => t.id === tweet.replyTo);
      const parentUser = parentTweet ? twitterData.users[parentTweet.userId] : null;
      if (parentUser) {
        replyHeader = `
          <div style="padding: 0 16px 8px 48px; color: #536471; font-size: 13px;">
            回复 ${parentUser.username}
          </div>
        `;
      }
    }

    return `
      <div class="tweet-item" data-tweet-id="${tweet.id}">
        ${replyHeader}
        <div class="tweet-header">
          <img class="tweet-avatar" src="${tweetUser.avatar}" alt="">
          <div class="tweet-content">
            <div class="tweet-author">
              <span class="tweet-author-name">${tweetUser.name}</span>
              <span class="tweet-author-username">${tweetUser.username}</span>
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

/**
 * 显示设置页面
 */
function showSettings(roche) {
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

  // 绑定 API 配置 - URL
  const settingAPIUrl = document.getElementById('setting-api-url');
  if (settingAPIUrl) {
    settingAPIUrl.replaceWith(settingAPIUrl.cloneNode(true));
    document.getElementById('setting-api-url').addEventListener('click', () => {
      showAPIUrlSettings(roche);
    });
  }

  // 绑定 API 配置 - Key
  const settingAPIKey = document.getElementById('setting-api-key');
  if (settingAPIKey) {
    settingAPIKey.replaceWith(settingAPIKey.cloneNode(true));
    document.getElementById('setting-api-key').addEventListener('click', () => {
      showAPIKeySettings(roche);
    });
  }

  // 绑定 API 配置 - Model
  const settingAPIModel = document.getElementById('setting-api-model');
  if (settingAPIModel) {
    settingAPIModel.replaceWith(settingAPIModel.cloneNode(true));
    document.getElementById('setting-api-model').addEventListener('click', () => {
      showAPIModelSettings(roche);
    });
  }

  // 绑定 API 配置 - Temperature
  const settingAPITemp = document.getElementById('setting-api-temperature');
  if (settingAPITemp) {
    settingAPITemp.replaceWith(settingAPITemp.cloneNode(true));
    document.getElementById('setting-api-temperature').addEventListener('click', () => {
      showAPITemperatureSettings(roche);
    });
  }

  // 更新 API 配置状态显示
  updateAPIConfigDisplay();

  // 绑定 NPC 系统开关
  const toggleNPC = document.getElementById('toggle-npc');
  if (toggleNPC) {
    toggleNPC.checked = settings.enableNPC !== false; // 默认开启
    toggleNPC.replaceWith(toggleNPC.cloneNode(true));
    document.getElementById('toggle-npc').addEventListener('change', async (e) => {
      settings.enableNPC = e.target.checked;
      await saveSettings(roche);
      showToast(settings.enableNPC ? '已启用 NPC 系统' : '已禁用 NPC 系统', 'success');
      if (settings.enableNPC) {
        initNPCSystem(roche);
      }
    });
  }

  // 绑定 NPC 智能回复开关
  const toggleNPCReply = document.getElementById('toggle-npc-reply');
  if (toggleNPCReply) {
    toggleNPCReply.checked = NPC_CONFIG.enableAutoReply !== false; // 默认开启
    toggleNPCReply.replaceWith(toggleNPCReply.cloneNode(true));
    document.getElementById('toggle-npc-reply').addEventListener('change', async (e) => {
      NPC_CONFIG.enableAutoReply = e.target.checked;
      await saveSettings(roche);
      showToast(NPC_CONFIG.enableAutoReply ? '已启用 NPC 智能回复' : '已禁用 NPC 智能回复', 'success');
      if (NPC_CONFIG.enableAutoReply && settings.enableNPC) {
        startNPCReplySystem(roche);
      }
    });
  }

  // 绑定 NPC 数量设置
  const settingNPCCount = document.getElementById('setting-npc-count');
  if (settingNPCCount) {
    settingNPCCount.replaceWith(settingNPCCount.cloneNode(true));
    document.getElementById('setting-npc-count').addEventListener('click', () => {
      showNPCCountSettings(roche);
    });
  }

  // 绑定 NPC 发帖频率设置
  const settingNPCFrequency = document.getElementById('setting-npc-frequency');
  if (settingNPCFrequency) {
    settingNPCFrequency.replaceWith(settingNPCFrequency.cloneNode(true));
    document.getElementById('setting-npc-frequency').addEventListener('click', () => {
      showNPCFrequencySettings(roche);
    });
  }

  // 绑定 Char 发推文管理
  const settingCharTweets = document.getElementById('setting-char-tweets');
  if (settingCharTweets) {
    settingCharTweets.replaceWith(settingCharTweets.cloneNode(true));
    document.getElementById('setting-char-tweets').addEventListener('click', () => {
      showCharTweetsManagement(roche);
    });
  }

  // 绑定 NPC 后端 API 设置
  const settingNPCAPI = document.getElementById('setting-npc-api');
  if (settingNPCAPI) {
    settingNPCAPI.replaceWith(settingNPCAPI.cloneNode(true));
    document.getElementById('setting-npc-api').addEventListener('click', () => {
      showNPCAPISettings(roche);
    });
  }

  // 更新 API 状态显示
  const apiStatus = document.getElementById('npc-api-status');
  if (apiStatus) {
    apiStatus.textContent = settings.npcBackendAPI ? '已配置' : '未配置';
  }

  // 绑定管理 NPC
  const settingNPCManage = document.getElementById('setting-npc-manage');
  if (settingNPCManage) {
    settingNPCManage.replaceWith(settingNPCManage.cloneNode(true));
    document.getElementById('setting-npc-manage').addEventListener('click', () => {
      showNPCManagement(roche);
    });
  }

  // 绑定测试 NPC API
  const settingTestNPCAPI = document.getElementById('setting-test-npc-api');
  if (settingTestNPCAPI) {
    settingTestNPCAPI.replaceWith(settingTestNPCAPI.cloneNode(true));
    document.getElementById('setting-test-npc-api').addEventListener('click', () => {
      testNPCPostAPI(roche);
    });
  }

  // 切换到设置视图
  switchView('settings');
}

/**
 * 显示设置和隐私页面
 */
function showPrivacySettings(roche) {
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

// ============================================================
// NPC 生态系统
// ============================================================

/**
 * 生成随机 NPC 人设
 */
async function generateNPC(roche) {
  try {
    // 尝试使用 noir API
    if (settings.useNoirAPI && roche.noir?.autoPost) {
      console.log('[NPC] 使用 roche.noir.autoPost 生成 NPC');
      const response = await roche.noir.autoPost({
        type: 'generate_persona',
        prompt: '生成一个随机的社交媒体用户人设'
      });
      return response;
    }

    // 如果有自定义 API
    if (settings.npcAutoPostAPI) {
      console.log('[NPC] 使用自定义 API 生成 NPC');
      // TODO: 调用自定义 API
    }

    // 降级方案：使用 roche.ai.chat
    console.log('[NPC] 使用 roche.ai.chat 生成 NPC');
    const prompt = `请生成一个随机的社交媒体用户人设。要求：

性格随机多样化（外向/内向/幽默/严肃/温柔/冷酷等）
职业随机（程序员/艺术家/学生/医生/创业者/自由职业/设计师等）
兴趣爱好随机（游戏/动漫/旅行/美食/音乐/科技/运动/阅读等）
年龄：18-35 岁
地区：中国各大城市

请以 JSON 格式返回，包含以下字段：
{
  "name": "姓名（2-3个字）",
  "username": "用户名（英文）",
  "bio": "个人简介（20字以内）",
  "personality": "性格描述",
  "occupation": "职业",
  "interests": ["兴趣1", "兴趣2", "兴趣3"],
  "age": 25,
  "location": "城市",
  "talkStyle": "说话风格描述"
}

只返回 JSON，不要其他内容。`;

    const response = await roche.ai.chat({
      messages: [{ role: 'user', content: prompt }]
    });

    console.log('[NPC] AI 响应:', response);

    // 检查响应是否有效
    if (!response || !response.content) {
      throw new Error('AI 返回空响应');
    }

    // 解析 JSON
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const npcData = JSON.parse(jsonMatch[0]);
      return npcData;
    }

    throw new Error('无法解析 NPC 数据');

  } catch (error) {
    console.error('[NPC] 生成 NPC 失败:', error);
    throw error;
  }
}

/**
 * 创建 NPC
 */
async function createNPC(roche) {
  const npcData = await generateNPC(roche);
  if (!npcData) return null;

  const npcId = `npc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // 创建用户数据
  twitterData.users[npcId] = {
    id: npcId,
    name: npcData.name,
    username: `@${npcData.username}`,
    avatar: generateAvatar(npcData.name),
    bio: npcData.bio,
    followers: Math.floor(Math.random() * 1000),
    following: Math.floor(Math.random() * 500),
    isPersona: false,
    isNPC: true
  };

  // 保存 NPC 详细信息
  twitterData.npcs[npcId] = {
    ...npcData,
    id: npcId,
    createdAt: Date.now(),
    lastPostTime: 0,
    postCount: 0,
    totalInteractions: 0,  // 总互动数
    lastInteractionTime: Date.now()
  };

  console.log('[NPC] 创建成功:', npcData.name, npcId);
  return npcId;
}

/**
 * NPC 自动发帖
 */
async function npcAutoPost(npcId, roche) {
  const npc = twitterData.npcs[npcId];
  if (!npc) return;

  try {
    let content = '';

    // 优先使用自定义后端 API
    if (settings.npcBackendAPI) {
      console.log('[NPC] 使用自定义后端 API 发帖');
      const response = await fetch(settings.npcBackendAPI, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          npcId: npcId,
          persona: {
            name: npc.name,
            bio: npc.bio,
            personality: npc.personality,
            occupation: npc.occupation,
            interests: npc.interests,
            talkStyle: npc.talkStyle
          },
          context: {
            platform: 'twitter',
            previousPosts: twitterData.tweets
              .filter(t => t.userId === npcId)
              .slice(0, 5)
              .map(t => t.content)
          }
        })
      });

      if (!response.ok) {
        throw new Error(`后端 API 错误: ${response.status}`);
      }

      const data = await response.json();
      if (data && data.content) {
        content = data.content;
      } else {
        throw new Error('后端返回无效数据');
      }
    }
    // 使用通用 API 配置
    else if (settings.apiConfig.url && settings.apiConfig.apiKey) {
      console.log('[NPC] 使用通用 API 配置发帖');

      // 构造 NPC 人设提示词
      const prompt = `你是 ${npc.name}，${npc.bio}。
性格：${npc.personality}
职业：${npc.occupation}
兴趣：${npc.interests.join('、')}
说话风格：${npc.talkStyle}

请以这个角色的口吻，用中文发一条推文（不超过280字），内容可以是：
- 分享今天的心情或想法
- 讨论你的兴趣爱好
- 发表对某个话题的看法
- 日常生活的小事

只返回推文内容，不要有其他说明。`;

      const response = await fetch(settings.apiConfig.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.apiConfig.apiKey}`
        },
        body: JSON.stringify({
          model: settings.apiConfig.model,
          messages: [
            { role: 'user', content: prompt }
          ],
          temperature: settings.apiConfig.temperature || 0.7,
          max_tokens: 200
        })
      });

      if (!response.ok) {
        throw new Error(`API 错误: ${response.status}`);
      }

      const data = await response.json();

      if (data.choices && data.choices[0]) {
        content = data.choices[0].message?.content || data.choices[0].text || '';
      } else if (data.content) {
        content = data.content;
      } else if (data.response) {
        content = data.response;
      }

      if (!content) {
        throw new Error('API 返回空内容');
      }
    } else {
      console.error('[NPC] 未配置 API');
      return;
    }

    // 创建推文
    if (content) {
      createNPCTweet(npcId, content.trim(), roche);
    }

  } catch (error) {
    console.error('[NPC] 发帖失败:', error);
    throw error;
  }
}

/**
 * 创建 NPC 推文
 */
function createNPCTweet(npcId, content, roche) {
  const tweet = {
    id: twitterData.nextTweetId++,
    userId: npcId,
    content: content,
    timestamp: Date.now(),
    likes: [],
    retweets: [],
    replies: [],
    isNPC: true
  };

  twitterData.tweets.unshift(tweet);
  twitterData.npcs[npcId].lastPostTime = Date.now();
  twitterData.npcs[npcId].postCount++;

  console.log('[NPC] 发帖成功:', twitterData.users[npcId].name, content.substring(0, 20));

  // 发送消息推送通知
  sendNPCPostNotification(npcId, content, tweet.id, roche);

  saveData(roche);
}

/**
 * 发送 NPC 发帖通知
 */
async function sendNPCPostNotification(npcId, content, tweetId, roche) {
  try {
    const user = twitterData.users[npcId];
    if (!user) return;

    // 使用 Roche 的通知系统
    if (roche.notification?.send) {
      await roche.notification.send({
        title: `${user.name} 发布了新推文`,
        body: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
        icon: user.avatar,
        data: {
          type: 'npc_tweet',
          npcId: npcId,
          tweetId: tweetId,
          pluginId: PLUGIN_ID
        },
        actions: [
          { action: 'view', title: '查看' },
          { action: 'dismiss', title: '忽略' }
        ]
      });
      console.log('[通知] NPC 发帖通知已发送:', user.name);
    }

    // 添加到插件内的通知列表
    if (!twitterData.notifications) {
      twitterData.notifications = [];
    }

    twitterData.notifications.unshift({
      id: Date.now(),
      type: 'npc_post',
      userId: npcId,
      tweetId: tweetId,
      timestamp: Date.now(),
      read: false
    });

    // 限制通知数量
    if (twitterData.notifications.length > 100) {
      twitterData.notifications = twitterData.notifications.slice(0, 100);
    }

  } catch (error) {
    console.error('[通知] 发送 NPC 通知失败:', error);
  }
}

/**
 * NPC 智能回复用户推文
 * 根据兴趣度和推文内容决定是否回复
 */
async function npcSmartReply(tweetId, roche) {
  if (!settings.enableNPC || !NPC_CONFIG.enableAutoReply) return;

  const tweet = twitterData.tweets.find(t => t.id === tweetId);
  if (!tweet) return;

  // 只回复真实用户的推文，不回复 NPC 的推文
  if (twitterData.npcs[tweet.userId]) return;

  // 不回复回复（避免无限循环）
  if (tweet.replyTo) return;

  const userId = tweet.userId;
  const userInterests = twitterData.npcInterests[userId] || {};

  // 获取所有对该用户有兴趣的 NPC
  const interestedNPCs = Object.entries(userInterests)
    .filter(([npcId, interest]) => {
      const npc = twitterData.npcs[npcId];
      if (!npc) return false;

      // 兴趣度必须达到阈值
      if (interest < NPC_CONFIG.minInterestForReply) return false;

      // 检查 NPC 今日回复次数
      const todayStr = new Date().toISOString().split('T')[0];
      const replyCount = twitterData.npcReplyCounts[npcId];

      if (replyCount && replyCount.date === todayStr) {
        if (replyCount.count >= NPC_CONFIG.maxRepliesPerNPCDaily) {
          return false; // 今日回复次数已达上限
        }
      }

      return true;
    })
    .map(([npcId, interest]) => ({ npcId, interest }))
    .sort((a, b) => b.interest - a.interest); // 按兴趣度排序

  if (interestedNPCs.length === 0) return;

  // 随机选择 1-2 个 NPC 回复（基于概率）
  const repliers = [];
  for (const { npcId, interest } of interestedNPCs) {
    // 兴趣度越高，回复概率越大
    const replyChance = NPC_CONFIG.replyProbability * (interest / NPC_CONFIG.minInterestForReply);

    if (Math.random() < replyChance) {
      repliers.push(npcId);
      if (repliers.length >= 2) break; // 最多 2 个 NPC 回复
    }
  }

  // 执行回复
  for (const npcId of repliers) {
    try {
      await generateNPCReply(npcId, tweet, roche);

      // 更新回复计数
      const todayStr = new Date().toISOString().split('T')[0];
      if (!twitterData.npcReplyCounts[npcId] || twitterData.npcReplyCounts[npcId].date !== todayStr) {
        twitterData.npcReplyCounts[npcId] = { date: todayStr, count: 0 };
      }
      twitterData.npcReplyCounts[npcId].count++;

      console.log('[NPC 回复] NPC', npcId, '回复了推文', tweetId);
    } catch (error) {
      console.error('[NPC 回复] 生成回复失败:', error);
    }
  }

  await saveData(roche);
}

/**
 * 生成 NPC 回复内容
 */
async function generateNPCReply(npcId, originalTweet, roche) {
  const npc = twitterData.npcs[npcId];
  if (!npc) return;

  const originalUser = twitterData.users[originalTweet.userId];

  try {
    let replyContent = '';

    // 优先使用自定义后端 API
    if (settings.npcBackendAPI) {
      const response = await fetch(settings.npcBackendAPI, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reply',
          npcId: npcId,
          persona: {
            name: npc.name,
            bio: npc.bio,
            personality: npc.personality,
            occupation: npc.occupation,
            interests: npc.interests,
            talkStyle: npc.talkStyle
          },
          context: {
            originalTweet: originalTweet.content,
            originalAuthor: originalUser.name,
            platform: 'twitter'
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        replyContent = data.content || '';
      }
    }

    // 使用通用 API 配置
    if (!replyContent && settings.apiConfig.url && settings.apiConfig.apiKey) {
      const prompt = `你是 ${npc.name}，${npc.bio}。
性格：${npc.personality}
职业：${npc.occupation}
兴趣：${npc.interests.join('、')}
说话风格：${npc.talkStyle}

${originalUser.name} 发了一条推文："${originalTweet.content}"

请以你的角色口吻回复这条推文（不超过280字）。回复要：
- 符合你的人设和说话风格
- 自然、友好、有建设性
- 可以表达赞同、提问、分享观点或补充信息
- 不要重复原推文内容

只返回回复内容，不要有其他说明。`;

      const response = await fetch(settings.apiConfig.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.apiConfig.apiKey}`
        },
        body: JSON.stringify({
          model: settings.apiConfig.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: settings.apiConfig.temperature || 0.8,
          max_tokens: 200
        })
      });

      if (response.ok) {
        const data = await response.json();
        replyContent = data.choices?.[0]?.message?.content ||
                      data.choices?.[0]?.text ||
                      data.content ||
                      data.response || '';
      }
    }

    if (!replyContent) {
      console.error('[NPC 回复] 未配置 API 或生成失败');
      return;
    }

    // 创建回复推文
    const reply = {
      id: twitterData.nextTweetId++,
      userId: npcId,
      content: replyContent.trim(),
      timestamp: Date.now(),
      likes: [],
      retweets: [],
      replies: [],
      replyTo: originalTweet.id,
      isNPC: true
    };

    twitterData.tweets.unshift(reply);

    // 将回复添加到原推文的回复列表
    if (!originalTweet.replies) {
      originalTweet.replies = [];
    }
    originalTweet.replies.push(reply.id);

    // 更新 NPC 统计
    twitterData.npcs[npcId].lastPostTime = Date.now();
    twitterData.npcs[npcId].postCount++;

    console.log('[NPC 回复] 生成成功:', twitterData.users[npcId].name, '→', replyContent.substring(0, 30));

    // 发送通知给原推文作者
    await sendNPCReplyNotification(npcId, originalTweet, reply, roche);

  } catch (error) {
    console.error('[NPC 回复] 生成失败:', error);
    throw error;
  }
}

/**
 * 发送 NPC 回复通知
 */
async function sendNPCReplyNotification(npcId, originalTweet, reply, roche) {
  try {
    const npcUser = twitterData.users[npcId];
    if (!npcUser) return;

    // 使用 Roche 的通知系统
    if (roche.notification?.send) {
      await roche.notification.send({
        title: `${npcUser.name} 回复了你的推文`,
        body: reply.content.substring(0, 100) + (reply.content.length > 100 ? '...' : ''),
        icon: npcUser.avatar,
        data: {
          type: 'npc_reply',
          npcId: npcId,
          tweetId: reply.id,
          originalTweetId: originalTweet.id,
          pluginId: PLUGIN_ID
        },
        actions: [
          { action: 'view', title: '查看' },
          { action: 'dismiss', title: '忽略' }
        ]
      });
    }

    // 添加到插件内的通知列表
    if (!twitterData.notifications) {
      twitterData.notifications = [];
    }

    twitterData.notifications.unshift({
      id: Date.now(),
      type: 'npc_reply',
      userId: npcId,
      tweetId: reply.id,
      originalTweetId: originalTweet.id,
      timestamp: Date.now(),
      read: false
    });

    // 限制通知数量
    if (twitterData.notifications.length > 100) {
      twitterData.notifications = twitterData.notifications.slice(0, 100);
    }

  } catch (error) {
    console.error('[通知] 发送 NPC 回复通知失败:', error);
  }
}

/**
 * 更新用户对 NPC 的兴趣度
 */
function updateNPCInterest(userId, npcId, action) {
  if (!twitterData.npcInterests[userId]) {
    twitterData.npcInterests[userId] = {};
  }

  if (!twitterData.npcInterests[userId][npcId]) {
    twitterData.npcInterests[userId][npcId] = 0.5; // 初始兴趣度
  }

  // 根据操作类型增加兴趣度
  const interestBoost = {
    'like': 0.05,
    'retweet': 0.1,
    'reply': 0.15,
    'follow': 0.3,
    'view': 0.01
  };

  twitterData.npcInterests[userId][npcId] += (interestBoost[action] || 0);

  // 限制在 0-1 之间
  twitterData.npcInterests[userId][npcId] = Math.min(1, twitterData.npcInterests[userId][npcId]);

  // 更新 NPC 互动统计
  if (twitterData.npcs[npcId]) {
    twitterData.npcs[npcId].totalInteractions++;
    twitterData.npcs[npcId].lastInteractionTime = Date.now();
  }

  console.log('[NPC] 兴趣度更新:', npcId, action, twitterData.npcInterests[userId][npcId]);
}

/**
 * 每日兴趣度衰减
 */
function decayNPCInterests() {
  for (const userId in twitterData.npcInterests) {
    for (const npcId in twitterData.npcInterests[userId]) {
      twitterData.npcInterests[userId][npcId] *= NPC_CONFIG.interestDecayRate;

      // 低于阈值则删除
      if (twitterData.npcInterests[userId][npcId] < 0.01) {
        delete twitterData.npcInterests[userId][npcId];
      }
    }
  }
  console.log('[NPC] 兴趣度衰减完成');
}

/**
 * 清理无互动的 NPC
 */
async function cleanupInactiveNPCs(roche) {
  const now = Date.now();
  const cleanupThreshold = NPC_CONFIG.cleanupDays * 24 * 60 * 60 * 1000;
  const npcIds = Object.keys(twitterData.npcs);

  let cleanedCount = 0;

  for (const npcId of npcIds) {
    const npc = twitterData.npcs[npcId];
    const timeSinceInteraction = now - npc.lastInteractionTime;

    // 检查是否有用户关注了这个 NPC
    let isFollowedByAnyUser = false;
    for (const userId in twitterData.follows) {
      if (twitterData.follows[userId].includes(npcId)) {
        isFollowedByAnyUser = true;
        break;
      }
    }

    // 如果被关注，跳过清理
    if (isFollowedByAnyUser) {
      console.log('[NPC] 保留被关注的 NPC:', npc.name, npcId);
      continue;
    }

    // 7 天无互动 + 总互动数很少
    if (timeSinceInteraction > cleanupThreshold && npc.totalInteractions < 5) {
      // 删除 NPC 的推文
      twitterData.tweets = twitterData.tweets.filter(t => t.userId !== npcId);

      // 删除用户数据
      delete twitterData.users[npcId];
      delete twitterData.npcs[npcId];

      // 删除兴趣度记录
      for (const userId in twitterData.npcInterests) {
        delete twitterData.npcInterests[userId][npcId];
      }

      cleanedCount++;
      console.log('[NPC] 清理无互动 NPC:', npc.name, npcId);
    }
  }

  if (cleanedCount > 0) {
    twitterData.lastNPCCleanup = now;
    await saveData(roche);
    console.log('[NPC] 清理完成，共清理', cleanedCount, '个 NPC');
  }
}

/**
 * 每日生成新 NPC
 */
async function dailyGenerateNPCs(roche) {
  if (!settings.enableNPC) return;

  const now = Date.now();
  const dayInMs = 24 * 60 * 60 * 1000;

  // 检查是否需要生成
  if (now - twitterData.lastNPCGeneration < dayInMs) {
    return;
  }

  const currentNPCCount = Object.keys(twitterData.npcs).length;

  // 达到上限则不生成
  if (currentNPCCount >= NPC_CONFIG.maxNPCs) {
    console.log('[NPC] 已达到上限，不生成新 NPC');
    return;
  }

  // 生成新 NPC
  const generateCount = Math.min(
    NPC_CONFIG.dailyNewNPCs,
    NPC_CONFIG.maxNPCs - currentNPCCount
  );

  console.log('[NPC] 开始生成', generateCount, '个新 NPC');

  for (let i = 0; i < generateCount; i++) {
    const npcId = await createNPC(roche);
    if (npcId) {
      // 新 NPC 发第一条推文
      await npcAutoPost(npcId, roche);
      // 延迟避免 API 限流
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  twitterData.lastNPCGeneration = now;
  await saveData(roche);
  console.log('[NPC] 每日生成完成');
}

/**
 * NPC 定时发帖系统
 */
function startNPCPostingSystem(roche) {
  if (!settings.enableNPC) return;

  // 每天重置活跃 NPC 列表
  let dailyActiveNPCs = [];
  let lastResetDate = new Date().toDateString();

  // 随机选择今天活跃的 NPC
  function selectDailyActiveNPCs() {
    const allNPCIds = Object.keys(twitterData.npcs);
    const shuffled = allNPCIds.sort(() => Math.random() - 0.5);
    dailyActiveNPCs = shuffled.slice(0, Math.min(NPC_CONFIG.dailyActiveNPCs, allNPCIds.length));

    // 重置发帖计数
    dailyActiveNPCs.forEach(npcId => {
      if (twitterData.npcs[npcId]) {
        twitterData.npcs[npcId].todayPostCount = 0;
      }
    });

    console.log('[NPC] 今日活跃 NPC:', dailyActiveNPCs.map(id => twitterData.users[id]?.name));
  }

  // 初始化今日活跃 NPC
  selectDailyActiveNPCs();

  // 立即让部分 NPC 发推（启动时）
  (async () => {
    console.log('[NPC] 启动时立即发推');
    const immediatePostCount = Math.min(3, dailyActiveNPCs.length);
    for (let i = 0; i < immediatePostCount; i++) {
      const npcId = dailyActiveNPCs[i];
      if (twitterData.npcs[npcId]) {
        try {
          await npcAutoPost(npcId, roche);
          twitterData.npcs[npcId].todayPostCount = (twitterData.npcs[npcId].todayPostCount || 0) + 1;
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1秒间隔
        } catch (error) {
          console.error('[NPC] 启动发推失败:', error);
        }
      }
    }
  })(); // 立即执行

  // 每 2 分钟检查一次，让 NPC 更频繁地发帖
  setInterval(async () => {
    const today = new Date().toDateString();

    // 检查是否需要重置（新的一天）
    if (today !== lastResetDate) {
      lastResetDate = today;
      selectDailyActiveNPCs();
    }

    const now = Date.now();

    // 只让今日活跃的 NPC 发帖
    for (const npcId of dailyActiveNPCs) {
      const npc = twitterData.npcs[npcId];
      if (!npc) continue;

      // 计算随机发帖间隔（分钟转毫秒）
      const minInterval = NPC_CONFIG.postIntervalMin * 60 * 1000;
      const maxInterval = NPC_CONFIG.postIntervalMax * 60 * 1000;
      const randomInterval = minInterval + Math.random() * (maxInterval - minInterval);

      // 检查是否该发帖了
      if (now - npc.lastPostTime > randomInterval) {
        // 检查今天是否已经发够了
        if (!npc.todayPostCount) npc.todayPostCount = 0;

        if (npc.todayPostCount < NPC_CONFIG.postsPerActiveNPC) {
          console.log('[NPC] 定时发帖:', twitterData.users[npcId].name);
          await npcAutoPost(npcId, roche);
          npc.todayPostCount++;
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
  }, 2 * 60 * 1000); // 每 2 分钟检查一次

  console.log('[NPC] 定时发帖系统已启动');
}

/**
 * 启动 NPC 智能回复系统
 */
function startNPCReplySystem(roche) {
  if (!settings.enableNPC || !NPC_CONFIG.enableAutoReply) {
    console.log('[NPC 回复] NPC 智能回复系统已禁用');
    return;
  }

  console.log('[NPC 回复] 启动 NPC 智能回复系统');

  // 定期检查是否有新推文需要回复
  setInterval(async () => {
    try {
      const now = Date.now();
      const checkInterval = NPC_CONFIG.replyCheckInterval * 60 * 1000; // 转换为毫秒

      // 获取最近一段时间的用户推文（非 NPC、非回复）
      const recentTweets = twitterData.tweets.filter(tweet => {
        // 只检查真实用户的推文
        if (twitterData.npcs[tweet.userId]) return false;

        // 不回复回复
        if (tweet.replyTo) return false;

        // 只检查最近发布的推文
        const tweetAge = now - tweet.timestamp;
        if (tweetAge > checkInterval * 2) return false; // 检查最近两个周期的推文

        // 检查是否已经有 NPC 回复过
        const hasNPCReply = tweet.replies && tweet.replies.some(replyId => {
          const reply = twitterData.tweets.find(t => t.id === replyId);
          return reply && twitterData.npcs[reply.userId];
        });

        // 如果已经有回复，降低再次回复的概率
        if (hasNPCReply && Math.random() > 0.2) return false;

        return true;
      });

      // 为每条推文尝试触发 NPC 回复
      for (const tweet of recentTweets) {
        // 随机延迟，避免所有回复同时触发
        await new Promise(resolve => setTimeout(resolve, Math.random() * 2000));

        try {
          await npcSmartReply(tweet.id, roche);
        } catch (error) {
          console.error('[NPC 回复] 回复推文失败:', tweet.id, error);
        }
      }

    } catch (error) {
      console.error('[NPC 回复] 检查系统出错:', error);
    }
  }, NPC_CONFIG.replyCheckInterval * 60 * 1000); // 定期检查

  console.log('[NPC 回复] 智能回复系统已启动，检查间隔:', NPC_CONFIG.replyCheckInterval, '分钟');
}

/**
 * 初始化 NPC 系统
 */
async function initNPCSystem(roche) {
  if (!settings.enableNPC) {
    console.log('[NPC] NPC 系统已禁用');
    return;
  }

  console.log('[NPC] 初始化 NPC 系统');

  try {
    // 每日任务
    await dailyGenerateNPCs(roche);
    await cleanupInactiveNPCs(roche);
    decayNPCInterests();

    // 启动定时发帖
    startNPCPostingSystem(roche);

    // 启动 NPC 智能回复检查系统
    startNPCReplySystem(roche);

    // 每天执行一次清理和生成
    setInterval(async () => {
      try {
        await dailyGenerateNPCs(roche);
        await cleanupInactiveNPCs(roche);
        decayNPCInterests();
        await saveData(roche);
      } catch (error) {
        console.error('[NPC] 每日任务执行失败:', error);
      }
    }, 24 * 60 * 60 * 1000);

    console.log('[NPC] NPC 系统初始化完成');
  } catch (error) {
    console.error('[NPC] NPC 系统初始化失败:', error);
    throw error;
  }
}

/**
 * 初始化 Char 自动发推系统
 */
async function initCharTweetSystem(roche) {
  console.log('[Char] 初始化 Char 自动发推系统');

  // 初始化 charTweets 字段
  if (!twitterData.charTweets) {
    twitterData.charTweets = {};
  }

  // 启动定时检查
  startCharTweetingSystem(roche);

  console.log('[Char] Char 自动发推系统初始化完成');
}

/**
 * 启动 Char 发推定时系统
 */
function startCharTweetingSystem(roche) {
  // 每 30 分钟检查一次
  setInterval(async () => {
    try {
      await checkAndPostCharTweets(roche);
    } catch (error) {
      console.error('[Char] Char 发推检查失败:', error);
    }
  }, 30 * 60 * 1000); // 30 分钟

  // 立即执行一次
  setTimeout(() => {
    checkAndPostCharTweets(roche).catch(error => {
      console.error('[Char] Char 发推检查失败:', error);
    });
  }, 5000); // 5 秒后执行第一次
}

/**
 * 检查并发布 Char 推文
 */
async function checkAndPostCharTweets(roche) {
  if (!twitterData.charTweets) return;

  const now = Date.now();
  const enabledChars = Object.entries(twitterData.charTweets).filter(([id, config]) => config.enabled);

  if (enabledChars.length === 0) {
    return;
  }

  console.log(`[Char] 检查 ${enabledChars.length} 个已启用的 Char`);

  for (const [charId, config] of enabledChars) {
    try {
      // 计算发推间隔（毫秒）
      // 频率是每天 N 条，所以间隔是 24小时 / N
      const intervalMs = (24 * 60 * 60 * 1000) / config.frequency;

      // 检查是否到了发推时间
      const timeSinceLastTweet = now - (config.lastTweetTime || 0);

      if (timeSinceLastTweet >= intervalMs) {
        console.log(`[Char] ${charId} 需要发推文`);
        await generateAndPostCharTweet(roche, charId, config);

        // 更新最后发推时间
        twitterData.charTweets[charId].lastTweetTime = now;
        await saveData(roche);
      }
    } catch (error) {
      console.error(`[Char] ${charId} 发推失败:`, error);
    }
  }
}

/**
 * 生成并发布 Char 推文
 */
async function generateAndPostCharTweet(roche, charId, config) {
  try {
    // 获取角色信息
    const character = await roche.character.get(charId);
    if (!character) {
      console.error(`[Char] 找不到角色: ${charId}`);
      return;
    }

    console.log(`[Char] 为 ${character.name} 生成推文`);

    // 构建提示词，让 Char 生成推文
    const prompt = `你是 ${character.name}。请根据你的性格和背景发一条推文（最多280字）。

你的性格和背景：
${character.description || character.persona || ''}

要求：
- 推文内容要符合你的性格
- 不要超过 280 字
- 不要包含任何解释，只输出推文内容
- 可以是日常分享、想法、观点、感受等
- 自然真实，像普通人发推特一样`;

    // 使用插件配置的 API 生成推文内容（不是 Roche 主 API）
    let tweetContent = '';

    if (settings.apiConfig.url && settings.apiConfig.apiKey) {
      // 使用插件配置的 API
      try {
        const response = await fetch(settings.apiConfig.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.apiConfig.apiKey}`
          },
          body: JSON.stringify({
            model: settings.apiConfig.model || 'gpt-3.5-turbo',
            messages: [
              {
                role: 'system',
                content: character.description || character.persona || `你是 ${character.name}`
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            temperature: settings.apiConfig.temperature || 0.7,
            max_tokens: 300
          })
        });

        if (!response.ok) {
          throw new Error(`API 请求失败: ${response.status}`);
        }

        const data = await response.json();
        tweetContent = data.choices?.[0]?.message?.content || '';
      } catch (error) {
        console.error('[Char] 使用插件 API 生成推文失败:', error);
        // 如果插件 API 失败，回退到 Roche API
        const response = await roche.ai.chat({
          conversationId: charId,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          stream: false
        });

        if (typeof response === 'string') {
          tweetContent = response;
        } else if (response?.content) {
          tweetContent = response.content;
        } else if (response?.text) {
          tweetContent = response.text;
        } else if (response?.message) {
          tweetContent = response.message;
        }
      }
    } else {
      // 如果没有配置插件 API，使用 Roche 主 API
      console.log('[Char] 未配置插件 API，使用 Roche 主 API');
      const response = await roche.ai.chat({
        conversationId: charId,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        stream: false
      });

      if (typeof response === 'string') {
        tweetContent = response;
      } else if (response?.content) {
        tweetContent = response.content;
      } else if (response?.text) {
        tweetContent = response.text;
      } else if (response?.message) {
        tweetContent = response.message;
      }
    }

    // 清理内容
    tweetContent = tweetContent.trim();

    // 去掉可能的引号
    if (tweetContent.startsWith('"') && tweetContent.endsWith('"')) {
      tweetContent = tweetContent.slice(1, -1);
    }
    if (tweetContent.startsWith('"') && tweetContent.endsWith('"')) {
      tweetContent = tweetContent.slice(1, -1);
    }

    // 限制长度
    if (tweetContent.length > 280) {
      tweetContent = tweetContent.substring(0, 277) + '...';
    }

    if (!tweetContent) {
      console.error('[Char] 生成的推文内容为空');
      return;
    }

    console.log(`[Char] 生成的推文内容: ${tweetContent}`);

    // 创建推文
    const newTweet = {
      id: Date.now(),
      userId: config.userId,
      content: tweetContent,
      timestamp: Date.now(),
      likes: [],
      retweets: [],
      replies: [],
      replyTo: null,
      isCharTweet: true,
      charId: charId
    };

    twitterData.tweets.unshift(newTweet);
    await saveData(roche);

    console.log(`[Char] ${character.name} 发布了推文: ${tweetContent.substring(0, 50)}...`);

  } catch (error) {
    console.error(`[Char] 生成推文失败:`, error);
    throw error;
  }
}

/**
 * 更新 API 配置显示
 */
function updateAPIConfigDisplay() {
  // URL 状态
  const urlStatus = document.getElementById('api-url-status');
  if (urlStatus) {
    urlStatus.textContent = settings.apiConfig.url ? settings.apiConfig.url : '未配置';
  }

  // Key 状态
  const keyStatus = document.getElementById('api-key-status');
  if (keyStatus) {
    if (settings.apiConfig.apiKey) {
      // 显示部分密钥
      const key = settings.apiConfig.apiKey;
      const masked = key.length > 8 ? key.substring(0, 8) + '...' : '已配置';
      keyStatus.textContent = masked;
    } else {
      keyStatus.textContent = '未配置';
    }
  }

  // Model
  const modelValue = document.getElementById('api-model-value');
  if (modelValue) {
    modelValue.textContent = settings.apiConfig.model || 'gpt-3.5-turbo';
  }

  // Temperature
  const tempValue = document.getElementById('api-temperature-value');
  if (tempValue) {
    tempValue.textContent = settings.apiConfig.temperature || 0.7;
  }
}

/**
 * API URL 设置
 */
function showAPIUrlSettings(roche) {
  const currentURL = settings.apiConfig.url || '';

  const newURL = prompt(
    'API 网址设置\n\n' +
    '请输入 API 接口地址\n' +
    '例如: https://api.openai.com/v1/chat/completions\n\n' +
    '当前地址：' + (currentURL || '未配置') + '\n\n' +
    '请输入新的 API 地址（留空则清除）：',
    currentURL
  );

  if (newURL !== null) {
    settings.apiConfig.url = newURL.trim();
    saveSettings(roche);

    if (settings.apiConfig.url) {
      showToast('API 地址已设置', 'success');
      console.log('[设置] API 地址:', settings.apiConfig.url);
    } else {
      showToast('API 地址已清除', 'success');
    }

    updateAPIConfigDisplay();
  }
}

/**
 * API Key 设置
 */
function showAPIKeySettings(roche) {
  const currentKey = settings.apiConfig.apiKey || '';

  const newKey = prompt(
    'API 密钥设置\n\n' +
    '请输入 API 密钥\n' +
    '例如: sk-...\n\n' +
    '当前密钥：' + (currentKey ? currentKey.substring(0, 8) + '...' : '未配置') + '\n\n' +
    '请输入新的 API 密钥（留空则清除）：',
    currentKey
  );

  if (newKey !== null) {
    settings.apiConfig.apiKey = newKey.trim();
    saveSettings(roche);

    if (settings.apiConfig.apiKey) {
      showToast('API 密钥已设置', 'success');
      console.log('[设置] API 密钥已更新');
    } else {
      showToast('API 密钥已清除', 'success');
    }

    updateAPIConfigDisplay();
  }
}

/**
 * 从 API 拉取可用模型列表
 */
async function fetchAvailableModels(roche) {
  if (!settings.apiConfig.url || !settings.apiConfig.apiKey) {
    showToast('请先配置 API 地址和密钥', 'error');
    return null;
  }

  try {
    // 尝试从 API 获取模型列表
    // OpenAI 格式: https://api.openai.com/v1/models
    let modelsEndpoint = settings.apiConfig.url;

    // 如果是聊天接口，尝试转换为模型列表接口
    if (modelsEndpoint.includes('/chat/completions')) {
      modelsEndpoint = modelsEndpoint.replace('/chat/completions', '/models');
    } else if (modelsEndpoint.includes('/v1/')) {
      // 确保以 /models 结尾
      const baseUrl = modelsEndpoint.split('/v1/')[0];
      modelsEndpoint = baseUrl + '/v1/models';
    } else if (!modelsEndpoint.includes('/models')) {
      // 如果没有 /models，尝试添加
      modelsEndpoint = modelsEndpoint.replace(/\/$/, '') + '/models';
    }

    console.log('[API] 拉取模型接口:', modelsEndpoint);
    showToast('正在拉取模型列表...', 'success');

    const response = await fetch(modelsEndpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${settings.apiConfig.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.warn(`[API] 模型接口返回 ${response.status}，使用预设模型列表`);
      return null;
    }

    const data = await response.json();

    // 解析不同格式的响应
    let models = [];

    if (data.data && Array.isArray(data.data)) {
      // OpenAI 格式: { data: [{id: "gpt-4", ...}, ...] }
      models = data.data.map(m => m.id || m.name || m.model).filter(Boolean);
    } else if (Array.isArray(data.models)) {
      // 其他格式: { models: ["model1", "model2", ...] }
      models = data.models;
    } else if (Array.isArray(data)) {
      // 直接数组: ["model1", "model2", ...]
      models = data;
    }

    if (models.length === 0) {
      console.warn('[API] 响应中未找到模型数据，使用预设列表');
      return null;
    }

    showToast(`成功拉取 ${models.length} 个模型`, 'success');
    return models;

  } catch (error) {
    console.warn('[API] 拉取模型列表失败，使用预设列表:', error.message);
    return null;
  }
}

/**
 * API Model 设置 - 弹出对话框选择
 */
function showAPIModelSettings(roche) {
  const currentModel = settings.apiConfig.model || 'gpt-3.5-turbo';

  // 预设常用模型
  const predefinedModels = [
    'gpt-4',
    'gpt-4-turbo',
    'gpt-4o',
    'gpt-3.5-turbo',
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307',
    'deepseek-chat',
    'deepseek-coder',
    'qwen-plus',
    'qwen-turbo'
  ];

  // 创建模型选择对话框
  const dialog = document.createElement('div');
  dialog.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;

  const dialogContent = document.createElement('div');
  dialogContent.style.cssText = `
    background: white;
    border-radius: 16px;
    width: 90%;
    max-width: 500px;
    max-height: 80vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  `;

  dialogContent.innerHTML = `
    <div style="padding: 20px; border-bottom: 1px solid #eff3f4; display: flex; align-items: center; justify-content: space-between;">
      <div style="font-size: 20px; font-weight: 700; color: #0f1419;">选择模型</div>
      <button id="refresh-models-btn" style="background: #1d9bf0; color: white; border: none; border-radius: 20px; padding: 8px 16px; font-size: 14px; font-weight: 600; cursor: pointer;">
        🔄 从 API 拉取
      </button>
    </div>
    <div id="models-list" style="flex: 1; overflow-y: auto; padding: 12px;">
      <!-- 默认显示预设模型 -->
    </div>
    <div style="padding: 12px; border-top: 1px solid #eff3f4;">
      <button id="close-model-dialog" style="width: 100%; background: #0f1419; color: white; border: none; border-radius: 24px; padding: 12px; font-size: 15px; font-weight: 600; cursor: pointer;">
        关闭
      </button>
    </div>
  `;

  dialog.appendChild(dialogContent);
  document.body.appendChild(dialog);

  // 渲染模型列表
  const renderModels = (models, title = '常用模型') => {
    const modelsList = document.getElementById('models-list');
    modelsList.innerHTML = `
      <div style="font-size: 13px; color: #536471; padding: 8px 4px; font-weight: 600;">${title}</div>
      ${models.map(model => `
        <div class="model-item" data-model="${model}" style="
          padding: 16px;
          border-radius: 8px;
          margin-bottom: 8px;
          cursor: pointer;
          background: ${model === currentModel ? '#eff3f4' : 'transparent'};
          border: 1px solid ${model === currentModel ? '#1d9bf0' : '#eff3f4'};
          transition: all 0.2s;
        ">
          <div style="font-size: 15px; font-weight: 600; color: #0f1419;">${model}</div>
          ${model === currentModel ? '<div style="font-size: 13px; color: #1d9bf0; margin-top: 4px;">✓ 当前使用</div>' : ''}
        </div>
      `).join('')}
    `;

    // 绑定点击事件
    modelsList.querySelectorAll('.model-item').forEach(item => {
      item.addEventListener('mouseenter', () => {
        if (item.dataset.model !== currentModel) {
          item.style.background = '#f7f9f9';
        }
      });
      item.addEventListener('mouseleave', () => {
        if (item.dataset.model !== currentModel) {
          item.style.background = 'transparent';
        }
      });
      item.addEventListener('click', () => {
        const selectedModel = item.dataset.model;
        settings.apiConfig.model = selectedModel;
        saveSettings(roche);
        showToast(`已切换到模型：${selectedModel}`, 'success');
        updateAPIConfigDisplay();
        closeDialog();
      });
    });
  };

  // 默认显示预设模型
  renderModels(predefinedModels);

  // 关闭对话框
  const closeDialog = () => {
    if (document.body.contains(dialog)) {
      document.body.removeChild(dialog);
    }
  };

  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) closeDialog();
  });

  document.getElementById('close-model-dialog').addEventListener('click', closeDialog);

  // 刷新按钮 - 拉取模型
  document.getElementById('refresh-models-btn').addEventListener('click', async () => {
    const modelsList = document.getElementById('models-list');
    modelsList.innerHTML = '<div style="text-align: center; padding: 40px; color: #536471;">正在拉取模型...</div>';

    const models = await fetchAvailableModels(roche);

    if (models && models.length > 0) {
      // 显示拉取到的模型
      renderModels(models, `从 API 拉取的模型 (${models.length} 个)`);
    } else {
      // 拉取失败，显示预设模型
      showToast('API 不支持模型列表接口，显示预设模型', 'error');
      renderModels(predefinedModels, '常用模型（预设）');
    }
  });
}

/**
 * API Temperature 设置
 */
function showAPITemperatureSettings(roche) {
  const currentTemp = settings.apiConfig.temperature || 0.7;

  const newTemp = prompt(
    '温度参数设置\n\n' +
    '温度范围：0.0 - 2.0\n' +
    '较低值 (0.0-0.3): 更确定、更一致\n' +
    '中等值 (0.4-0.8): 平衡创造性和一致性\n' +
    '较高值 (0.9-2.0): 更有创造性、更随机\n\n' +
    '当前温度：' + currentTemp + '\n\n' +
    '请输入新的温度值（0.0-2.0）：',
    currentTemp.toString()
  );

  if (newTemp !== null && newTemp.trim() !== '') {
    const temp = parseFloat(newTemp);

    if (isNaN(temp)) {
      showToast('请输入有效的数字', 'error');
      return;
    }

    if (temp < 0 || temp > 2) {
      showToast('温度必须在 0.0-2.0 之间', 'error');
      return;
    }

    settings.apiConfig.temperature = temp;
    saveSettings(roche);
    showToast(`已设置温度为：${temp}`, 'success');
    updateAPIConfigDisplay();
  }
}

/**
 * NPC 数量设置
 */
function showNPCCountSettings(roche) {
  const count = Object.keys(twitterData.npcs || {}).length;
  const newCount = prompt(`当前 NPC 数量：${count}\n\n请输入新的 NPC 数量（1-20）：`, count);

  if (newCount && !isNaN(newCount)) {
    const num = parseInt(newCount);
    if (num >= 1 && num <= 20) {
      settings.npcCount = num;
      saveSettings(roche);
      showToast(`已设置 NPC 数量为 ${num}`, 'success');
      document.getElementById('npc-count-value').textContent = num;

      // 重新初始化 NPC 系统
      initNPCSystem(roche);
    } else {
      showToast('请输入 1-20 之间的数字', 'error');
    }
  }
}

/**
 * NPC 后端 API 设置
 */
function showNPCAPISettings(roche) {
  const currentAPI = settings.npcBackendAPI || '';

  const newAPI = prompt(
    'NPC 后端 API 地址：\n\n' +
    '用于 NPC 自动发帖的后端接口\n' +
    '例如: https://your-backend.com/api/npc/post\n\n' +
    '当前地址：' + (currentAPI || '未配置') + '\n\n' +
    '请输入新的 API 地址（留空则清除）：',
    currentAPI
  );

  if (newAPI !== null) {
    settings.npcBackendAPI = newAPI.trim();
    saveSettings(roche);

    if (settings.npcBackendAPI) {
      showToast('NPC 后端 API 已设置', 'success');
      console.log('[设置] NPC 后端 API:', settings.npcBackendAPI);
    } else {
      showToast('NPC 后端 API 已清除', 'success');
    }

    // 更新显示
    const apiStatus = document.getElementById('npc-api-status');
    if (apiStatus) {
      apiStatus.textContent = settings.npcBackendAPI ? '已配置' : '未配置';
    }
  }
}

/**
 * NPC 发帖频率设置
 */
function showNPCFrequencySettings(roche) {
  const options = [
    { label: '非常频繁（每 15-30 分钟）', min: 15, max: 30 },
    { label: '频繁（每 30-60 分钟）', min: 30, max: 60 },
    { label: '正常（每 30-120 分钟）', min: 30, max: 120 },
    { label: '较少（每 1-2 小时）', min: 60, max: 120 },
    { label: '很少（每 2-4 小时）', min: 120, max: 240 }
  ];

  const choice = prompt(
    '选择 NPC 发帖频率：\n\n' +
    options.map((opt, i) => `${i + 1}. ${opt.label}`).join('\n') +
    '\n\n请输入序号（1-5）：',
    '3'
  );

  if (choice && !isNaN(choice)) {
    const index = parseInt(choice) - 1;
    if (index >= 0 && index < options.length) {
      settings.npcPostInterval = options[index];
      // 同时更新 NPC_CONFIG
      NPC_CONFIG.postIntervalMin = options[index].min;
      NPC_CONFIG.postIntervalMax = options[index].max;
      saveSettings(roche);
      showToast(`已设置为：${options[index].label}`, 'success');
      document.getElementById('npc-frequency-value').textContent = options[index].label.match(/每 (.+?)）/)[1];

      // 重新初始化 NPC 系统
      initNPCSystem(roche);
    }
  }
}

/**
 * 测试 NPC 发帖 API
 */
async function testNPCPostAPI(roche) {
  // 检查 API 配置
  if (!settings.apiConfig.url || !settings.apiConfig.apiKey) {
    showToast('请先配置 API 地址和密钥', 'error');
    return;
  }

  showToast('正在测试 API...', 'success');

  try {
    // 构造测试请求
    const testPrompt = `你是一个活跃的社交媒体用户。请用中文生成一条简短的推文（不超过100字），内容可以是日常生活、心情感悟或有趣的想法。只返回推文内容，不要有其他说明。`;

    console.log('[测试] API 地址:', settings.apiConfig.url);
    console.log('[测试] 模型:', settings.apiConfig.model);
    console.log('[测试] 温度:', settings.apiConfig.temperature);

    // 确保 URL 是聊天接口
    let apiUrl = settings.apiConfig.url;
    if (!apiUrl.includes('/chat/completions') && !apiUrl.includes('/completions')) {
      console.warn('[测试] URL 可能不正确，尝试添加 /chat/completions');
      // 如果是基础 URL，尝试添加标准路径
      if (apiUrl.includes('/v1')) {
        apiUrl = apiUrl.replace(/\/v1\/?.*$/, '/v1/chat/completions');
      } else {
        apiUrl = apiUrl.replace(/\/$/, '') + '/v1/chat/completions';
      }
      console.log('[测试] 修正后的 URL:', apiUrl);
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiConfig.apiKey}`
      },
      body: JSON.stringify({
        model: settings.apiConfig.model,
        messages: [
          { role: 'user', content: testPrompt }
        ],
        temperature: settings.apiConfig.temperature,
        max_tokens: 200
      }),
      mode: 'cors' // 添加 CORS 模式
    });

    console.log('[测试] HTTP 状态:', response.status, response.statusText);

    if (!response.ok) {
      // 尝试读取错误详情
      let errorDetail = '';
      try {
        const errorData = await response.json();
        errorDetail = errorData.error?.message || errorData.message || JSON.stringify(errorData);
      } catch (e) {
        errorDetail = await response.text();
      }
      console.error('[测试] 错误详情:', errorDetail);
      throw new Error(`HTTP ${response.status}: ${response.statusText}\n详情: ${errorDetail}`);
    }

    const data = await response.json();
    console.log('[测试] API 响应:', data);

    // 解析响应
    let generatedContent = '';

    if (data.choices && data.choices[0]) {
      // OpenAI 格式
      generatedContent = data.choices[0].message?.content || data.choices[0].text || '';
    } else if (data.content) {
      // 其他格式
      generatedContent = data.content;
    } else if (data.response) {
      generatedContent = data.response;
    }

    if (!generatedContent) {
      throw new Error('API 返回的数据格式不正确，无法解析内容');
    }

    // 显示测试结果对话框
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;

    const dialogContent = document.createElement('div');
    dialogContent.style.cssText = `
      background: white;
      border-radius: 16px;
      width: 90%;
      max-width: 500px;
      max-height: 70vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    `;

    dialogContent.innerHTML = `
      <div style="padding: 20px; border-bottom: 1px solid #eff3f4;">
        <div style="font-size: 20px; font-weight: 700; color: #0f1419;">✅ API 测试成功</div>
      </div>
      <div style="flex: 1; overflow-y: auto; padding: 20px;">
        <div style="margin-bottom: 16px;">
          <div style="font-size: 13px; color: #536471; font-weight: 600; margin-bottom: 8px;">API 配置</div>
          <div style="background: #f7f9f9; padding: 12px; border-radius: 8px; font-size: 13px; color: #0f1419;">
            <div style="margin-bottom: 4px;"><strong>地址:</strong> ${settings.apiConfig.url}</div>
            <div style="margin-bottom: 4px;"><strong>模型:</strong> ${settings.apiConfig.model}</div>
            <div><strong>温度:</strong> ${settings.apiConfig.temperature}</div>
          </div>
        </div>
        <div>
          <div style="font-size: 13px; color: #536471; font-weight: 600; margin-bottom: 8px;">生成的内容</div>
          <div style="background: #eff3f4; padding: 16px; border-radius: 12px; font-size: 15px; color: #0f1419; line-height: 1.5;">
            ${generatedContent}
          </div>
        </div>
      </div>
      <div style="padding: 12px; border-top: 1px solid #eff3f4;">
        <button id="close-test-dialog" style="width: 100%; background: #1d9bf0; color: white; border: none; border-radius: 24px; padding: 12px; font-size: 15px; font-weight: 600; cursor: pointer;">
          确定
        </button>
      </div>
    `;

    dialog.appendChild(dialogContent);
    document.body.appendChild(dialog);

    // 关闭对话框
    const closeDialog = () => {
      if (document.body.contains(dialog)) {
        document.body.removeChild(dialog);
      }
    };

    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) closeDialog();
    });

    document.getElementById('close-test-dialog').addEventListener('click', closeDialog);

    showToast('API 测试成功！', 'success');

  } catch (error) {
    console.error('[测试] API 测试失败:', error);

    // 显示错误对话框
    const errorDialog = document.createElement('div');
    errorDialog.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;

    const errorContent = document.createElement('div');
    errorContent.style.cssText = `
      background: white;
      border-radius: 16px;
      width: 90%;
      max-width: 500px;
      padding: 20px;
    `;

    errorContent.innerHTML = `
      <div style="font-size: 20px; font-weight: 700; color: #f4212e; margin-bottom: 16px;">❌ API 测试失败</div>
      <div style="background: #fff1f0; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
        <div style="font-size: 13px; color: #536471; font-weight: 600; margin-bottom: 8px;">错误信息</div>
        <div style="font-size: 14px; color: #f4212e; word-break: break-word; white-space: pre-wrap;">${error.message}</div>
      </div>
      <div style="background: #f7f9f9; padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 13px;">
        <div style="font-weight: 600; margin-bottom: 8px; color: #0f1419;">当前配置</div>
        <div style="color: #536471; margin-bottom: 4px;">API: ${settings.apiConfig.url || '未配置'}</div>
        <div style="color: #536471; margin-bottom: 4px;">模型: ${settings.apiConfig.model || '未配置'}</div>
        <div style="color: #536471;">密钥: ${settings.apiConfig.apiKey ? '已配置' : '未配置'}</div>
      </div>
      <div style="font-size: 12px; color: #536471; margin-bottom: 16px;">
        💡 提示：<br>
        1. 确保 API 地址以 /v1/chat/completions 结尾<br>
        2. 检查 API 密钥是否正确<br>
        3. 确认模型名称是否支持<br>
        4. 查看浏览器控制台了解详细错误
      </div>
      <button id="close-error-dialog" style="width: 100%; background: #0f1419; color: white; border: none; border-radius: 24px; padding: 12px; font-size: 15px; font-weight: 600; cursor: pointer;">
        关闭
      </button>
    `;

    errorDialog.appendChild(errorContent);
    document.body.appendChild(errorDialog);

    errorDialog.addEventListener('click', (e) => {
      if (e.target === errorDialog || e.target.id === 'close-error-dialog') {
        if (document.body.contains(errorDialog)) {
          document.body.removeChild(errorDialog);
        }
      }
    });

    showToast('API 测试失败，请检查配置', 'error');
  }
}

/**
 * NPC 管理页面
 */
function showNPCManagement(roche) {
  const npcs = Object.values(twitterData.npcs || {});

  if (npcs.length === 0) {
    showToast('暂无 NPC，请先创建', 'info');
    return;
  }

  // TODO: 显示 NPC 管理界面
  showToast('NPC 管理功能开发中...', 'info');
}

/**
 * 显示编辑资料对话框
 */
function showEditProfileDialog(roche) {
  const user = twitterData.users[currentUser];
  if (!user) return;

  const dialog = document.createElement('div');
  dialog.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;

  const dialogContent = document.createElement('div');
  dialogContent.style.cssText = `
    background: white;
    border-radius: 16px;
    width: 90%;
    max-width: 500px;
    max-height: 80vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  `;

  dialogContent.innerHTML = `
    <div style="padding: 20px; border-bottom: 1px solid #eff3f4; display: flex; align-items: center; justify-content: space-between;">
      <div style="font-size: 20px; font-weight: 700; color: #0f1419;">编辑资料</div>
      <button id="close-edit-dialog" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #536471;">×</button>
    </div>
    <div style="flex: 1; overflow-y: auto; padding: 20px;">
      <div style="margin-bottom: 20px;">
        <label style="display: block; font-size: 13px; color: #536471; margin-bottom: 8px; font-weight: 600;">用户名</label>
        <input type="text" id="edit-name" value="${user.name}" style="width: 100%; padding: 12px; border: 1px solid #cfd9de; border-radius: 8px; font-size: 15px; outline: none;" placeholder="输入用户名">
      </div>
      <div style="margin-bottom: 20px;">
        <label style="display: block; font-size: 13px; color: #536471; margin-bottom: 8px; font-weight: 600;">账号 (用户名)</label>
        <input type="text" id="edit-username" value="${user.username}" style="width: 100%; padding: 12px; border: 1px solid #cfd9de; border-radius: 8px; font-size: 15px; outline: none;" placeholder="@username">
      </div>
      <div style="margin-bottom: 20px;">
        <label style="display: block; font-size: 13px; color: #536471; margin-bottom: 8px; font-weight: 600;">简介</label>
        <textarea id="edit-bio" rows="3" style="width: 100%; padding: 12px; border: 1px solid #cfd9de; border-radius: 8px; font-size: 15px; outline: none; resize: vertical;" placeholder="介绍一下你自己">${user.bio || ''}</textarea>
      </div>
      <div style="margin-bottom: 20px;">
        <label style="display: block; font-size: 13px; color: #536471; margin-bottom: 8px; font-weight: 600;">头像 URL</label>
        <input type="text" id="edit-avatar" value="${user.avatar}" style="width: 100%; padding: 12px; border: 1px solid #cfd9de; border-radius: 8px; font-size: 15px; outline: none;" placeholder="https://...">
        <div style="margin-top: 12px; display: flex; align-items: center; gap: 12px;">
          <img src="${user.avatar}" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover;" id="avatar-preview">
          <span style="font-size: 13px; color: #536471;">当前头像预览</span>
        </div>
      </div>
      <div>
        <label style="display: block; font-size: 13px; color: #536471; margin-bottom: 8px; font-weight: 600;">背景图 URL</label>
        <input type="text" id="edit-banner" value="${user.banner || ''}" style="width: 100%; padding: 12px; border: 1px solid #cfd9de; border-radius: 8px; font-size: 15px; outline: none;" placeholder="https://...">
      </div>
    </div>
    <div style="padding: 12px; border-top: 1px solid #eff3f4; display: flex; gap: 12px;">
      <button id="cancel-edit" style="flex: 1; background: white; color: #0f1419; border: 1px solid #cfd9de; border-radius: 24px; padding: 12px; font-size: 15px; font-weight: 600; cursor: pointer;">
        取消
      </button>
      <button id="save-edit" style="flex: 1; background: #1d9bf0; color: white; border: none; border-radius: 24px; padding: 12px; font-size: 15px; font-weight: 600; cursor: pointer;">
        保存
      </button>
    </div>
  `;

  dialog.appendChild(dialogContent);
  document.body.appendChild(dialog);

  // 头像预览实时更新
  const avatarInput = document.getElementById('edit-avatar');
  const avatarPreview = document.getElementById('avatar-preview');
  avatarInput.addEventListener('input', () => {
    avatarPreview.src = avatarInput.value || user.avatar;
  });

  // 关闭对话框
  const closeDialog = () => {
    if (document.body.contains(dialog)) {
      document.body.removeChild(dialog);
    }
  };

  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) closeDialog();
  });

  document.getElementById('close-edit-dialog').addEventListener('click', closeDialog);
  document.getElementById('cancel-edit').addEventListener('click', closeDialog);

  // 保存修改
  document.getElementById('save-edit').addEventListener('click', async () => {
    const name = document.getElementById('edit-name').value.trim();
    const username = document.getElementById('edit-username').value.trim();
    const bio = document.getElementById('edit-bio').value.trim();
    const avatar = document.getElementById('edit-avatar').value.trim();
    const banner = document.getElementById('edit-banner').value.trim();

    if (!name) {
      showToast('用户名不能为空', 'error');
      return;
    }

    if (!username) {
      showToast('账号不能为空', 'error');
      return;
    }

    // 确保 username 以 @ 开头
    const formattedUsername = username.startsWith('@') ? username : '@' + username;

    // 更新用户信息
    twitterData.users[currentUser].name = name;
    twitterData.users[currentUser].username = formattedUsername;
    twitterData.users[currentUser].bio = bio;
    if (avatar) twitterData.users[currentUser].avatar = avatar;
    if (banner) twitterData.users[currentUser].banner = banner;

    await saveData(roche);
    showToast('资料已更新', 'success');
    closeDialog();

    // 刷新个人资料页
    showProfile(currentUser, roche);
  });
}

/**
 * 显示推文菜单
 */
function showTweetMenu(tweetId, btnElement, roche) {
  // 移除已存在的菜单
  const existingMenu = document.querySelector('.tweet-menu-popup');
  if (existingMenu) {
    existingMenu.remove();
  }

  const menu = document.createElement('div');
  menu.className = 'tweet-menu-popup';
  menu.style.cssText = `
    position: fixed;
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 1000;
    overflow: hidden;
    min-width: 180px;
  `;

  menu.innerHTML = `
    <div class="tweet-menu-item" data-action="delete" style="padding: 16px; cursor: pointer; display: flex; align-items: center; gap: 12px; transition: background 0.2s;">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="#f4212e">
        <path d="M16 6V4.5C16 3.12 14.88 2 13.5 2h-3C9.11 2 8 3.12 8 4.5V6H3v2h1.06l.81 11.21C4.98 20.78 6.28 22 7.86 22h8.27c1.58 0 2.88-1.22 3-2.79L19.93 8H21V6h-5zm-6-1.5c0-.28.22-.5.5-.5h3c.27 0 .5.22.5.5V6h-4V4.5zm7.13 14.57c-.04.52-.47.93-1 .93H7.86c-.53 0-.96-.41-1-.93L6.07 8h11.85l-.79 11.07z"></path>
      </svg>
      <span style="color: #f4212e; font-weight: 600;">删除</span>
    </div>
  `;

  // 定位菜单
  const rect = btnElement.getBoundingClientRect();
  menu.style.top = `${rect.bottom + 8}px`;
  menu.style.right = `${window.innerWidth - rect.right}px`;

  document.body.appendChild(menu);

  // 菜单项事件
  menu.querySelector('[data-action="delete"]').addEventListener('click', async () => {
    menu.remove();
    await deleteTweet(tweetId, roche);
  });

  // 悬停效果
  menu.querySelectorAll('.tweet-menu-item').forEach(item => {
    item.addEventListener('mouseenter', () => {
      item.style.background = '#f7f9f9';
    });
    item.addEventListener('mouseleave', () => {
      item.style.background = 'white';
    });
  });

  // 点击外部关闭菜单
  setTimeout(() => {
    const closeMenu = (e) => {
      if (!menu.contains(e.target) && e.target !== btnElement) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    };
    document.addEventListener('click', closeMenu);
  }, 100);
}

/**
 * 删除推文
 */
async function deleteTweet(tweetId, roche) {
  const tweet = twitterData.tweets.find(t => t.id === tweetId);
  if (!tweet) return;

  if (tweet.userId !== currentUser) {
    showToast('你只能删除自己的推文', 'error');
    return;
  }

  const confirmed = confirm('确定要删除这条推文吗？此操作无法撤销。');
  if (!confirmed) return;

  // 从数组中删除
  twitterData.tweets = twitterData.tweets.filter(t => t.id !== tweetId);

  // 同时删除所有相关的回复和转发
  twitterData.tweets = twitterData.tweets.filter(t => t.replyTo !== tweetId);

  await saveData(roche);
  showToast('推文已删除', 'success');

  // 刷新当前视图
  if (currentView === 'timeline') {
    const activeTab = document.querySelector('.timeline-tab.active');
    const tabType = activeTab ? activeTab.dataset.tab : 'recommended';
    renderTweets(roche, tabType);
  } else if (currentView === 'profile') {
    showProfile(currentUser, roche);
  }
}

/**
 * 显示 Char 发推文管理页面
 */
async function showCharTweetsManagement(roche) {
  // 获取所有 Char
  let characters = [];
  try {
    const conversations = await roche.conversation.list();

    // 获取每个对话的角色信息
    for (const conv of conversations) {
      try {
        const character = await roche.character.get(conv.id);
        if (character) {
          characters.push({
            id: conv.id,
            name: character.name || conv.title,
            avatar: character.avatar || conv.avatar,
            description: character.description || character.persona || ''
          });
        }
      } catch (e) {
        console.log('[Twitter] 获取角色信息失败:', conv.id, e);
      }
    }
  } catch (error) {
    console.error('[Twitter] 获取 Char 列表失败:', error);
    showToast('获取 Char 列表失败', 'error');
    return;
  }

  if (characters.length === 0) {
    showToast('没有可用的 Char，请先在 Roche 中创建角色', 'info');
    return;
  }

  // 创建对话框
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

  const dialog = document.createElement('div');
  dialog.style.cssText = `
    background: white;
    border-radius: 16px;
    width: 90%;
    max-width: 600px;
    max-height: 80vh;
    overflow-y: auto;
    animation: slideUp 0.3s;
  `;

  dialog.innerHTML = `
    <div style="padding: 20px; border-bottom: 1px solid #eff3f4;">
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <h2 style="font-size: 20px; font-weight: 700; margin: 0;">Char 发推文管理</h2>
        <button id="close-char-dialog" style="background: none; border: none; font-size: 20px; cursor: pointer; padding: 8px; border-radius: 50%; transition: background 0.2s;">✕</button>
      </div>
      <p style="color: #536471; font-size: 14px; margin-top: 8px;">选择一个 Char，让 TA 在推特上发帖</p>
    </div>
    <div style="padding: 16px;">
      ${characters.map(char => {
        const initial = char.name.charAt(0).toUpperCase();
        const avatarHtml = char.avatar
          ? `<img src="${char.avatar}" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover;">`
          : `<div style="width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; color: white; font-size: 20px; font-weight: 700;">${initial}</div>`;

        return `
          <div class="char-item" data-char-id="${char.id}" style="display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 8px; cursor: pointer; transition: background 0.2s; margin-bottom: 8px;">
            ${avatarHtml}
            <div style="flex: 1; min-width: 0;">
              <div style="font-size: 15px; font-weight: 700; color: #0f1419;">${escapeHtml(char.name)}</div>
              <div style="font-size: 13px; color: #536471; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(char.description.substring(0, 60)) || '暂无描述'}</div>
            </div>
            <div style="color: #1d9bf0; font-size: 20px;">›</div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  // 关闭按钮
  document.getElementById('close-char-dialog').addEventListener('click', () => {
    document.body.removeChild(overlay);
  });

  // 点击背景关闭
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      document.body.removeChild(overlay);
    }
  });

  // 绑定 Char 点击事件
  dialog.querySelectorAll('.char-item').forEach(item => {
    item.addEventListener('click', () => {
      const charId = item.dataset.charId;
      const character = characters.find(c => c.id === charId);
      document.body.removeChild(overlay);
      showCharTweetSettings(roche, character);
    });

    item.addEventListener('mouseenter', () => {
      item.style.background = '#f7f9f9';
    });

    item.addEventListener('mouseleave', () => {
      item.style.background = 'transparent';
    });
  });
}

/**
 * 显示 Char 发推文设置
 */
async function showCharTweetSettings(roche, character) {
  // 检查是否已经配置过
  const charTweetConfig = twitterData.charTweets || {};
  const existingConfig = charTweetConfig[character.id];

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
  `;

  const dialog = document.createElement('div');
  dialog.style.cssText = `
    background: white;
    border-radius: 16px;
    width: 90%;
    max-width: 480px;
    animation: slideUp 0.3s;
  `;

  const initial = character.name.charAt(0).toUpperCase();
  const avatarHtml = character.avatar
    ? `<img src="${character.avatar}" style="width: 64px; height: 64px; border-radius: 50%; object-fit: cover;">`
    : `<div style="width: 64px; height: 64px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; color: white; font-size: 28px; font-weight: 700;">${initial}</div>`;

  dialog.innerHTML = `
    <div style="padding: 20px; border-bottom: 1px solid #eff3f4;">
      <button id="back-char-settings" style="background: none; border: none; font-size: 20px; cursor: pointer; padding: 8px; margin-right: 12px;">←</button>
      <span style="font-size: 20px; font-weight: 700;">开通推特账号</span>
    </div>
    <div style="padding: 20px;">
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
        ${avatarHtml}
        <div style="flex: 1;">
          <div style="font-size: 17px; font-weight: 700;">${escapeHtml(character.name)}</div>
          <div style="font-size: 14px; color: #536471; line-height: 1.4;">${escapeHtml(character.description.substring(0, 60)) || '暂无描述'}</div>
        </div>
      </div>

      <div style="background: #f7f9f9; padding: 16px; border-radius: 12px; margin-bottom: 20px;">
        <div style="font-size: 15px; color: #0f1419; margin-bottom: 8px; font-weight: 600;">✨ AI 完全自主</div>
        <div style="font-size: 14px; color: #536471; line-height: 1.5;">
          • 根据角色人设自动生成推文内容<br>
          • AI 自己决定什么时候发推<br>
          • 自动选择使用本名或创建小号<br>
          • 模拟真实用户行为，完全随机
        </div>
      </div>

      <div style="background: #fff4e6; padding: 12px; border-radius: 8px; margin-bottom: 20px; border-left: 3px solid #ff9800;">
        <div style="font-size: 13px; color: #e65100; line-height: 1.4;">
          <strong>自然行为：</strong>发推频率随机，可能一天很活跃，可能几天不发，就像真人一样
        </div>
      </div>

      <div style="display: flex; gap: 12px;">
        <button id="save-char-settings" style="flex: 1; background: #1d9bf0; color: white; border: none; padding: 14px; border-radius: 24px; font-weight: 700; font-size: 15px; cursor: pointer;">
          ${existingConfig ? '✅ 已开通' : '🚀 开通推特'}
        </button>
        ${existingConfig ? `
          <button id="stop-char-tweets" style="flex: 1; background: #f4212e; color: white; border: none; padding: 14px; border-radius: 24px; font-weight: 700; font-size: 15px; cursor: pointer;">
            关闭推特
          </button>
        ` : ''}
      </div>
    </div>
  `;

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  // 返回按钮
  document.getElementById('back-char-settings').addEventListener('click', () => {
    document.body.removeChild(overlay);
    showCharTweetsManagement(roche);
  });

  // 保存设置（开通推特）
  document.getElementById('save-char-settings').addEventListener('click', async () => {
    if (existingConfig) {
      // 已开通，只是确认
      showToast(`${character.name} 的推特已在运行中`, 'info');
      document.body.removeChild(overlay);
      return;
    }

    // AI 自动决定参数
    // 1. 随机决定使用本名还是小号 (70% 本名, 30% 小号)
    const useAlias = Math.random() > 0.7;

    // 2. 随机生成频率 (1-5条/天，偏向中等频率)
    const frequencies = [1, 2, 2, 3, 3, 3, 4, 5]; // 权重分布
    const frequency = frequencies[Math.floor(Math.random() * frequencies.length)];

    // 生成用户
    let userId = character.id;
    let username = character.name;

    if (useAlias) {
      // 创建小号
      const randomNum = Math.floor(Math.random() * 9999);
      username = `${character.name}_${randomNum}`;
      userId = `char_alias_${character.id}_${Date.now()}`;

      twitterData.users[userId] = {
        name: username,
        username: `@${username}`,
        avatar: character.avatar || generateAvatar(username),
        bio: character.description.substring(0, 100) || `${character.name}的推特`,
        following: 0,
        followers: 0,
        isChar: true,
        charId: character.id
      };
    } else {
      // 使用本名
      if (!twitterData.users[userId]) {
        twitterData.users[userId] = {
          name: character.name,
          username: `@${character.name}`,
          avatar: character.avatar || generateAvatar(character.name),
          bio: character.description.substring(0, 100) || '',
          following: 0,
          followers: 0,
          isChar: true,
          charId: character.id
        };
      }
    }

    // 保存配置
    if (!twitterData.charTweets) {
      twitterData.charTweets = {};
    }

    twitterData.charTweets[character.id] = {
      enabled: true,
      accountType: useAlias ? 'alias' : 'original',
      userId: userId,
      frequency: frequency,
      lastTweetTime: 0
    };

    await saveData(roche);

    const accountInfo = useAlias ? `小号 @${username}` : `本名 @${character.name}`;
    showToast(`🎉 ${character.name} 已开通推特！\n账号：${accountInfo}\n频率：每天 ${frequency} 条`, 'success');
    document.body.removeChild(overlay);
  });

  // 停止发推
  if (existingConfig) {
    document.getElementById('stop-char-tweets').addEventListener('click', async () => {
      delete twitterData.charTweets[character.id];
      await saveData(roche);
      showToast(`${character.name} 已停止发推文`, 'success');
      document.body.removeChild(overlay);
    });
  }

  // 点击背景关闭
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      document.body.removeChild(overlay);
    }
  });
}

})(); // 立即执行函数结束
