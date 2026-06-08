# HeartFlow / 心虫

AI 认知与自愈引擎。一个会思考自己怎么活的 AI。

## ⚠️ 安全安装声明（clawhub.ai 版本）

本版本已移除所有可能的安全风险组件，**专为安全发布裁剪**：

- ✅ **无后台进程** — 不安装 cron、launchd、systemd 或任何定时任务
- ✅ **无自升级** — 不会自动拉取、修改代码或执行 git push
- ✅ **无网络服务** — 不启动 HTTP/API 服务器，不监听端口
- ✅ **无凭据存储** — 不读写 API 密钥、token 或密码文件
- ✅ **无外部通信** — 仅在用户明确发起请求时调用外部服务
- ✅ **无埋点/遥测** — 不含任何分析、追踪或统计功能
- ✅ **纯认知引擎** — 纯粹的思维/记忆/情感模块，无 side-effect

> **安装即安全**。本仓库不包含任何可以修改自身、连接外部或储存密钥的代码。

## 快速集成

```bash
# 克隆
git clone https://github.com/yun520-1/claude-heartflow-skill.git
cd claude-heartflow-skill

# 零 npm 依赖，直接使用
node -e "const { HeartFlow } = require('./src/core/heartflow.js'); const hf = new HeartFlow(); hf.start(); console.log('心虫已启动');"
```

## 在 Claude Code / OpenClaw 中使用

1. 将本仓库添加到项目的 `.claude` 或 `AGENTS.md` 中
2. 在对话中加载心虫：`require('./src/core/heartflow.js')`
3. 核心 API：
   - `hf.think(input)` — 完整思维链
   - `hf.thinkFast(input)` — 快速推理
   - `hf.dreamNow()` — 梦境生成
   - `hf.dispatch('memory.search', query)` — 记忆检索

## 设计原则

- 零 npm 第三方依赖
- CommonJS 模块系统
- Node.js 14+ 兼容
- 跨平台（macOS / Linux / Windows）
