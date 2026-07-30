# Twitter 插件 NPC 后端 API 规范

## 📡 NPC 发帖 API

### 接口说明

Twitter 插件的 NPC 系统会调用你的自定义后端 API 来生成推文内容。

### 配置方式

1. 打开 Twitter 插件
2. 进入 **设置 → NPC 系统 → 后端 API 地址**
3. 输入你的 API 地址（例如：`https://your-backend.com/api/npc/post`）

### 请求规范

**方法**: `POST`

**Headers**:
```
Content-Type: application/json
```

**Body**:
```json
{
  "npcId": "npc_1234567890_xxxxx",
  "persona": {
    "name": "张三",
    "bio": "程序员 | 咖啡爱好者",
    "personality": "外向开朗，喜欢分享",
    "occupation": "程序员",
    "interests": ["编程", "咖啡", "旅行"],
    "talkStyle": "轻松幽默，偶尔抖机灵"
  },
  "context": {
    "platform": "twitter",
    "previousPosts": [
      "今天写了一天代码，终于搞定了那个 bug",
      "周末去爬山了，风景真不错",
      "推荐一家新开的咖啡店..."
    ]
  }
}
```

### 响应规范

**成功响应** (200 OK):
```json
{
  "content": "今天终于把项目重构完了！代码简洁了好多，心情舒畅 😄"
}
```

**字段说明**:
- `content` (string, 必需): 生成的推文内容（建议 50 字以内）

**错误响应**:
```json
{
  "error": "错误信息"
}
```

### 请求参数详解

#### `npcId`
- 类型: `string`
- 说明: NPC 的唯一标识符
- 格式: `npc_{timestamp}_{random}`

#### `persona`
- 类型: `object`
- 说明: NPC 的人设信息

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | string | NPC 名字 |
| `bio` | string | 个人简介 |
| `personality` | string | 性格描述 |
| `occupation` | string | 职业 |
| `interests` | string[] | 兴趣爱好列表 |
| `talkStyle` | string | 说话风格 |

#### `context`
- 类型: `object`
- 说明: 上下文信息

| 字段 | 类型 | 说明 |
|------|------|------|
| `platform` | string | 固定值 "twitter" |
| `previousPosts` | string[] | 该 NPC 最近 5 条推文内容 |

### 后端实现示例

#### Node.js + Express

```javascript
const express = require('express');
const app = express();

app.use(express.json());

app.post('/api/npc/post', async (req, res) => {
  try {
    const { npcId, persona, context } = req.body;

    // 这里调用你的 AI 模型生成推文
    // 例如：OpenAI、Claude、本地模型等
    const content = await generateTweet(persona, context);

    res.json({ content });
  } catch (error) {
    console.error('生成推文失败:', error);
    res.status(500).json({ error: error.message });
  }
});

async function generateTweet(persona, context) {
  // 示例：使用 OpenAI API
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: `你是 ${persona.name}，${persona.bio}
性格：${persona.personality}
职业：${persona.occupation}
兴趣：${persona.interests.join('、')}
说话风格：${persona.talkStyle}

请生成一条符合你人设的推文（50字以内）。`
      },
      {
        role: "user",
        content: "发一条推文"
      }
    ]
  });

  return response.choices[0].message.content;
}

app.listen(3000, () => {
  console.log('NPC 后端 API 运行在 http://localhost:3000');
});
```

#### Python + Flask

```python
from flask import Flask, request, jsonify
import openai

app = Flask(__name__)

@app.route('/api/npc/post', methods=['POST'])
def npc_post():
    try:
        data = request.json
        npc_id = data['npcId']
        persona = data['persona']
        context = data['context']

        # 调用 AI 生成推文
        content = generate_tweet(persona, context)

        return jsonify({'content': content})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def generate_tweet(persona, context):
    prompt = f"""你是 {persona['name']}，{persona['bio']}
性格：{persona['personality']}
职业：{persona['occupation']}
兴趣：{'、'.join(persona['interests'])}
说话风格：{persona['talkStyle']}

请生成一条符合你人设的推文（50字以内）。"""

    response = openai.ChatCompletion.create(
        model="gpt-4",
        messages=[
            {"role": "system", "content": prompt},
            {"role": "user", "content": "发一条推文"}
        ]
    )

    return response.choices[0].message.content

if __name__ == '__main__':
    app.run(port=3000)
```

### 测试方法

1. **在设置中配置 API 地址**
2. **打开浏览器控制台** (F12)
3. **进入 NPC 管理** (设置 → NPC 系统 → 管理 NPC)
4. **点击测试发帖**
5. **查看控制台日志**：
   ```
   [NPC] ✅ 使用自定义后端 API 发帖
   [NPC] API 地址: https://your-backend.com/api/npc/post
   [NPC] 发送参数: {...}
   [NPC] 后端响应状态: 200
   [NPC] 后端响应数据: {content: "..."}
   [NPC] ✅ 使用后端 API 发帖成功
   ```

### 注意事项

1. **CORS 配置**：确保后端允许跨域请求
   ```javascript
   app.use(cors({
     origin: '*', // 或者指定 Roche 的域名
     methods: ['POST']
   }));
   ```

2. **响应时间**：建议在 10 秒内返回，避免超时

3. **内容长度**：推荐生成 50 字以内的推文

4. **错误处理**：返回清晰的错误信息便于调试

5. **安全性**：
   - 添加身份验证（API Key、JWT 等）
   - 限制请求频率
   - 验证请求来源

### 完整流程图

```
Twitter 插件               你的后端                AI 模型
    |                        |                      |
    |-- POST /api/npc/post ->|                      |
    |   {npcId, persona}      |                      |
    |                        |-- 调用 AI 生成 -->   |
    |                        |                      |
    |                        |<-- 返回推文内容 --   |
    |<-- {content} ----------|                      |
    |                        |                      |
    |-- 发布推文 ----------->|                      |
    |-- 发送通知 ----------->|                      |
```

### 相关链接

- **插件仓库**: https://github.com/zxinyi404-maker/-roche-twitter
- **版本**: v4.4.0
- **安装链接**: https://raw.githubusercontent.com/zxinyi404-maker/-roche-twitter/main/manifest.json?v=20260731640000
