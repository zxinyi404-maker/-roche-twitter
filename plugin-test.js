/**
 * Roche Twitter - 测试版本
 * 验证插件结构是否正确
 */

async function init(roche, container) {
  console.log('[Twitter Test] 插件初始化开始');
  console.log('[Twitter Test] Roche 对象:', roche);
  console.log('[Twitter Test] 容器:', container);

  // 简单的 UI
  container.innerHTML = `
    <div style="padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <h1 style="font-size: 24px; font-weight: 700; margin-bottom: 16px;">
        𝕏 Twitter 测试版
      </h1>
      <p style="color: #536471; margin-bottom: 16px;">
        版本：v2.0.0-test
      </p>
      <p style="color: #536471; margin-bottom: 16px;">
        如果你能看到这个页面，说明插件结构正确！
      </p>
      <button id="test-btn" style="
        background: #1d9bf0;
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 24px;
        font-weight: 700;
        cursor: pointer;
        font-size: 15px;
      ">
        测试按钮
      </button>
      <div id="test-result" style="margin-top: 16px; color: #0f1419;"></div>
    </div>
  `;

  // 绑定测试按钮
  const testBtn = container.querySelector('#test-btn');
  const testResult = container.querySelector('#test-result');

  testBtn.addEventListener('click', async () => {
    testResult.textContent = '测试中...';

    try {
      // 测试 Roche API
      const tests = [];

      // 测试 storage
      if (roche.storage) {
        await roche.storage.set('twitter_test', 'test_value');
        const value = await roche.storage.get('twitter_test');
        tests.push(`✅ Storage: ${value === 'test_value' ? '正常' : '异常'}`);
      } else {
        tests.push('❌ Storage: 不可用');
      }

      // 测试 persona
      if (roche.persona) {
        const activePersona = await roche.persona.getActiveUserPersona();
        tests.push(`✅ Persona: ${activePersona ? activePersona.name : '未找到'}`);
      } else {
        tests.push('❌ Persona: 不可用');
      }

      // 测试 ai
      if (roche.ai && roche.ai.chat) {
        tests.push('✅ AI: 可用');
      } else {
        tests.push('❌ AI: 不可用');
      }

      // 测试 memory
      if (roche.memory) {
        tests.push('✅ Memory: 可用');
      } else {
        tests.push('❌ Memory: 不可用');
      }

      testResult.innerHTML = tests.join('<br>');
    } catch (error) {
      testResult.textContent = `错误：${error.message}`;
      console.error('[Twitter Test] 测试失败:', error);
    }
  });

  console.log('[Twitter Test] 插件初始化完成');

  // 返回生命周期方法
  return {
    destroy() {
      console.log('[Twitter Test] 插件销毁');
    }
  };
}
