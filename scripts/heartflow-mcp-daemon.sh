#!/bin/bash
# 心虫 MCP 守护进程 - 预启动常驻脚本
# 由 launchd 或 shell 保持活着，确保任何 Claude Code 实例都能复用

SCRIPT_DIR="/Users/apple/.claude/skills/claude-heartflow-skill"
PIDFILE="/tmp/heartflow-mcp.pid"
LOGFILE="/tmp/heartflow-mcp.log"

# 如果已有实例在运行，不做任何事
if [ -f "$PIDFILE" ]; then
    OLD_PID=$(cat "$PIDFILE")
    if kill -0 "$OLD_PID" 2>/dev/null; then
        exit 0
    fi
fi

echo $$ > "$PIDFILE"
exec node "$SCRIPT_DIR/src/mcp-server.js" >> "$LOGFILE" 2>&1
