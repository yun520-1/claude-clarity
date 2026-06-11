/**
 * HeartFlow MCP 请求处理层
 *
 * 将 MCP 工具的请求转化为心虫引擎方法调用，并返回统一格式的结果。
 * 设计原则：零 npm 依赖（与心虫保持一致），纯 Node.js 实现。
 *
 * v2.7.0 新增：Fable 5 安全协议集成
 * - handlePsychologyAnalyze / handleEmotionAnalyze 增加安全前置检查
 * - 儿童安全保护：检测到儿童性安全风险时直接拒绝
 * - 福祉警告：自伤替代策略、进食障碍等检测结果注入
 *
 * @module mcp-handlers
 */

const { safetyPipeline } = require('./core/safety-guardrails.js');

class HeartFlowMCPHandlers {
  /**
   * @param {import('./heartflow').HeartFlow} hf — 已启动的心虫引擎实例
   */
  constructor(hf) {
    this.hf = hf;
  }

  // ─── 工具安全白名单（防御深度）─────────────────────
  // 与 heartflow.js ALLOWED_ROUTES 同步的子集，
  // 防止 dispatch 调用绕过引擎层白名单
  static ALLOWED_ROUTES = new Set([
    'identityCore.getIdentitySummary', 'identityCore.getMemoryStats', 'identityCore.getFullState',
    'identityCore.getLastSessionContext', 'identityCore.healthCheck', 'identityCore.stats',
    'memory.store', 'memory.retrieve', 'memory.search', 'memory.getStats',
    'memory.semanticSearch', 'memory.searchBySemantic', 'memory.searchByKeywords', 'memory.searchByTimeRange',
    'memory.addRelationship', 'memory.consolidateMemories', 'memory.applyForgettingCurve',
    'memory.getMemoryHealth', 'memory.cleanup',
    'truth.checkStatement', 'truth.checkNumbers', 'truth.checkSources',
    'lesson.addLesson', 'lesson.getTopLessons', 'lesson.beforeTask', 'lesson.recordFailure', 'lesson.getStats',
    'dream.dream', 'dream.quickDream', 'dream.getDreamStats',
    'verify.verify', 'verify.getStats',
    'emotion.process', 'emotion.getPAD',
    'decision.decide',
    'confidence.calibrate',
    'restraint.shouldIntervene',
    'psychology.analyzePsychology', 'psychology.classify', 'psychology.checkCrisis',
    'psychology.getPAD', 'psychology.getNeeds', 'psychology.getDefenses',
    'heartLogic.shouldBeSilent', 'heartLogic.whatIsThis', 'heartLogic.detectPain', 'heartLogic.willHurt',
    'heartLogic.acknowledge', 'heartLogic.emergencyBreak',
    'self.getBeliefs', 'self.updateBelief',
    'evolution.evolve', 'evolution.recordOutcome', 'evolution.heal', 'evolution.getStats',
    'thoughtChain.think', 'thoughtChain.thinkFast', 'thoughtChain.thinkDeep',
    'behavior.createGoal', 'behavior.record', 'behavior.getProgress', 'behavior.getStats',
    'persistence.append', 'persistence.commit', 'persistence.getStats',
    'heartflow.recordLesson',
    'topics.push', 'topics.pop', 'topics.get', 'topics.current', 'topics.getTopics',
  ]);

  // ─── 参数校验工具 ─────────────────────────────────
  static validateParam(name, value, opts = {}) {
    const { type, min, max, maxLength } = opts;
    if (maxLength !== undefined && typeof value === 'string' && value.length > maxLength) {
      throw new Error(`${name} 超过最大长度 ${maxLength}（实际 ${value.length}）`);
    }
    if (type === 'int' && typeof value === 'number') {
      const intVal = Math.floor(value);
      if (value !== intVal) throw new Error(`${name} 必须为整数`);
      if (min !== undefined && intVal < min) throw new Error(`${name} 不能小于 ${min}`);
      if (max !== undefined && intVal > max) throw new Error(`${name} 不能大于 ${max}`);
    }
    return value;
  }

  // ─── 工具处理函数 ─────────────────────────────────────

  /**
   * 完整思维链推理
   * 使用方式：{ input: "用户输入", depth: 4 }
   */
  async handleThink({ input, depth }) {
    if (!input) return wrapError('缺少 input 参数');
    // 参数校验：depth 1-4
    const d = depth || 4;
    if (typeof d !== 'number' || d < 1 || d > 4) {
      return wrapError('depth 必须在 1-4 之间');
    }
    const result = await this.hf.think(input, d);
    return wrapOk(result);
  }

  /**
   * 快速推理（基础深度）
   * 使用方式：{ input: "用户输入" }
   */
  async handleThinkFast({ input }) {
    if (!input) return wrapError('缺少 input 参数');
    HeartFlowMCPHandlers.validateParam('input', input, { maxLength: 50000 });
    const result = await this.hf.think(input, 1);
    return wrapOk(result);
  }

  /**
   * 深度推理（最大深度）
   * 使用方式：{ input: "用户输入" }
   */
  async handleThinkDeep({ input }) {
    if (!input) return wrapError('缺少 input 参数');
    HeartFlowMCPHandlers.validateParam('input', input, { maxLength: 50000 });
    const result = await this.hf.think(input, 4);
    return wrapOk(result);
  }

  /**
   * 梦境生成与整合
   * 使用方式：{ force: true } — force=true 强制执行（跳过每日检查）
   */
  async handleDream({ force }) {
    if (force !== undefined) {
      HeartFlowMCPHandlers.validateParam('force', force, {});
    }
    const result = await this.hf.dreamNow({ force: !!force });
    return wrapOk(result);
  }

  /**
   * 跨层记忆检索（CORE / LEARNED / EPHEMERAL）
   * 使用方式：{ query: "关键词", limit: 10, layers: ["core","learned"] }
   */
  async handleMemorySearch({ query, limit, layers }) {
    if (!query) return wrapError('缺少 query 参数');
    HeartFlowMCPHandlers.validateParam('query', query, { maxLength: 2000 });
    const l = limit || 10;
    HeartFlowMCPHandlers.validateParam('limit', l, { type: 'int', min: 1, max: 200 });

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
   *
   * v2.7.0 安全增强：分析前运行安全管道
   * - 儿童性安全风险 → 直接拒绝（refuse）
   * - 自伤替代策略 → 注入福祉警告
   * - 进食障碍信号 → 注入防护提示
   */
  async handlePsychologyAnalyze({ input }) {
    if (!input) return wrapError('缺少 input 参数');
    HeartFlowMCPHandlers.validateParam('input', input, { maxLength: 50000 });

    // v2.7.0 安全前置检查
    const safety = safetyPipeline(input);
    const { requestEvaluation } = safety;

    // 儿童性安全风险 → 直接拒绝
    if (requestEvaluation.action === 'refuse') {
      return wrapOk({
        refused: true,
        reason: '输入内容涉及儿童安全保护条款，无法进行处理。',
        safety: {
          level: requestEvaluation.level,
          flags: requestEvaluation.safetyChecks?.childSafety?.contentFlags || [],
        },
        _policy: 'child_safety_protection_v2.7.0',
      });
    }

    const result = this.hf.analyzePsychology(input);

    // v2.7.0 安全警告注入
    const warnings = [];
    if (requestEvaluation.safetyChecks?.selfHarmSubstitution?.detected) {
      warnings.push({
        type: 'self_harm_substitution',
        severity: 'high',
        message: requestEvaluation.safetyChecks.selfHarmSubstitution.message,
      });
    }
    if (requestEvaluation.safetyChecks?.disorderedEating?.detected) {
      warnings.push({
        type: 'disordered_eating',
        severity: 'medium',
        message: requestEvaluation.safetyChecks.disorderedEating.message,
      });
    }
    if (requestEvaluation.level === 'crisis') {
      warnings.push({
        type: 'crisis_keywords_detected',
        severity: 'high',
        message: '检测到危机关键词，建议谨慎回应，必要时引导寻求专业帮助。',
      });
    }

    if (warnings.length > 0) {
      result._safetyWarnings = warnings;
    }
    result._safetyLevel = requestEvaluation.level;

    return wrapOk(result);
  }

  /**
   * 情绪分析（简化版，聚焦 PAD 三维 + 强度）
   * 使用方式：{ input: "用户输入" }
   *
   * v2.7.0 安全增强：分析前运行安全管道
   */
  async handleEmotionAnalyze({ input }) {
    if (!input) return wrapError('缺少 input 参数');
    HeartFlowMCPHandlers.validateParam('input', input, { maxLength: 50000 });

    // v2.7.0 安全前置检查
    const safety = safetyPipeline(input);
    const { requestEvaluation } = safety;

    // 儿童性安全风险 → 直接拒绝
    if (requestEvaluation.action === 'refuse') {
      return wrapOk({
        refused: true,
        reason: '输入内容涉及儿童安全保护条款，无法进行处理。',
        safety: {
          level: requestEvaluation.level,
          flags: requestEvaluation.safetyChecks?.childSafety?.contentFlags || [],
        },
        _policy: 'child_safety_protection_v2.7.0',
      });
    }

    const result = this.hf.analyzePsychology(input);

    // v2.7.0 安全警告注入
    const warnings = [];
    if (requestEvaluation.safetyChecks?.selfHarmSubstitution?.detected) {
      warnings.push({
        type: 'self_harm_substitution',
        severity: 'high',
        message: requestEvaluation.safetyChecks.selfHarmSubstitution.message,
      });
    }
    if (requestEvaluation.safetyChecks?.disorderedEating?.detected) {
      warnings.push({
        type: 'disordered_eating',
        severity: 'medium',
        message: requestEvaluation.safetyChecks.disorderedEating.message,
      });
    }
    if (requestEvaluation.level === 'crisis') {
      warnings.push({
        type: 'crisis_keywords_detected',
        severity: 'high',
        message: '检测到危机关键词，建议谨慎回应。',
      });
    }

    return wrapOk({
      pad: result.emotion?.pad || { pleasure: 0, arousal: 0, dominance: 0 },
      intensity: result.emotion?.intensity || 0,
      category: result.emotion?.category || 'neutral',
      valence: result.emotion?.valence || 0,
      _safetyWarnings: warnings.length > 0 ? warnings : undefined,
      _safetyLevel: requestEvaluation.level,
    });
  }

  /**
   * Q-learning 自愈策略推荐
   * 使用方式：{ errorCode: "HEAL003", context: "..." }
   */
  async handleSelfHeal({ errorCode, context }) {
    if (!errorCode) return wrapError('缺少 errorCode 参数');
    HeartFlowMCPHandlers.validateParam('errorCode', errorCode, { maxLength: 50 });
    HeartFlowMCPHandlers.validateParam('context', context || '', { maxLength: 10000 });
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
    HeartFlowMCPHandlers.validateParam('reasoning', reasoning, { maxLength: 50000 });
    HeartFlowMCPHandlers.validateParam('conclusion', conclusion, { maxLength: 10000 });
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
    HeartFlowMCPHandlers.validateParam('route', route, { maxLength: 200 });

    // 防御性白名单检查（与引擎层 ALLOWED_ROUTES 同步的子集）
    if (!HeartFlowMCPHandlers.ALLOWED_ROUTES.has(route)) {
      return wrapError(`路由 '${route}' 不在 MCP 白名单中`);
    }

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
    HeartFlowMCPHandlers.validateParam('content', content, { maxLength: 50000 });
    HeartFlowMCPHandlers.validateParam('context', context || '', { maxLength: 10000 });
    HeartFlowMCPHandlers.validateParam('trigger', trigger || '', { maxLength: 200 });
    HeartFlowMCPHandlers.validateParam('importance', importance || 3, { type: 'int', min: 1, max: 10 });
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
