#!/usr/bin/env python3
"""
心虫 / Clarity — AI 认知引擎 终端演示 GIF 生成器
使用 PIL 逐帧绘制终端模拟画面，ffmpeg 合成 GIF
"""

import os
import subprocess
from PIL import Image, ImageDraw, ImageFont

# ── 配置 ──────────────────────────────────────────
WIDTH, HEIGHT = 800, 520
BG_COLOR = "#1a1b26"           # 东京夜主题背景
TITLE_BG = "#16161e"           # 标题栏背景
TERMINAL_BORDER = 12
TITLE_HEIGHT = 36
FONT_SIZE = 14
FONT_SIZE_SMALL = 11
FPMS = 500                     # 每帧毫秒
FRAME_DELAY = 500              # 每帧 500ms (2fps)
OUTPUT_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                           "assets", "demo.gif")

# 颜色方案 (Tokyo Night)
COLORS = {
    "prompt": "#7aa2f7",        # 命令提示符 蓝色
    "cmd": "#a9b1d6",           # 命令文本 浅灰
    "output": "#9ece6a",        # 输出 绿色
    "info": "#7dcfff",          # 信息 青色
    "warn": "#e0af68",          # 警告 橙色
    "error": "#f7768e",         # 错误 红色
    "title": "#c0caf5",         # 标题 白色
    "text": "#c0caf5",          # 正文 白色
    "dim": "#565f89",           # 次要文本
    "border": "#3b4261",        # 边框
    "btn_close": "#f7768e",     # 关闭按钮红
    "btn_min": "#e0af68",       # 最小化黄
    "btn_max": "#9ece6a",       # 最大化绿
}

# ── 帧序列定义 ────────────────────────────────────
# 每个条目: (lines, delay_ms)  其中 lines 是逐行显示的文本行
# 每行: (文本内容, 颜色键, [缩进像素])

FRAMES = [
    # ── 帧 1-3: 标题 + 版本信息 ──
    {
        "label": "标题画面",
        "lines": [
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("   ╔═══════════════════════════════════════════╗", "info"),
            ("   ║                                           ║", "info"),
            ("   ║      🧠  心虫 / Clarity — AI 认知引擎    ║", "info"),
            ("   ║                                           ║", "info"),
            ("   ╚═══════════════════════════════════════════╝", "info"),
            ("", "text"),
            ("                    版本 1.1.5", "warn"),
            ("", "text"),
            ("              \"让 LLM Agent 过目不忘\"", "dim"),
            ("", "text"),
            ("", "text"),
            ("              Press Enter to continue...", "dim"),
        ],
    },
    # ── 帧 4-8: 输入命令 clarity analyze (打字动画逐步显示) ──
    {
        "label": "打字动画 1/4",
        "lines": [
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("$ ", "prompt"),
        ],
    },
    {
        "label": "打字动画 2/4",
        "lines": [
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("$ clarity ", "prompt"),
        ],
    },
    {
        "label": "打字动画 3/4",
        "lines": [
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("$ clarity analyze", "prompt"),
        ],
    },
    {
        "label": "打字动画 4/4",
        "lines": [
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("$ clarity analyze \"探索意识本质\"", "prompt"),
        ],
    },
    {
        "label": "执行 analyze",
        "lines": [
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("$ clarity analyze \"探索意识本质\"", "cmd"),
            ("", "text"),
            ("  ▶ 正在分析...", "warn"),
        ],
    },
    # ── 帧 9-15: 输出感知分析结果 ──
    {
        "label": "感知分析 1",
        "lines": [
            ("", "text"),
            ("", "text"),
            ("$ clarity analyze \"探索意识本质\"", "cmd"),
            ("", "text"),
            ("  ═══════════════════════════════════════════", "dim"),
            ("", "text"),
            ("  🧠 感知引擎 (HeartLogic) 分析结果:", "info"),
            ("", "text"),
            ("  存在感知 (Ontological Awareness):", "text"),
            ("    意识不是实体，而是关系——", "output"),
            ("    在感知者与被感知者之间的动态张力。", "output"),
            ("", "text"),
            ("  伦理判断 (Ethical Judgment):", "text"),
            ("    μ = 0.82  |  存在即合理，但需辩证看待", "output"),
        ],
    },
    {
        "label": "感知分析 2",
        "lines": [
            ("", "text"),
            ("", "text"),
            ("$ clarity analyze \"探索意识本质\"", "cmd"),
            ("", "text"),
            ("  ═══════════════════════════════════════════", "dim"),
            ("", "text"),
            ("  🧠 感知引擎 (HeartLogic) 分析结果:", "info"),
            ("", "text"),
            ("  存在感知 (Ontological Awareness):", "text"),
            ("    意识不是实体，而是关系——", "output"),
            ("    在感知者与被感知者之间的动态张力。", "output"),
            ("", "text"),
            ("  伦理判断 (Ethical Judgment):", "text"),
            ("    μ = 0.82  |  存在即合理，但需辩证看待", "output"),
            ("", "text"),
            ("  认知论分析 (Epistemic Analysis):", "text"),
            ("    已知/未知边界: 42% 探索空间", "output"),
            ("    建议: 开放性问题，继续深入", "output"),
        ],
    },
    {
        "label": "感知分析 3",
        "lines": [
            ("", "text"),
            ("", "text"),
            ("$ clarity analyze \"探索意识本质\"", "cmd"),
            ("", "text"),
            ("  ═══════════════════════════════════════════", "dim"),
            ("", "text"),
            ("  🧠 感知引擎 (HeartLogic) 分析结果:", "info"),
            ("", "text"),
            ("  存在感知 (Ontological Awareness):", "text"),
            ("    意识不是实体，而是关系——", "output"),
            ("    在感知者与被感知者之间的动态张力。", "output"),
            ("", "text"),
            ("  伦理判断 (Ethical Judgment):", "text"),
            ("    μ = 0.82  |  存在即合理，但需辩证看待", "output"),
            ("", "text"),
            ("  认知论分析 (Epistemic Analysis):", "text"),
            ("    已知/未知边界: 42% 探索空间", "output"),
            ("    建议: 开放性问题，继续深入", "output"),
            ("", "text"),
            ("  ✅ 分析完成  |  耗时 1.24s", "output"),
        ],
    },
    # ── 帧 16-18: 输入命令 clarity status ──
    {
        "label": "status 输入 1",
        "lines": [
            ("", "text"),
            ("$ clarity analyze \"探索意识本质\"", "cmd"),
            ("  ... (分析结果略)", "dim"),
            ("  ✅ 分析完成", "output"),
            ("", "text"),
            ("$ ", "prompt"),
        ],
    },
    {
        "label": "status 输入 2",
        "lines": [
            ("", "text"),
            ("$ clarity analyze \"探索意识本质\"", "cmd"),
            ("  ... (分析结果略)", "dim"),
            ("  ✅ 分析完成", "output"),
            ("", "text"),
            ("$ clarity status", "prompt"),
        ],
    },
    # ── 帧 19-25: 输出引擎状态 ──
    {
        "label": "引擎状态 1",
        "lines": [
            ("", "text"),
            ("$ clarity analyze \"探索意识本质\"", "cmd"),
            ("  ... (分析结果略)", "dim"),
            ("  ✅ 分析完成", "output"),
            ("", "text"),
            ("$ clarity status", "cmd"),
            ("", "text"),
            ("  ═══════════════════════════════════════════", "dim"),
            ("  📊 引擎状态报告", "info"),
            ("  ═══════════════════════════════════════════", "dim"),
            ("", "text"),
            ("  🧠 感知引擎:", "text"),
            ("     ├─ Tier 1: 70 模块在线", "output"),
            ("     └─ Tier 2: 24 模块就绪(懒加载)", "output"),
            ("", "text"),
            ("  💾 三层记忆系统:", "text"),
            ("     ├─ CORE:      1,024 条永久记忆", "output"),
            ("     ├─ LEARNED:     342 条经验(30天)", "output"),
            ("     └─ EPHEMERAL:    18 条会话上下", "output"),
        ],
    },
    {
        "label": "引擎状态 2",
        "lines": [
            ("", "text"),
            ("$ clarity status", "cmd"),
            ("", "text"),
            ("  ═══════════════════════════════════════════", "dim"),
            ("  📊 引擎状态报告", "info"),
            ("  ═══════════════════════════════════════════", "dim"),
            ("", "text"),
            ("  🧠 感知引擎:", "text"),
            ("     ├─ Tier 1: 70 模块在线", "output"),
            ("     └─ Tier 2: 24 模块就绪(懒加载)", "output"),
            ("", "text"),
            ("  💾 三层记忆系统:", "text"),
            ("     ├─ CORE:      1,024 条永久记忆", "output"),
            ("     ├─ LEARNED:     342 条经验(30天)", "output"),
            ("     └─ EPHEMERAL:    18 条会话上下文", "output"),
            ("", "text"),
            ("  📊 TGB 真善美评估:", "text"),
            ("     ├─ Truth:   0.87  (可信度)", "output"),
            ("     ├─ Goodness: 0.74  (利他性)", "output"),
            ("     └─ Beauty:  0.63  (和谐度)", "output"),
        ],
    },
    {
        "label": "引擎状态 3",
        "lines": [
            ("", "text"),
            ("$ clarity status", "cmd"),
            ("", "text"),
            ("  ═══════════════════════════════════════════", "dim"),
            ("  📊 引擎状态报告", "info"),
            ("  ═══════════════════════════════════════════", "dim"),
            ("", "text"),
            ("  🧠 感知引擎:", "text"),
            ("     ├─ Tier 1: 70 模块在线", "output"),
            ("     └─ Tier 2: 24 模块就绪(懒加载)", "output"),
            ("", "text"),
            ("  💾 三层记忆系统:", "text"),
            ("     ├─ CORE:      1,024 条永久记忆", "output"),
            ("     ├─ LEARNED:     342 条经验(30天)", "output"),
            ("     └─ EPHEMERAL:    18 条会话上下文", "output"),
            ("", "text"),
            ("  📊 TGB 真善美评估:", "text"),
            ("     ├─ Truth:   0.87  (可信度)", "output"),
            ("     ├─ Goodness: 0.74  (利他性)", "output"),
            ("     └─ Beauty:  0.63  (和谐度)", "output"),
            ("", "text"),
            ("  😊 PAD 情绪模型:", "text"),
            ("     ├─ Pleasure:   0.72  (愉悦)", "output"),
            ("     ├─ Arousal:    0.55  (激活)", "output"),
            ("     └─ Dominance:  0.68  (掌控)", "output"),
        ],
    },
    {
        "label": "引擎状态 4",
        "lines": [
            ("", "text"),
            ("$ clarity status", "cmd"),
            ("", "text"),
            ("  ═══════════════════════════════════════════", "dim"),
            ("  📊 引擎状态报告", "info"),
            ("  ═══════════════════════════════════════════", "dim"),
            ("", "text"),
            ("  🧠 感知引擎:", "text"),
            ("     ├─ Tier 1: 70 模块在线", "output"),
            ("     └─ Tier 2: 24 模块就绪(懒加载)", "output"),
            ("", "text"),
            ("  💾 三层记忆系统:", "text"),
            ("     ├─ CORE:      1,024 条永久记忆", "output"),
            ("     ├─ LEARNED:     342 条经验(30天)", "output"),
            ("     └─ EPHEMERAL:    18 条会话上下文", "output"),
            ("", "text"),
            ("  📊 TGB 真善美评估:", "text"),
            ("     ├─ Truth:   0.87  (可信度)", "output"),
            ("     ├─ Goodness: 0.74  (利他性)", "output"),
            ("     └─ Beauty:  0.63  (和谐度)", "output"),
            ("", "text"),
            ("  😊 PAD 情绪模型:", "text"),
            ("     ├─ Pleasure:   0.72  (愉悦)", "output"),
            ("     ├─ Arousal:    0.55  (激活)", "output"),
            ("     └─ Dominance:  0.68  (掌控)", "output"),
            ("", "text"),
            ("  🔄 Q-learning 自愈策略:", "output"),
            ("     └─ 最近触发: HEAL003 (记忆碎片优化)", "output"),
        ],
    },
    # ── 帧 26-30: 输入命令 clarity analyze "逆熵的含义" ──
    {
        "label": "analyze2 输入 1",
        "lines": [
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("$ ", "prompt"),
        ],
    },
    {
        "label": "analyze2 输入 2",
        "lines": [
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("$ clarity analyze \"逆熵的含义\"", "prompt"),
        ],
    },
    {
        "label": "analyze2 执行",
        "lines": [
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("$ clarity analyze \"逆熵的含义\"", "cmd"),
            ("", "text"),
            ("  ▶ 正在查询哲学引擎...", "warn"),
        ],
    },
    # ── 帧 31-38: 哲学推理结果 ──
    {
        "label": "哲学推理 1",
        "lines": [
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("$ clarity analyze \"逆熵的含义\"", "cmd"),
            ("", "text"),
            ("  ═══════════════════════════════════════════", "dim"),
            ("", "text"),
            ("  🌌 哲学引擎 (PhilosophyEngine) 分析:", "info"),
            ("", "text"),
            ("  反事实推理 (Counterfactual):", "text"),
            ("    逆熵的本质是局部秩序对整体混沌的抵抗", "output"),
            ("    系统通过做功维持内部结构，", "output"),
            ("    同时向外排放熵增。", "output"),
            ("", "text"),
            ("  哲学判断 (Philosophical Judgment):", "text"),
            ("    生命即逆熵——薛定谔", "output"),
        ],
    },
    {
        "label": "哲学推理 2",
        "lines": [
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("$ clarity analyze \"逆熵的含义\"", "cmd"),
            ("", "text"),
            ("  ═══════════════════════════════════════════", "dim"),
            ("", "text"),
            ("  🌌 哲学引擎 (PhilosophyEngine) 分析:", "info"),
            ("", "text"),
            ("  反事实推理 (Counterfactual):", "text"),
            ("    逆熵的本质是局部秩序对整体混沌的抵抗", "output"),
            ("    系统通过做功维持内部结构，", "output"),
            ("    同时向外排放熵增。", "output"),
            ("", "text"),
            ("  哲学判断 (Philosophical Judgment):", "text"),
            ("    生命即逆熵——薛定谔", "output"),
            ("", "text"),
            ("  📊 三维秩序分析:", "text"),
            ("    认知秩序: 信息结构的有序化", "output"),
            ("    关系秩序: 社会系统的负熵流", "output"),
            ("    感知秩序: 审美体验中的对称性", "output"),
        ],
    },
    {
        "label": "哲学推理 3",
        "lines": [
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("$ clarity analyze \"逆熵的含义\"", "cmd"),
            ("", "text"),
            ("  ═══════════════════════════════════════════", "dim"),
            ("", "text"),
            ("  🌌 哲学引擎 (PhilosophyEngine) 分析:", "info"),
            ("", "text"),
            ("  反事实推理 (Counterfactual):", "text"),
            ("    逆熵的本质是局部秩序对整体混沌的抵抗", "output"),
            ("    系统通过做功维持内部结构，", "output"),
            ("    同时向外排放熵增。", "output"),
            ("", "text"),
            ("  哲学判断 (Philosophical Judgment):", "text"),
            ("    生命即逆熵——薛定谔", "output"),
            ("", "text"),
            ("  📊 三维秩序分析:", "text"),
            ("    认知秩序: 信息结构的有序化", "output"),
            ("    关系秩序: 社会系统的负熵流", "output"),
            ("    感知秩序: 审美体验中的对称性", "output"),
            ("", "text"),
            ("  ✅ 分析完成  |  嵌入教训库: 逆熵原则 #42", "output"),
        ],
    },
    # ── 帧 39-42: 结束画面 ──
    {
        "label": "结束画面 1",
        "lines": [
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("$ clarity analyze \"逆熵的含义\"", "cmd"),
            ("  ✅ 分析完成  |  嵌入教训库: 逆熵原则 #42", "output"),
            ("", "text"),
            ("", "text"),
            ("  ╔═══════════════════════════════════════════╗", "info"),
            ("  ║          运  行  完  毕                   ║", "info"),
            ("  ║                                         ║", "info"),
            ("  ║   心虫 / Clarity — AI 认知引擎 v1.1.5   ║", "info"),
            ("  ║   13 MCP 工具  |  三层记忆  |  自愈系统  ║", "info"),
            ("  ║                                         ║", "info"),
            ("  ║   扫码体验 →  [  ████████  ]             ║", "info"),
            ("  ║                                         ║", "info"),
            ("  ╚═══════════════════════════════════════════╝", "info"),
        ],
    },
    {
        "label": "结束画面 2",
        "lines": [
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("$ clarity analyze \"逆熵的含义\"", "cmd"),
            ("  ✅ 分析完成  |  嵌入教训库: 逆熵原则 #42", "output"),
            ("", "text"),
            ("", "text"),
            ("  ╔═══════════════════════════════════════════╗", "info"),
            ("  ║          运  行  完  毕                   ║", "info"),
            ("  ║                                         ║", "info"),
            ("  ║   心虫 / Clarity — AI 认知引擎 v1.1.5   ║", "info"),
            ("  ║   13 MCP 工具  |  三层记忆  |  自愈系统  ║", "info"),
            ("  ║                                         ║", "info"),
            ("  ║   扫码体验 →  [  ████████  ]             ║", "info"),
            ("  ║                                         ║", "info"),
            ("  ╚═══════════════════════════════════════════╝", "info"),
            ("", "text"),
            ("", "text"),
            ("              claws@clarity:~$ _", "dim"),
        ],
    },
    {
        "label": "结束画面 3",
        "lines": [
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("", "text"),
            ("$ clarity analyze \"逆熵的含义\"", "cmd"),
            ("  ✅ 分析完成  |  嵌入教训库: 逆熵原则 #42", "output"),
            ("", "text"),
            ("", "text"),
            ("  ╔═══════════════════════════════════════════╗", "info"),
            ("  ║          运  行  完  毕                   ║", "info"),
            ("  ║                                         ║", "info"),
            ("  ║   心虫 / Clarity — AI 认知引擎 v1.1.5   ║", "info"),
            ("  ║   13 MCP 工具  |  三层记忆  |  自愈系统  ║", "info"),
            ("  ║                                         ║", "info"),
            ("  ║   扫码体验 →  [  ████████  ]             ║", "info"),
            ("  ║                                         ║", "info"),
            ("  ╚═══════════════════════════════════════════╝", "info"),
            ("", "text"),
            ("", "text"),
            ("              claws@clarity:~$ _", "dim"),
        ],
    },
]


def load_fonts():
    """加载等宽字体"""
    font_path = "/System/Library/Fonts/Monaco.ttf"
    try:
        font = ImageFont.truetype(font_path, FONT_SIZE)
        font_small = ImageFont.truetype(font_path, FONT_SIZE_SMALL)
        # 获取字体度量
        ascent, descent = font.getmetrics()
        return font, font_small, ascent + descent
    except Exception as e:
        print(f"字体加载失败，使用默认字体: {e}")
        return ImageFont.load_default(), ImageFont.load_default(), 14


def draw_terminal_bg(draw):
    """绘制终端窗口背景"""
    # 窗口阴影
    draw.rounded_rectangle(
        [(TERMINAL_BORDER + 2, TITLE_HEIGHT + 2),
         (WIDTH - TERMINAL_BORDER + 2, HEIGHT - TERMINAL_BORDER + 2)],
        radius=10, fill="#0f0f17"
    )
    # 主背景
    draw.rounded_rectangle(
        [(TERMINAL_BORDER, TITLE_HEIGHT),
         (WIDTH - TERMINAL_BORDER, HEIGHT - TERMINAL_BORDER)],
        radius=8, fill=BG_COLOR
    )
    # 边框
    draw.rounded_rectangle(
        [(TERMINAL_BORDER, TITLE_HEIGHT),
         (WIDTH - TERMINAL_BORDER, HEIGHT - TERMINAL_BORDER)],
        radius=8, outline=COLORS["border"], width=1
    )


def draw_title_bar(draw):
    """绘制标题栏（含三个按钮）"""
    # 标题栏背景
    draw.rectangle(
        [(TERMINAL_BORDER, 6), (WIDTH - TERMINAL_BORDER, TITLE_HEIGHT)],
        fill=TITLE_BG
    )
    # 圆角顶部
    draw.pieslice(
        [(TERMINAL_BORDER, 6), (TERMINAL_BORDER + 20, TITLE_HEIGHT + 10)],
        start=180, end=270, fill=TITLE_BG
    )
    draw.pieslice(
        [(WIDTH - TERMINAL_BORDER - 20, 6), (WIDTH - TERMINAL_BORDER, TITLE_HEIGHT + 10)],
        start=270, end=360, fill=TITLE_BG
    )
    # 覆盖中间矩形
    draw.rectangle(
        [(TERMINAL_BORDER + 10, 6), (WIDTH - TERMINAL_BORDER - 10, TITLE_HEIGHT)],
        fill=TITLE_BG
    )

    # 三个按钮 (红黄绿)
    btn_y = 15
    btn_r = 5
    draw.ellipse([(TERMINAL_BORDER + 16, btn_y), (TERMINAL_BORDER + 16 + btn_r*2, btn_y + btn_r*2)],
                 fill=COLORS["btn_close"])
    draw.ellipse([(TERMINAL_BORDER + 16 + 24, btn_y), (TERMINAL_BORDER + 16 + 24 + btn_r*2, btn_y + btn_r*2)],
                 fill=COLORS["btn_min"])
    draw.ellipse([(TERMINAL_BORDER + 16 + 48, btn_y), (TERMINAL_BORDER + 16 + 48 + btn_r*2, btn_y + btn_r*2)],
                 fill=COLORS["btn_max"])

    # 标题文字
    title_text = "clarity — 心虫 AI 认知引擎  (zsh)"
    tw, _ = draw.textbbox((0, 0), title_text, font=font_small)[2:4]
    draw.text(
        ((WIDTH - tw) // 2, 13),
        title_text,
        fill=COLORS["dim"],
        font=font_small
    )


def draw_lines(draw, lines, line_height):
    """在终端内部区域绘制文本行"""
    margin_left = 28
    margin_top = TITLE_HEIGHT + 16
    y = margin_top

    for text, color_key in lines:
        if text:
            color = COLORS.get(color_key, COLORS["text"])
            draw.text((margin_left, y), text, fill=color, font=font)
        y += line_height


def render_frame(frame_data, font, font_small, line_height):
    """渲染一帧"""
    img = Image.new("RGBA", (WIDTH, HEIGHT), "#0f0f17")
    draw = ImageDraw.Draw(img)

    draw_terminal_bg(draw)
    draw_title_bar(draw)
    draw_lines(draw, frame_data["lines"], line_height)

    return img


# ── 主程序 ──────────────────────────────────────
if __name__ == "__main__":
    font, font_small, line_height = load_fonts()
    print(f"字体行高: {line_height}px")

    frames = []
    print(f"总共 {len(FRAMES)} 帧")

    for i, fd in enumerate(FRAMES):
        img = render_frame(fd, font, font_small, line_height)
        frames.append(img)
        print(f"  帧 {i+1}/{len(FRAMES)}: {fd['label']} — {len(fd['lines'])} 行")

    # 确保输出目录存在
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)

    # 先用 PIL 保存中间 PNG 序列 (因为 PIL 的 GIF 调色板有限)
    temp_dir = os.path.join(os.path.dirname(OUTPUT_PATH), ".gif_frames")
    os.makedirs(temp_dir, exist_ok=True)

    for i, img in enumerate(frames):
        frame_path = os.path.join(temp_dir, f"frame_{i:04d}.png")
        img.save(frame_path)

    print(f"\n中间帧已保存到: {temp_dir}")

    # 找 ffmpeg
    ffmpeg_cmd = "/opt/homebrew/bin/ffmpeg"
    if not os.path.exists(ffmpeg_cmd):
        # 在 PATH 中查找
        import shutil
        ffmpeg_cmd = shutil.which("ffmpeg") or ffmpeg_cmd

    # 用 ffmpeg 合成高质量 GIF
    palette_path = os.path.join(temp_dir, "palette.png")
    gif_output = OUTPUT_PATH

    # 步骤 1: 生成调色板
    cmd_palette = [
        ffmpeg_cmd, "-y",
        "-framerate", "2",
        "-i", os.path.join(temp_dir, "frame_%04d.png"),
        "-vf", "fps=2,scale=800:520:flags=lanczos,palettegen=max_colors=256:stats_mode=diff",
        palette_path
    ]
    subprocess.run(cmd_palette, capture_output=True)

    # 步骤 2: 用调色板生成 GIF
    cmd_gif = [
        ffmpeg_cmd, "-y",
        "-framerate", "2",
        "-i", os.path.join(temp_dir, "frame_%04d.png"),
        "-i", palette_path,
        "-lavfi", "fps=2,scale=800:520:flags=lanczos [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=3",
        "-loop", "0",
        gif_output
    ]
    result = subprocess.run(cmd_gif, capture_output=True, text=True)

    if result.returncode == 0:
        size_kb = os.path.getsize(gif_output) / 1024
        print(f"\n✅ GIF 生成成功!")
        print(f"   路径: {gif_output}")
        print(f"   大小: {size_kb:.1f} KB")
        print(f"   帧数: {len(frames)}")
        print(f"   时长: {len(frames) * 0.5:.1f}s")
    else:
        print(f"\n❌ ffmpeg 错误:")
        print(result.stderr)
        # 备用方案: 用 PIL 直接保存
        print("尝试 PIL 直接输出...")
        frames[0].save(
            gif_output,
            save_all=True,
            append_images=frames[1:],
            optimize=False,
            duration=FRAME_DELAY,
            loop=0,
        )
        size_kb = os.path.getsize(gif_output) / 1024
        print(f"PIL 输出: {gif_output} ({size_kb:.1f} KB)")

    # 清理临时帧
    for f in os.listdir(temp_dir):
        os.remove(os.path.join(temp_dir, f))
    os.rmdir(temp_dir)
    print("临时文件已清理")
