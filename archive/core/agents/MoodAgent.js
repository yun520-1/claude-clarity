/**
 * MoodAgent v2.0.0 — 情绪分析代理（升级版）
 *
 * 升级内容：
 * - 从旧 heartflow-engine.js 迁移到 EmotionEngine v2.0.0
 * - 新增 16 类情感检测（Plutchik 8 大类 + 8 次级）
 * - 新增否定词检测（避免误判否定语句）
 * - 新增强度调节器（副词增强/减弱）
 * - 新增情感衰减 + 历史轨迹追踪
 * - 保留所有旧 API 后向兼容
 */

const { EmotionEngine } = require('../emotion-engine.js');

class MoodAgent {
  constructor() {
    this.name = '情绪助手';
    this.icon = '💙';
    this._engine = new EmotionEngine();
    console.log('[MoodAgent] v2.0.0 已连接到 EmotionEngine v2.0.0');
  }

  /**
   * 分析用户情绪（升级版）
   * 使用 EmotionEngine v2.0.0 的多情感加权融合引擎
   * @param {string} userInput - 用户输入
   * @returns {object} 情绪分析结果
   */
  analyzeMood(userInput) {
    const result = this._engine.explainEmotion(userInput);
    const { predictedPAD, descriptors, inferredEmotion, trend, historyCount } = result;

    // 活跃情感（排除否定后）
    const active = descriptors.filter(d => !d.negated && d.confidence > 0.5);

    // 情绪分类 — 基于 PAD 多维度
    let moodCategory = 'neutral';
    if (predictedPAD.pleasure > 2) moodCategory = 'positive';
    else if (predictedPAD.pleasure < -2) moodCategory = 'negative';
    // 唤醒度修正：愉悦度高+唤醒度高 → 正面，愉悦度低+唤醒度高 → 负面
    if (predictedPAD.pleasure > 0 && predictedPAD.arousal > 3) moodCategory = 'positive';
    if (predictedPAD.pleasure < 0 && predictedPAD.arousal > 3) moodCategory = 'negative';

    // 情绪标签 — 基于主导情感命名（比旧版更丰富）
    const emotionLabels = {
      joy: '愉悦', trust: '信赖', fear: '不安', surprise: '惊讶',
      sadness: '伤感', disgust: '反感', anger: '愤怒', anticipation: '期待',
      love: '喜爱', gratitude: '感恩', pride: '自豪', shame: '羞愧',
      compassion: '共情', curiosity: '好奇', hope: '希望', confusion: '困惑',
      neutral: '平静'
    };
    let moodLabel = emotionLabels[inferredEmotion] || '平静';
    // 强度修正
    if (predictedPAD.pleasure > 5 && predictedPAD.arousal > 3) moodLabel = '兴奋';
    else if (predictedPAD.arousal < -3) moodLabel = '疲惫';
    else if (predictedPAD.pleasure > 3 && predictedPAD.pleasure <= 5) moodLabel = '愉悦';

    // 生成支持建议
    const support = this.generateSupport(moodCategory, moodLabel, predictedPAD);

    return {
      agent: this.name,
      moodCategory,
      moodLabel,
      pad: predictedPAD,
      support,
      dominantEmotion: active[0]?.emotion || inferredEmotion,
      emotionDetail: active.map(d => ({ emotion: d.emotion, confidence: d.confidence })),
      trend: trend || null,
      historyCount,
      engineVersion: '2.0.0',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 生成情感支持（升级版：基于情感类型的差异化支持）
   * @param {string} category - 情绪类别
   * @param {string} label - 情绪标签
   * @param {object} pad - PAD 状态
   * @returns {string[]} 支持建议
   */
  generateSupport(category, label, pad) {
    const supports = {
      positive: [
        '🌟 太棒了！保持这个状态！',
        '💪 你的努力正在得到回报',
        '🎉 为自己今天的进步感到骄傲'
      ],
      negative: [
        '💙 我理解你的感受，这很正常',
        '🌱 每一次挑战都是成长的机会',
        '🤗 你已经做得很好了，休息一下没关系',
        '🌈 困难是暂时的，你比想象中更强大',
        '💪 让我们一起分解这个任务，一步一步来'
      ],
      neutral: [
        '😊 平稳的状态很好',
        '🎯 准备好继续前进吗？',
        '💫 今天有什么想完成的吗？'
      ]
    };

    // 根据 PAD 调整支持
    if (pad.dominance < -3) {
      supports.negative.unshift('🔑 你掌控着自己的节奏，按自己的方式来');
    }
    if (pad.arousal < -5) {
      supports.negative.unshift('☕ 先休息一下吧，喝杯水，活动一下');
    }
    // 新增：高唤醒 + 负向 → 焦虑信号，增加安抚
    if (pad.pleasure < -3 && pad.arousal > 4) {
      supports.negative.unshift('🫂 先深呼吸，你不需要一次性解决所有问题');
    }
    // 新增：低支配 + 负向 → 无力感
    if (pad.dominance < -5 && pad.pleasure < -3) {
      supports.negative.unshift('🌱 从一件小事开始，你比自己想象的更有力量');
    }

    return supports[category] || supports.neutral;
  }

  /**
   * 生成鼓��语（升级版：加入情感细节）
   * @param {object} analysis - 情绪分析结果
   * @returns {string} 鼓励文本
   */
  encourage(analysis) {
    const supports = this.generateSupport(analysis.moodCategory, analysis.moodLabel, analysis.pad);

    let prompt = `${this.icon} ${analysis.moodLabel}`;
    // 如果有具体情感和置信度，显示细节
    if (analysis.emotionDetail && analysis.emotionDetail.length > 0) {
      prompt += ` (${analysis.emotionDetail.slice(0, 2).map(e => `${e.emotion}${Math.round(e.confidence * 100)}%`).join('·')})`;
    }
    prompt += ` P:${analysis.pad.pleasure.toFixed(1)} A:${analysis.pad.arousal.toFixed(1)} D:${analysis.pad.dominance.toFixed(1)}\n\n`;

    prompt += supports.slice(0, 2).join('\n') + '\n\n';

    if (analysis.moodCategory === 'negative') {
      prompt += '需要我帮你做什么吗？\n';
      prompt += '  • 分解任务\n';
      prompt += '  • 调整难度\n';
      prompt += '  • 或者只是倾听';
    }

    return prompt;
  }

  /**
   * 主动关怀（升级版：趋势感知 + 更细粒度触发）
   * @param {object} analysis - 情绪分析结果
   * @returns {string} 关怀文本
   */
  checkIn(analysis) {
    // 触发条件：负向情绪 + 低愉悦度，或趋势恶化 + 历史 N 次负面
    const needsCheckIn = (
      (analysis.moodCategory === 'negative' && analysis.pad.pleasure < -5) ||
      (analysis.pad.pleasure < -3 && analysis.trend?.trajectory === 'declining')
    );

    if (needsCheckIn) {
      let msg = `${this.icon} 注意到你情绪有些低落，想聊聊吗？\n\n`;

      // 如果有趋势数据，加入趋势感知
      if (analysis.trend && analysis.historyCount > 1) {
        msg += `这是连续第 ${analysis.historyCount} 次情绪记录，趋势${analysis.trend.trajectory === 'declining' ? '仍在下滑' : '波动中'}。\n\n`;
      }

      msg += `记住：
- 你的感受是有效的
- 寻求帮助是勇敢的表现
- 你并不孤单

如果需要专业支持：
📞 心理援助热线：400-161-9995`;
      return msg;
    }

    // 轻度负向或恢复中 → 温和问候
    if (analysis.moodCategory === 'negative' && analysis.pad.pleasure >= -5) {
      return `${this.icon} 感觉还行？想做点什么调整一下心情吗？`;
    }

    return `${this.icon} 今天感觉怎么样？`;
  }

  /**
   * 获取 EmotionEngine 原始实例（用于高级调用）
   */
  getEngine() {
    return this._engine;
  }

  /**
   * 重置情感历史
   */
  resetHistory() {
    this._engine.resetHistory();
  }
}

module.exports = MoodAgent;
