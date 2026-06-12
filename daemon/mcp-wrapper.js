#!/usr/bin/env node
/**
 * HeartFlow MCP Wrapper — 守护进程自动启动 + 双向代理
 *
 * 改进（一次api，1秒启动）：
 *   1. 先尝试连接已有守护进程（＜1ms，零开销）
 *   2. 未运行时自动后台启动守护进程（~2s）
 *   3. 双向代理 stdio ↔ daemon socket
 *
 * 效果：MCP 工具始终可用，无需手动"启动心虫"。
 */

const net = require('net');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const SOCKET_PATH = '/tmp/heartflow-mcp.sock';
const PID_FILE = '/tmp/heartflow-mcp.pid';
const DAEMON_JS = path.resolve(__dirname, 'mcp-daemon.js');

// ─── 连接已有守护进程 ─────────────────────────────────
function tryConnect() {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(SOCKET_PATH)) return reject(new Error('socket 不存在'));
    const socket = net.connect(SOCKET_PATH, () => resolve(socket));
    socket.on('error', reject);
    socket.setTimeout(1000, () => reject(new Error('连接超时')));
  });
}

// ─── 等 socket 文件出现 ───────────────────────────────
function waitForSocket(timeout = 5000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const poll = () => {
      if (fs.existsSync(SOCKET_PATH)) {
        // 给 daemon 一小会儿进入 listen
        setTimeout(resolve, 50);
        return;
      }
      if (Date.now() - start > timeout) {
        return reject(new Error('守护进程启动超时'));
      }
      setTimeout(poll, 100);
    };
    poll();
  });
}

// ─── 后台启动守护进程 ─────────────────────────────────
function startDaemon() {
  return new Promise((resolve, reject) => {
    console.error('[HeartFlow] 心虫守护进程未运行，正在后台启动...');

    const child = spawn(process.execPath, [DAEMON_JS], {
      detached: true,    // 脱离父进程组，生存到 session 之外
      stdio: 'ignore',   // 不继承 stdio，后台静默运行
    });
    child.unref();       // 主进程可独立退出

    waitForSocket().then(resolve).catch((err) => {
      // 启动失败：尝试 kill 可能残留的进程
      try { process.kill(child.pid); } catch { /* 忽略 */ }
      reject(err);
    });
  });
}

// ─── 建立双向代理 ─────────────────────────────────────
function proxy(daemon) {
  process.stdin.on('data', (chunk) => daemon.write(chunk));
  process.stdin.on('end', () => daemon.end());

  daemon.on('data', (chunk) => process.stdout.write(chunk));
  daemon.on('end', () => process.exit(0));
  daemon.on('error', (err) => {
    console.error(`[HeartFlow] daemon 错误: ${err.message}`);
    process.exit(1);
  });

  process.on('SIGINT',  () => { daemon.end(); process.exit(0); });
  process.on('SIGTERM', () => { daemon.end(); process.exit(0); });
}

// ─── 主流程：先连，连不上就启动再连 ────────────────────
async function main() {
  // 第 1 步：尝试直连（守护进程已在运行，＜1ms）
  try {
    const socket = await tryConnect();
    console.error('[HeartFlow] 已连到已有守护进程');
    proxy(socket);
    return;
  } catch (e) {
    // 守护进程未运行，正常 fallthrough 到第 2 步
  }

  // 第 2 步：清理残留 pid/socket（如果有）
  try { fs.unlinkSync(PID_FILE); } catch { /* 忽略 */ }
  try { fs.unlinkSync(SOCKET_PATH); } catch { /* 忽略 */ }

  // 第 3 步：后台启动守护进程，等待就绪
  await startDaemon();

  // 第 4 步：连接
  const socket = await tryConnect();
  console.error('[HeartFlow] 心虫守护进程已就绪');
  proxy(socket);
}

main().catch((err) => {
  console.error(`[HeartFlow] 启动失败: ${err.message}`);
  process.exit(1);
});
