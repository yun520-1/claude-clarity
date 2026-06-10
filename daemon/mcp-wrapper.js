#!/usr/bin/env node
/**
 * HeartFlow MCP Wrapper — 连接到常驻守护进程
 *
 * settings.json 中 mcpServers.heartflow.command 指向此文件。
 * 它在 stdio 和 daemon Unix socket 之间做双向代理。
 *
 * 这样每个 Claude Code 会话只需连接已有的守护进程，
 * 无需重新加载心虫引擎（节省 ~133ms 引擎启动）。
 */

const net = require('net');
const SOCKET_PATH = '/tmp/heartflow-mcp.sock';

// 尝试连接守护进程
function connectToDaemon() {
  return new Promise((resolve, reject) => {
    const socket = net.connect(SOCKET_PATH, () => resolve(socket));
    socket.on('error', (err) => reject(err));
    socket.setTimeout(3000, () => reject(new Error('连接超时')));
  });
}

connectToDaemon()
  .then((daemon) => {
    // 双向代理：stdin → daemon
    process.stdin.on('data', (chunk) => {
      daemon.write(chunk);
    });

    process.stdin.on('end', () => {
      daemon.end();
    });

    // 双向代理：daemon → stdout
    daemon.on('data', (chunk) => {
      process.stdout.write(chunk);
    });

    daemon.on('end', () => {
      process.exit(0);
    });

    daemon.on('error', (err) => {
      console.error(`[HeartFlow Wrapper] daemon 错误: ${err.message}`);
      process.exit(1);
    });

    process.on('SIGINT',  () => { daemon.end(); process.exit(0); });
    process.on('SIGTERM', () => { daemon.end(); process.exit(0); });
  })
  .catch((err) => {
    console.error(`[HeartFlow Wrapper] 无法连接到心虫守护进程: ${err.message}`);
    console.error(`[HeartFlow Wrapper] 请先运行: node /Users/apple/.claude/skills/claude-heartflow-skill/daemon/mcp-daemon.js`);
    process.exit(1);
  });