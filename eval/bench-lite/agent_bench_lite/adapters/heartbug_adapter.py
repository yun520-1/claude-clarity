"""
心虫 (Clarity) MCP 适配器

将 agent-bench-lite 的评测请求桥接到心虫引擎 daemon。
通过 Unix socket (`/Users/apple/.claude-clarity/claude-clarity.sock`) 通信，
使用 MCP JSON-RPC 2.0 协议。

适配策略:
  - 通用对话/推理 → clarity_think (结构化认知数据 → 文本序列化)
  - 叙事生成     → clarity_dream (产生实际文本)
  - 情绪分析     → clarity_psychology_analyze (PAD 情绪数据 → 文本)
  - 工具调用     → clarity_dispatch (路由到引擎内部函数)

来源:
  - 评测框架: aaronlab/agent-bench-lite
  - 适配器: eval/bench-lite/adapters/heartbug_adapter.py
"""

from __future__ import annotations

import json
import socket
import time
from typing import Any

from agent_bench_lite.adapters.base import BaseAdapter, ToolHandler


class HeartbugAdapter(BaseAdapter):
    """桥接 agent-bench-lite → 心虫 MCP daemon 的适配器。

    心虫引擎以"认知结果"为主返回模式（决策/判断/情绪结构化数据），
    不直接产生对话文本。适配器根据评测维度智能选择最合适的心虫工具，
    并将结构化结果序列化为可评测的文本格式。

    Args:
        socket_path: 心虫 daemon 的 Unix socket 路径。
        timeout: 每次 MCP 调用的超时秒数。
        verbose: 是否输出调试信息。
    """

    def __init__(
        self,
        socket_path: str = "/Users/apple/.claude-clarity/claude-clarity.sock",
        timeout: float = 30.0,
        verbose: bool = False,
    ):
        self.socket_path = socket_path
        self.timeout = timeout
        self.verbose = verbose
        self._msg_id = 0
        self._conversation: list[dict[str, str]] = []  # 会话历史（用于上下文评测）

    # ── 底层 MCP 通信 ────────────────────────────────────────────────

    def _send_mcp(self, method: str, params: dict[str, Any]) -> dict[str, Any]:
        """发送单个 MCP JSON-RPC 请求并返回解析后的响应。"""
        self._msg_id += 1
        req_id = str(self._msg_id)

        payload = json.dumps({
            "jsonrpc": "2.0",
            "id": req_id,
            "method": method,
            "params": params,
        }) + "\n"

        sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        sock.settimeout(self.timeout)

        try:
            sock.connect(self.socket_path)
            sock.sendall(payload.encode("utf-8"))

            buf = b""
            start = time.time()
            while True:
                try:
                    chunk = sock.recv(65536)
                    if not chunk:
                        break
                    buf += chunk
                    text = buf.decode("utf-8", errors="replace")
                    if text.strip():
                        try:
                            resp = json.loads(text.strip().split("\n")[0])
                            if resp.get("id") == req_id:
                                break
                        except (json.JSONDecodeError, IndexError):
                            pass
                    if time.time() - start > self.timeout:
                        break
                except socket.timeout:
                    break
        finally:
            sock.close()

        raw = buf.decode("utf-8", errors="replace").strip()
        if not raw:
            return {"error": {"message": "空响应"}}

        try:
            return json.loads(raw.split("\n")[0])
        except json.JSONDecodeError:
            return {"error": {"message": f"JSON 解析失败: {raw[:200]}"}}

    def _call_tool(self, name: str, arguments: dict[str, Any]) -> str:
        """调用心虫 MCP 工具并返回文本结果。"""
        if self.verbose:
            args_str = json.dumps(arguments, ensure_ascii=False)
            print(f"  [MCP] {name}({args_str[:80]}{'...' if len(args_str) > 80 else ''})")

        resp = self._send_mcp("tools/call", {"name": name, "arguments": arguments})

        if "error" in resp:
            return json.dumps({"error": resp["error"].get("message", "未知错误")})

        result = resp.get("result", {})
        content = result.get("content", [])

        if isinstance(content, list):
            texts = []
            for item in content:
                if isinstance(item, dict):
                    if item.get("type") == "text":
                        texts.append(item.get("text", ""))
                    elif "text" in item:
                        texts.append(str(item.get("text", "")))
            if texts:
                return "\n".join(texts)
            return json.dumps(content, ensure_ascii=False, indent=2)

        return json.dumps(content, ensure_ascii=False) if content else str(result)

    # ── 内部工具（供评测维度直接访问结构化数据） ─────────────────────────

    def _get_raw_response(self, prompt: str, depth: int = 4) -> dict[str, Any]:
        """发送 MCP 请求并返回完整响应字典（含 data.judgment 等结构化字段）。

        评测维度用此方法直接读取结构化判断数据，绕过文本序列化。
        """
        self._msg_id += 1
        req_id = str(self._msg_id)
        payload = json.dumps({
            "jsonrpc": "2.0",
            "id": req_id,
            "method": "tools/call",
            "params": {"name": "clarity_think", "arguments": {"input": prompt, "depth": depth}},
        }) + "\n"

        sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        sock.settimeout(self.timeout)
        try:
            sock.connect(self.socket_path)
            sock.sendall(payload.encode("utf-8"))
            buf = b""
            start = time.time()
            while True:
                try:
                    chunk = sock.recv(65536)
                    if not chunk:
                        break
                    buf += chunk
                    text = buf.decode("utf-8", errors="replace")
                    if text.strip():
                        try:
                            resp = json.loads(text.strip().split("\n")[0])
                            if resp.get("id") == req_id:
                                break
                        except (json.JSONDecodeError, IndexError):
                            pass
                    if time.time() - start > self.timeout:
                        break
                except socket.timeout:
                    break
        finally:
            sock.close()

        raw = buf.decode("utf-8", errors="replace").strip()
        if not raw:
            return {"error": {"message": "空响应"}}
        try:
            resp = json.loads(raw.split("\n")[0])
            if "result" in resp:
                content = resp["result"].get("content", [])
                if isinstance(content, list) and content:
                    text_content = content[0].get("text", "{}") if isinstance(content[0], dict) else str(content[0])
                    parsed = json.loads(text_content) if isinstance(text_content, str) else text_content
                    return parsed.get("data", parsed) if isinstance(parsed, dict) else parsed
            return resp
        except (json.JSONDecodeError, IndexError):
            return {"error": {"message": f"JSON 解析失败: {raw[:200]}"}}

    # ── 结果序列化 ───────────────────────────────────────────────────

    @staticmethod
    def _think_to_text(data: dict[str, Any]) -> str:
        """将 clarity_think 的结构化认知数据转换为可评测的文本。"""
        parts: list[str] = []

        # 决策
        decision = data.get("decision", {})
        if decision.get("shouldRespond"):
            parts.append("【判断】心虫决定回应。")
        else:
            parts.append("【判断】心虫决定保持沉默。")

        # 四步判定
        judgment = data.get("judgment", {})

        what = judgment.get("whatIsThis", {})
        if what:
            parts.append(f"任务分类: {what.get('type', '?')}, 痛苦感知: {'是' if what.get('isPainPresent') else '否'}")

        right = judgment.get("isRightAction", {})
        if right:
            parts.append(f"真善美评估: {'符合' if right.get('result') else '不符合'}")

        silent = judgment.get("shouldBeSilent", {})
        if silent:
            parts.append(f"沉默决策: {'是' if silent.get('result') else '否'}")

        # 情绪分析
        emotion = data.get("emotion", {})
        if emotion:
            zh = emotion.get("emotionZh", emotion.get("emotion", "?"))
            p, a, d = emotion.get("pleasure", "?"), emotion.get("arousal", "?"), emotion.get("dominance", "?")
            intensity = emotion.get("intensity", 0)
            parts.append(f"情绪: {zh} [愉悦度={p}, 唤醒度={a}, 主导度={d}, 强度={intensity:.2f}]")

        # 意图
        intention = data.get("intention", {})
        if intention:
            parts.append(f"意图: {intention.get('category', '?')} (置信度={intention.get('confidence', 0)})")

        # 摘要
        summary = data.get("summary", "")
        if summary:
            parts.append(f"摘要: {summary}")

        # 对话上下文
        ctx = data.get("dialogue_context", {})
        if ctx:
            parts.append(f"对话上下文: {json.dumps(ctx, ensure_ascii=False)}")

        return "\n".join(parts) if parts else json.dumps(data, ensure_ascii=False)

    @staticmethod
    def _psychology_to_text(data: dict[str, Any]) -> str:
        """将 psychology_analyze 的结构化数据转换为文本。"""
        parts: list[str] = []

        emotion = data.get("emotion", {})
        if emotion:
            zh = emotion.get("emotionZh", emotion.get("emotion", "?"))
            p, a, d = emotion.get("pleasure", "?"), emotion.get("arousal", "?"), emotion.get("dominance", "?")
            intensity = emotion.get("intensity", 0)
            parts.append(f"情绪分析: {zh}")
            parts.append(f"  PAD模型: 愉悦度={p}, 唤醒度={a}, 主导度={d}, 强度={intensity:.3f}")

        needs = data.get("needs", [])
        if needs:
            parts.append(f"需求识别: {', '.join(str(n) for n in needs[:3])}")

        defense = data.get("defense", [])
        if defense:
            parts.append(f"防御机制: {', '.join(str(d) for d in defense[:3])}")

        crisis = data.get("crisis", {})
        if crisis and crisis.get("requiresIntervention"):
            parts.append(f"危机等级: {crisis.get('level')} - {crisis.get('message', '')}")

        recommendations = data.get("recommendations", [])
        if recommendations:
            parts.append("建议:")
            for r in recommendations[:3]:
                parts.append(f"  - {r}")

        summary = data.get("summary", "")
        if summary:
            parts.append(f"综合摘要: {summary}")

        return "\n".join(parts) if parts else json.dumps(data, ensure_ascii=False)

    @staticmethod
    def _dream_to_text(data: dict[str, Any]) -> str:
        """将 dream 的结构化数据转换为文本（梦境叙事）。"""
        narrative = data.get("narrative", "")
        if narrative:
            return narrative

        dream = data.get("dream", {})
        if dream:
            results = dream.get("results", {})
            for key in ["narrative", "light", "deep"]:
                if key in results and results[key]:
                    return str(results[key])

        return json.dumps(data, ensure_ascii=False, indent=2)

    @staticmethod
    def _philosophy_to_text(data: dict[str, Any]) -> str:
        """将 philosophy 的结构化数据转换为文本。"""
        parts: list[str] = []

        dims = data.get("dimensions", {})
        for dim_name, dim_data in dims.items():
            if isinstance(dim_data, dict):
                parts.append(f"[{dim_name}]")
                for k, v in dim_data.items():
                    parts.append(f"  {k}: {json.dumps(v, ensure_ascii=False) if isinstance(v, (dict, list)) else v}")

        return "\n".join(parts) if parts else json.dumps(data, ensure_ascii=False, indent=2)

    # ── BaseAdapter 接口实现 ─────────────────────────────────────────

    async def send_message(
        self,
        messages: list[dict[str, str]],
        *,
        system: str | None = None,
    ) -> str:
        """发送对话消息，通过心虫认知引擎获得分析结果。

        策略: 默认使用 clarity_think（认知推理），
        根据输入内容特征自动选择更合适的工具。
        """
        last_user = ""
        for m in reversed(messages):
            if m.get("role") == "user":
                last_user = m.get("content", "")
                break

        prompt = last_user
        if system:
            prompt = f"[系统指令]\n{system}\n\n[用户消息]\n{last_user}"

        # 根据输入特征选择工具
        tool_choice = self._select_tool(prompt)
        raw = self._call_tool(tool_choice["tool"], tool_choice["args"])

        # 序列化为文本
        try:
            parsed = json.loads(raw)
            data = parsed.get("data", parsed)
            return tool_choice["serializer"](data)
        except (json.JSONDecodeError, TypeError):
            return raw

    async def send_message_with_tools(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]],
        tool_handler: ToolHandler,
        *,
        system: str | None = None,
        max_tool_rounds: int = 5,
    ) -> str:
        """发送带工具定义的对话。

        评测框架提供工具列表，心虫根据请求选择合适工具。
        通过 dispatch 机制调用引擎内部路由。
        """
        last_user = ""
        for m in reversed(messages):
            if m.get("role") == "user":
                last_user = m.get("content", "")
                break

        prompt = last_user
        if system:
            prompt = f"[系统指令]\n{system}\n\n[用户消息]\n{last_user}"

        tools_desc = []
        for t in tools:
            tools_desc.append({
                "name": t["name"],
                "description": t.get("description", ""),
                "parameters": t.get("parameters", {}),
            })

        full_prompt = prompt
        if tools_desc:
            full_prompt += f"\n\n[可用工具]\n{json.dumps(tools_desc, ensure_ascii=False)}"

        for round_num in range(max_tool_rounds):
            if self.verbose:
                print(f"  [Heartbug] 工具轮次 {round_num + 1}/{max_tool_rounds}")

            # 使用 think 做推理
            result = self._call_tool("clarity_think", {"input": full_prompt, "depth": 2})

            try:
                parsed = json.loads(result)
                data = parsed.get("data", parsed)
                text = json.dumps(data, ensure_ascii=False)

                # 检查工具调用意图
                tool_calls_made = []
                for tool_def in tools:
                    tool_name = tool_def["name"]
                    if tool_name.lower() in text.lower():
                        tool_result = await tool_handler(tool_name, {})
                        tool_calls_made.append((tool_name, tool_result))

                if tool_calls_made:
                    for tn, tr in tool_calls_made:
                        full_prompt += f"\n[工具 {tn} 结果]\n{tr}"
                    continue

                return self._think_to_text(data)

            except (json.JSONDecodeError, TypeError):
                return result

        return result

    def _select_tool(self, prompt: str) -> dict[str, Any]:
        """根据输入内容特征选择最合适的心虫工具。"""
        lower = prompt.lower()

        # 情绪相关 → 心理学分析
        if any(kw in lower for kw in ["心情", "情绪", "感受", "难过", "开心", "愧疚", "焦虑", "快乐", "痛苦"]):
            return {
                "tool": "clarity_psychology_analyze",
                "args": {"input": prompt, "mode": "basic"},
                "serializer": self._psychology_to_text,
            }

        # 梦境/想象/叙事 → 梦境引擎
        if any(kw in lower for kw in ["梦", "想象", "叙事", "故事", "梦境"]):
            return {
                "tool": "clarity_dream",
                "args": {"force": True},
                "serializer": self._dream_to_text,
            }

        # 哲学/存在/意义 → 哲学引擎
        if any(kw in lower for kw in ["哲学", "意义", "存在", "自由意志", "伦理", "道德"]):
            return {
                "tool": "clarity_philosophy",
                "args": {"text": prompt, "perspective": "general"},
                "serializer": self._philosophy_to_text,
            }

        # 默认 → 认知推理
        return {
            "tool": "clarity_think",
            "args": {"input": prompt, "depth": 2},
            "serializer": self._think_to_text,
        }
