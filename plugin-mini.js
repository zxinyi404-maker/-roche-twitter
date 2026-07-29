/**
 * Roche Twitter - 精简版
 * 只包含核心功能，验证是否因为代码太长导致加载失败
 */

async function init(roche, container) {
  console.log('[Twitter Mini] 初始化开始');

  const STORAGE_KEY = 'twitter_mini_data';
  let currentUser = null;
  let twitterData = {
    tweets: [],
    users: {},
    follows: {},
    nextTweetId: 1
  };

  // 加载数据
  async function loadData() {
    const stored = await roche.storage.get(STORAGE_KEY);
    if (stored) {
      twitterData = JSON.parse(stored);
    }
    const activePersona = await roche.persona.getActiveUserPersona();
    if (activePersona) {
      currentUser = activePersona.id;
      if (!twitterData.users[currentUser]) {
        twitterData.users[currentUser] = {
          id: currentUser,
          name: activePersona.name,
          username: `@${activePersona.name.toLowerCase().replace(/\s/g, '')}`,
          avatar: activePersona.avatar || generateAvatar(activePersona.name),
          bio: activePersona.description || '',
          isPersona: true
        };
      }
    }
  }

  // 保存数据
  async function saveData() {
    await roche.storage.set(STORAGE_KEY, JSON.stringify(twitterData));
  }

  // 生成头像
  function generateAvatar(name) {
    const colors = ['#1da1f2', '#17bf63', '#e0245e', '#ff6154', '#794bc4'];
    const color = colors[Math.abs(name.split('').reduce((a,c)=>a+c.charCodeAt(0),0)) % colors.length];
    return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="${color}"/><text x="50" y="50" font-size="40" fill="white" text-anchor="middle" dominant-baseline="central">${name[0]}</text></svg>`)}`;
  }

  // 渲染 UI
  function render() {
    const user = twitterData.users[currentUser];
    container.innerHTML = `
      <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, sans-serif;">
        <div style="padding: 16px; border-bottom: 1px solid #eff3f4;">
          <h1 style="font-size: 20px; font-weight: 700;">𝕏 Twitter Mini</h1>
          <p style="color: #536471; font-size: 13px;">精简版 v2.0.0 - 代码：${(container.innerHTML.length / 1024).toFixed(1)}KB</p>
        </div>

        <div style="padding: 16px; border-bottom: 1px solid #eff3f4;">
          <div style="display: flex; gap: 12px;">
            <img src="${user.avatar}" style="width: 48px; height: 48px; border-radius: 50%;">
            <div style="flex: 1;">
              <textarea id="tweet-input" placeholder="有什么新鲜事？" style="
                width: 100%;
                border: none;
                font-size: 20px;
                resize: none;
                outline: none;
                font-family: inherit;
              " rows="3"></textarea>
              <button id="tweet-btn" style="
                background: #1d9bf0;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 20px;
                font-weight: 700;
                cursor: pointer;
                margin-top: 8px;
              ">发推文</button>
            </div>
          </div>
        </div>

        <div id="tweets-list"></div>
      </div>
    `;

    // 渲染推文列表
    const listEl = container.querySelector('#tweets-list');
    listEl.innerHTML = twitterData.tweets.map(tweet => {
      const author = twitterData.users[tweet.userId];
      const isLiked = tweet.likes.includes(currentUser);
      return `
        <div style="padding: 16px; border-bottom: 1px solid #eff3f4;">
          <div style="display: flex; gap: 12px;">
            <img src="${author.avatar}" style="width: 48px; height: 48px; border-radius: 50%;">
            <div style="flex: 1;">
              <div>
                <span style="font-weight: 700;">${author.name}</span>
                <span style="color: #536471;"> ${author.username}</span>
              </div>
              <div style="margin-top: 4px;">${tweet.content}</div>
              <div style="margin-top: 12px; display: flex; gap: 20px;">
                <span style="color: #536471; cursor: pointer;" data-action="like" data-tweet-id="${tweet.id}">
                  ${isLiked ? '❤️' : '🤍'} ${tweet.likes.length}
                </span>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('') || '<div style="padding: 40px; text-align: center; color: #536471;">还没有推文</div>';

    // 绑定事件
    container.querySelector('#tweet-btn').addEventListener('click', async () => {
      const input = container.querySelector('#tweet-input');
      const content = input.value.trim();
      if (!content) return;

      twitterData.tweets.unshift({
        id: twitterData.nextTweetId++,
        userId: currentUser,
        content: content,
        timestamp: Date.now(),
        likes: [],
        retweets: [],
        replies: []
      });

      await saveData();
      input.value = '';
      render();
    });

    // 点赞事件
    container.querySelectorAll('[data-action="like"]').forEach(el => {
      el.addEventListener('click', async () => {
        const tweetId = parseInt(el.dataset.tweetId);
        const tweet = twitterData.tweets.find(t => t.id === tweetId);
        const index = tweet.likes.indexOf(currentUser);
        if (index > -1) {
          tweet.likes.splice(index, 1);
        } else {
          tweet.likes.push(currentUser);
        }
        await saveData();
        render();
      });
    });
  }

  // 初始化
  await loadData();
  render();

  console.log('[Twitter Mini] 初始化完成');

  return {
    destroy() {
      console.log('[Twitter Mini] 销毁');
    }
  };
}
