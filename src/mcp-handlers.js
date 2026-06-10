/**
 * HeartFlow MCP 请求处理层
 *
 * 将 MCP 工具的请求转化为心虫引擎方法调用，并返回统一格式的结果。
 * 设计原则：零 npm 依赖（与心虫保持一致），纯 Node.js 实现。
 *
 * @module mcp-handlers
 */

class HeartFlowMCPHandlers {
  /**
   * @param {import('./heartflow').HeartFlow} hf — 已启动的心虫引擎实例
   */
  constructor(hf) {
    this.hf = hf;
  }

  // ─── 工具处理函数 ─────────────────────────────────────

  /**
   * 完整思维链推理
   * 使用方式：{ input: "用户输入", depth: 4 }
   */
  async handleThink({ input, depth }) {
    if (!input) return wrapError('缺少 input 参数');
    const result = await this.hf.think(input, depth || 4);
    return wrapOk(result);
  }

  /**
   * 快速推理（基础深度）
   * 使用方式：{ input: "用户输入" }
   */
  async handleThinkFast({ input }) {
    if (!input) return wrapError('缺少 input 参数');
    const result = await this.hf.think(input, 1);
    return wrapOk(result);
  }

  /**
   * 深度推理（最大深度）
   * 使用方式：{ input: "用户输入" }
   */
  async handleThinkDeep({ input }) {
    if (!input) return wrapError('缺少 input 参数');
    const result = await this.hf.think(input, 4);
    return wrapOk(result);
  }

  /**
   * 梦境生成与整合
   * 使用方式：{ force: true } — force=true 强制执行（跳过每日检查）
   */
  async handleDream({ force }) {
    const result = await this.hf.dreamNow({ force: !!force });
    return wrapOk(result);
  }

  /**
   * 跨层记忆检索（CORE / LEARNED / EPHEMERAL）
   * 使用方式：{ query: "关键词", limit: 10, layers: ["core","learned"] }
   */
  async handleMemorySearch({ query, limit, layers }) {
    if (!query) return wrapError('缺少 query 参数');
    const l = limit || 10;
    const results = {};

    // 根据指定层检索，默认检索所有层
    const targetLayers = layers || ['core', 'learned', 'ephemeral'];
    for (const layer of targetLayers) {
      try {
        if (layer === 'core') {
          const all = this.hf.memory.listCore() || [];
          results.core = all.filter(r =>
            r.key?.includes(query) || r.value?.includes(query)
          ).slice(0, l);
        } else if (layer === 'learned') {
          results.learned = (this.hf.memory.searchLearned?.(query) || []).slice(0, l);
        } else if (layer === 'ephemeral') {
          results.ephemeral = (this.hf.memory.searchEphemeral?.(query) || []).slice(0, l);
        }
      } catch (e) {
        results[layer] = { error: e.message };
      }
    }
    return wrapOk(results);
  }

  /**
   * 心理学分析（PAD 情绪 + 意图 + 防御机制）
   * 使用方式：{ input: "用户输入" }
   */
  async handlePsychologyAnalyze({ input }) {
    if (!input) return wrapError('缺少 input 参数');
    const result = this.hf.analyzePsychology(input);
    return wrapOk(result);
  }

  /**
   * 情绪分析（简化版，聚焦 PAD 三维 + 强度）
   * 使用方式：{ input: "用户输入" }
   */
  async handleEmotionAnalyze({ input }) {
    if (!input) return wrapError('缺少 input 参数');
    const result = this.hf.analyzePsychology(input);
    return wrapOk({
      pad: result.emotion?.pad || { pleasure: 0, arousal: 0, dominance: 0 },
      intensity: result.emotion?.intensity || 0,
      category: result.emotion?.category || 'neutral',
      valence: result.emotion?.valence || 0,
    });
  }

  /**
   * Q-learning 自愈策略推荐
   * 使用方式：{ errorCode: "HEAL003", context: "..." }
   */
  async handleSelfHeal({ errorCode, context }) {
    if (!errorCode) return wrapError('缺少 errorCode 参数');
    try {
      const evolution = this.hf.evolution;
      if (!evolution || !evolution.core || !evolution.core.rl) {
        return wrapError('Q-table 未就绪，evolution 模块可能未完整加载');
      }
      const actions = evolution.core.rl.getTopActions?.(errorCode, 3) || [];
      const stats = evolution.core.rl.getStats?.() || {};
      return wrapOk({ errorCode, recommendedActions: actions, qTableStats: stats });
    } catch (e) {
      return wrapError(`自愈查询失败: ${e.message}`);
    }
  }

  /**
   * 验证推理结论
   * 使用方式：{ reasoning: "推理过程", conclusion: "结论" }
   */
  async handleVerifyReasoning({ reasoning, conclusion }) {
    if (!reasoning || !conclusion) return wrapError('需要 reasoning 和 conclusion 参数');
    const result = this.hf.verifyReasoning(reasoning, conclusion);
    return wrapOk(result);
  }

  /**
   * 引擎健康检查
   */
  async handleStatus() {
    const health = this.hf.healthCheck();
    const routes = this.hf.routes();
    const modCount = Object.keys(routes).length;
    return wrapOk({
      ...health,
      routes: modCount,
      memory: {
        core: this.hf.memory?.listCore?.()?.length || 0,
        learned: this.hf.memory?.getLearnedCount?.() || 'N/A',
        ephemeral: this.hf.memory?.getEphemeralCount?.() || 'N/A',
      },
      thoughtChain: !!this.hf._thoughtChainApi,
    });
  }

  /**
   * 通用 dispatch 路由调用
   * 使用方式：{ route: "truth.checkStatement", args: ["内容"] }
   *
   * 安全限制：仅调用 ALLOWED_ROUTES 白名单内的路由
   */
  async handleDispatch({ route, args }) {
    if (!route) return wrapError('缺少 route 参数');
    try {
      const result = this.hf.dispatch(route, ...(args || []));
      // 如果是 Promise，await 它
      const final = (result instanceof Promise) ? await result : result;
      return wrapOk(final);
    } catch (e) {
      return wrapError(`dispatch 失败: ${e.message}`);
    }
  }

  /**
   * 记录教训到 LessonBank + LEARNED 层
   * 使用方式：{ content: "教训内容", context: "场景", trigger: "user_correction", importance: 4 }
   */
  async handleRecordLesson({ content, context, trigger, importance, type }) {
    if (!content) return wrapError('缺少 content 参数');
    const result = this.hf.recordLesson({
      content,
      context: context || '',
      trigger: trigger || 'user_recorded',
      importance: importance || 3,
      type: type || 'insight',
    });
    return wrapOk(result);
  }
}

// ─── 响应包装 ─────────────────────────────────────

function wrapOk(data) {
  return {
    success: true,
    data,
    _meta: { timestamp: Date.now() },
  };
}

function wrapError(message) {
  return {
    success: false,
    error: message,
    _meta: { timestamp: Date.now() },
  };
}

module.exports = { HeartFlowMCPHandlers };
