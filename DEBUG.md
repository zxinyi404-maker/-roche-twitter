# Twitter 插件调试指南

## 步骤 1：检查插件是否安装成功

1. 打开 Roche 插件管理页面
2. 在已安装插件列表中找 "Twitter"
3. 检查：
   - ✅ 是否显示 v1.1.1？
   - ✅ 状态是"已启用"还是"错误"？
   - ✅ 有没有红色错误提示？

**截图发给我**

---

## 步骤 2：打开浏览器控制台

1. 按 **F12** 打开开发者工具
2. 切换到 **Console** 标签
3. 刷新页面
4. 查看有没有**红色错误信息**

常见错误：
- `Plugin mount failed: ...`
- `Uncaught Error: ...`
- `SyntaxError: ...`
- `TypeError: ...`

**把所有红色错误信息复制发给我**

---

## 步骤 3：检查网络请求

1. 在开发者工具切换到 **Network** 标签
2. 刷新页面
3. 搜索 `plugin.js`
4. 点击 `plugin.js` 请求，查看：
   - Status Code: 是 200 还是 404/500？
   - Preview: 能看到代码内容吗？
   - 代码第一行是什么？（应该是 `/**` 开头）

**截图发给我**

---

## 步骤 4：手动测试插件代码

在控制台执行：

```javascript
// 测试 RochePlugin 是否存在
console.log(window.RochePlugin);

// 测试 character API
if (window.roche) {
  roche.character.list().then(chars => {
    console.log('Characters:', chars);
  });
}
```

**把输出结果发给我**

---

## 步骤 5：检查 manifest.json

访问这个链接，看看能否打开：
```
https://raw.githubusercontent.com/zxinyi404-maker/-roche-twitter/main/manifest.json
```

检查：
- version 是 1.1.1 吗？
- entry URL 完整吗？
- 有没有语法错误？

**截图发给我**

---

## 步骤 6：检查 plugin.js

访问这个链接：
```
https://raw.githubusercontent.com/zxinyi404-maker/-roche-twitter/main/plugin.js
```

检查：
- 第 62 行：version 是 '1.1.1' 吗？
- 能看到完整代码吗？
- 搜索 `roche.persona.get`，应该找不到

**截图发给我**

---

完成以上步骤后，把所有结果告诉我，我来帮你定位问题！
