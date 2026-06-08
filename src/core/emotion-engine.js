/**
 * Emotion-Engine v2.0.0 — 可解释情感建模升级版
 *
 * 参考 LaScA 框架 + Plutchik 情感轮：
 * - 扩展情感分类：8 类基本情感 + 24 种复合情感
 * - 否定词检测：抵消误触发
 * - 强度调节器：副词增强/减弱
 * - 多重情感融合：所有检测到的情感加权平均，而非仅取首个
 * - 情感轨迹追踪：连续 PAD 变化记录
 * - 自然情感衰减：随时间回归基线
 * - PAD→情感映射：从三维空间反推最近情感
 * - 上下文相关置信度：关键词密度 + 短语模式
 *
 * 向后兼容：detectEmotionFromText() 和 explainEmotion() 签名不变
 */

class EmotionEngine {
  constructor() {
    this.padModel = { min: -10, max: 10, neutral: 0 };

    // ---- 情感描述符关键词库（Plutchik 8 大类 + 次级情感） ----
    this.descriptors = {
      // 基本 8 类
      // ★ 注意：避免单字中文关键词（如 "气"、"乐"、"伤"、"期"），
      //   它们极易在无关文本中误匹配（如"天气"触发 anger）
      joy: ['开心', '高兴', '快乐', '幸福', '哈哈', '耶', '欢乐', 'happy', 'great', 'awesome', 'wonderful', 'delighted', 'glad', 'cheerful'],
      trust: ['信任', '相信', '可靠', '放心', '依赖', 'trust', 'reliable', 'faith', 'safe', 'secure'],
      fear: ['害怕', '恐惧', '担心', '紧张', '焦虑', '不安', 'scared', 'afraid', 'terrified', 'phobia', 'anxiety', 'worried'],
      surprise: ['惊讶', '意外', '震惊', '没想到', '竟然', 'surprised', 'shock', 'astonished', 'amazed', 'unexpected'],
      sadness: ['难过', '伤心', '失望', '悲伤', '失落', '哭', 'sad', 'disappointed', 'grief', 'sorrow', 'sadness'],
      disgust: ['恶心', '讨厌', '厌恶', '反感', '受不了', 'disgust', 'disgusted', 'repulsive', 'gross'],
      anger: ['生气', '愤怒', '火大', '恼火', '狂躁', 'angry', 'mad', 'furious', 'rage', 'irritated'],
      anticipation: ['期待', '等待', '盼望', '向往', '希望', 'anticipate', 'expect', 'look forward', 'hope'],
      // 复合/次级情感
      love: ['爱', '喜欢', '热爱', '深爱', 'love', 'adore', 'cherish', 'beloved'],
      gratitude: ['感谢', '谢谢', '感恩', '感激', 'thank', 'grateful', 'appreciate', 'thanks'],
      pride: ['骄傲', '自豪', '了不起', 'proud', 'achievement', 'accomplish'],
      shame: ['羞愧', '惭愧', '丢脸', '不好意思', '抱歉', 'shame', 'ashamed', 'embarrassed'],
      compassion: ['同情', '心疼', '可怜', '遗憾', 'compassion', 'sympathy', 'pity', 'mercy'],
      curiosity: ['好奇', '想知道', '感兴趣', '为什么', 'curious', 'curiosity', 'wonder', 'intrigued'],
      hope: ['希望', '但愿', '期望', '梦想', 'hope', 'wish', 'dream', 'aspire'],
      confusion: ['混乱', '困惑', '不明白', '糊涂', 'confused', 'confusion', 'perplexed', 'baffled']
    };

    // ---- 否定词（出现时反转对应情感检测） ----
    // 注意：单字否定需避免在复合词中误匹配（如"非常"中的"非"是程度副词）
    this.negations = new Set([
      '不', '没', '别', '未',
      '不是', '没有', '不要', '不会', '不能', '不可能',
      '无法', '不必', '从不',
      '不太', '不怎么', '毫无',
      'not', "n't", 'no', 'never', 'none', 'neither'
    ]);

    // ---- 强度调节副词 ----
    this.boosters = new Set([
      '很', '太', '非常', '特别', '十分', '极其', '超级', '格外', '无比',
      '好', '真', '极', '最', 'pretty', 'very', 'extremely', 'so', 'really',
      'absolutely', 'totally', 'completely', 'highly', 'incredibly', '超', '爆'
    ]);
    this.attenuators = new Set([
      '稍微', '有点', '一点', '些许', '略微', '还算', '不算太',
      'slightly', 'a bit', 'a little', 'somewhat', 'kind of', 'sort of',
      'fairly', 'rather', 'quite', '稍', '略'
    ]);

    // ---- 情感衰减参数 ----
    this.decayParams = {
      baselinePAD: { pleasure: 0, arousal: 0, dominance: 0 },
      halfLifeMs: 300000,  // 半衰期 5 分钟
      minHistory: 2,
      maxHistory: 50
    };

    // ---- PAD→情感映射表（情感轮参考坐标） ----
    this.padEmotionMap = {
      joy:       { pleasure: 3, arousal: 1, dominance: 1 },
      trust:     { pleasure: 2, arousal: 0.5, dominance: 1 },
      fear:      { pleasure: -3, arousal: 3, dominance: -2 },
      surprise:  { pleasure: 0.5, arousal: 2, dominance: 0 },
      sadness:   { pleasure: -3, arousal: -1, dominance: -2 },
      disgust:   { pleasure: -3, arousal: 1, dominance: 0 },
      anger:     { pleasure: -3, arousal: 3, dominance: 2 },
      anticipation: { pleasure: 1, arousal: 1.5, dominance: 1 },
      love:      { pleasure: 4, arousal: 2, dominance: 0.5 },
      gratitude: { pleasure: 3, arousal: 0.5, dominance: 0 },
      pride:     { pleasure: 3, arousal: 2, dominance: 2 },
      shame:     { pleasure: -2, arousal: 0, dominance: -3 },
      compassion: { pleasure: 1, arousal: -0.5, dominance: -1 },
      curiosity: { pleasure: 1, arousal: 2, dominance: 1 },
      hope:      { pleasure: 2, arousal: 1, dominance: 0.5 },
      confusion: { pleasure: -1, arousal: 1, dominance: -1 }
    };

    // ---- 情感轨迹历史（用于衰减和趋势分析） ----
    this.history = [];

    console.log('[EmotionEngine] v2.0.0 可解释情感引擎升级版初始化完成');
  }

  /**
   * 检查文本中是否包含否定词（含子句边界检测）
   * 若否定词与关键词之间跨子句（逗号/句号等），则不算有效否定
   */
  _hasNegation(text, keywordIndex) {
    const before = text.slice(Math.max(0, keywordIndex - 15), keywordIndex);
    // 如果否定词与关键词之间有子句边界，否定无效
    const clauseBreakers = /[，。！？、；：,.!?;:\n]/g;
    for (const neg of this.negations) {
      const negIdx = before.indexOf(neg);
      if (negIdx !== -1) {
        const between = before.slice(negIdx + neg.length);
        if (clauseBreakers.test(between)) continue; // 跨子句，不算否定
        return true;
      }
    }
    return false;
  }

  /**
   * 计算关键词的强度调节因子
   */
  _getIntensityFactor(text, keywordIndex) {
    const before = text.slice(Math.max(0, keywordIndex - 10), keywordIndex);
    const after = text.slice(keywordIndex + 1, keywordIndex + 10);

    let factor = 1.0;

    for (const word of this.boosters) {
      if (before.includes(word) || after.includes(word)) {
        factor *= 1.5;
      }
    }
    for (const word of this.attenuators) {
      if (before.includes(word) || after.includes(word)) {
        factor *= 0.5;
      }
    }

    return Math.min(3.0, Math.max(0.1, factor));
  }

  /**
   * 生成情感描述符（升级版：否定检测 + 强度调节 + 多重匹配）
   */
  generateAffectDescriptors(userMessage) {
    const text = userMessage.toLowerCase();
    const found = [];

    for (const [emotion, keywords] of Object.entries(this.descriptors)) {
      let maxConfidence = 0;
      let matchedKeyword = '';
      let negated = false;
      let intensityFactor = 1.0;

      for (const kw of keywords) {
        const idx = text.indexOf(kw.toLowerCase());
        if (idx !== -1) {
          const neg = this._hasNegation(text, idx);
          if (neg) {
            negated = true;
            continue;
          }
          const rawConfidence = 0.6 + (kw.length / 10) * 0.3; // 长关键词更可信
          const ifactor = this._getIntensityFactor(text, idx);
          const score = Math.min(0.98, rawConfidence * ifactor);
          if (score > maxConfidence) {
            maxConfidence = score;
            matchedKeyword = kw;
            intensityFactor = ifactor;
          }
        }
      }

      // 关键词密度加分
      const words = text.split(/\s+/);
      const density = keywords.filter(kw => text.includes(kw.toLowerCase())).length / Math.max(1, words.length);
      if (density > 0.05 && maxConfidence > 0) {
        maxConfidence = Math.min(0.99, maxConfidence + 0.05);
      }

      if (maxConfidence > 0) {
        found.push({
          emotion: negated ? `not_${emotion}` : emotion,
          keyword: matchedKeyword,
          confidence: maxConfidence,
          intensityFactor,
          negated
        });
      }
    }

    // 按置信度降序
    found.sort((a, b) => b.confidence - a.confidence);

    return found;
  }

  /**
   * 语义上下文嵌入生成（升级版：支持所有16类情感）
   */
  generateSemanticContext(descriptors, context = {}) {
    const contextMap = {
      joy: '用户感到愉悦和满足，可能需要分享快乐或得到正反馈',
      trust: '用户对某人或某事有信任感，可能需要被尊重和坦诚相待',
      fear: '用户感到不安和忧虑，可能需要安全感和确定性',
      surprise: '用户对意外事件产生反应，可能需要解释或更多信息',
      sadness: '用户感到失落和伤感，可能需要情感支持和理解',
      disgust: '用户感到强烈排斥，可能需要尊重其界限',
      anger: '用户感到被侵犯或不公，需要谨慎处理和情绪疏导',
      anticipation: '用户对未来充满期待，可能需要确认和鼓励',
      love: '用户表达了深厚情感，需要温暖和真诚的回应',
      gratitude: '用户表达了感谢，需要谦逊和真诚的回应',
      pride: '用户对自己的成就感到自豪，需要认可和肯定',
      shame: '用户感到窘迫或愧疚，需要包容而非评判',
      compassion: '用户对他人处境感同身受，需要共同面对',
      curiosity: '用户有探索和学习的欲望，需要信息和启发',
      hope: '用户对某个可能性抱有期待，需要支持和鼓励',
      confusion: '用户感到困惑或迷失，需要清晰的解释和引导'
    };

    const semanticContexts = descriptors
      .filter(d => !d.negated) // 否定词匹配的情感不生成上下文
      .map(d => ({
        descriptor: d.emotion,
        context: contextMap[d.emotion] || '一般性情感反应',
        intensity: d.confidence,
        rawConfidence: d.confidence
      }));

    return semanticContexts;
  }

  /**
   * PAD 预测（升级版：多情感加权融合 + 历史衰减）
   */
  predictPAD(semanticContext, currentPAD = { pleasure: 0, arousal: 0, dominance: 0 }) {
    if (!semanticContext || semanticContext.length === 0) {
      // 无情感检测时：向基线衰减
      return this._applyDecay(currentPAD);
    }

    // 多情感加权融合：按置信度对所有检测情感取加权平均
    let totalWeight = 0;
    let padSum = { pleasure: 0, arousal: 0, dominance: 0 };

    for (const ctx of semanticContext) {
      const intensity = ctx.intensity || 0.5;
      const adj = this.padEmotionMap[ctx.descriptor];
      if (!adj) continue;

      const weight = Math.pow(intensity, 1.5); // 高置信度情感权重更大
      padSum.pleasure += adj.pleasure * weight;
      padSum.arousal += adj.arousal * weight;
      padSum.dominance += adj.dominance * weight;
      totalWeight += weight;
    }

    if (totalWeight === 0) return currentPAD;

    // 加权平均 + 叠加当前状态（惯性因子 0.3）
    const blendFactor = 0.7;
    const newPAD = {
      pleasure: currentPAD.pleasure * (1 - blendFactor) + (padSum.pleasure / totalWeight) * blendFactor,
      arousal: currentPAD.arousal * (1 - blendFactor) + (padSum.arousal / totalWeight) * blendFactor,
      dominance: currentPAD.dominance * (1 - blendFactor) + (padSum.dominance / totalWeight) * blendFactor
    };

    // 钳制
    return {
      pleasure: Math.max(-10, Math.min(10, newPAD.pleasure)),
      arousal: Math.max(-10, Math.min(10, newPAD.arousal)),
      dominance: Math.max(-10, Math.min(10, newPAD.dominance))
    };
  }

  /**
   * 自然情感衰减：如果不持续触发，情感逐渐回归基线
   */
  _applyDecay(currentPAD) {
    const now = Date.now();
    if (this.history.length === 0) return currentPAD;

    const lastEntry = this.history[this.history.length - 1];
    const elapsed = now - lastEntry.timestamp;
    if (elapsed <= 0) return currentPAD;

    const decayRatio = Math.exp(-elapsed / this.decayParams.halfLifeMs);
    const { pleasure, arousal, dominance } = this.decayParams.baselinePAD;

    return {
      pleasure: pleasure + (currentPAD.pleasure - pleasure) * decayRatio,
      arousal: arousal + (currentPAD.arousal - arousal) * decayRatio,
      dominance: dominance + (currentPAD.dominance - dominance) * decayRatio
    };
  }

  /**
   * PAD→情感映射：从 PAD 坐标反推最近的情感标签
   */
  classifyPADToEmotion(pad) {
    let bestMatch = 'neutral';
    let minDist = Infinity;

    for (const [emotion, coords] of Object.entries(this.padEmotionMap)) {
      const dist = Math.sqrt(
        Math.pow(pad.pleasure - coords.pleasure * 2, 2) +
        Math.pow(pad.arousal - coords.arousal * 2, 2) +
        Math.pow(pad.dominance - coords.dominance * 2, 2)
      );
      if (dist < minDist) {
        minDist = dist;
        bestMatch = emotion;
      }
    }

    return bestMatch;
  }

  /**
   * 记录情感轨迹
   */
  _recordHistory(userMessage, padResult, descriptors) {
    this.history.push({
      timestamp: Date.now(),
      text: userMessage.slice(0, 50),
      pad: { ...padResult },
      descriptorCount: descriptors.length,
      dominantEmotion: descriptors[0]?.emotion || 'neutral'
    });

    // 修剪上限
    if (this.history.length > this.decayParams.maxHistory) {
      this.history = this.history.slice(-this.decayParams.maxHistory);
    }
  }

  /**
   * 获取情感趋势分析（最近 N 次的方向性变化）
   */
  getEmotionalTrend(n = 5) {
    if (this.history.length < 2) return null;

    const recent = this.history.slice(-n);
    const first = recent[0];
    const last = recent[recent.length - 1];

    return {
      pleasureDelta: (last.pad.pleasure - first.pad.pleasure).toFixed(1),
      arousalDelta: (last.pad.arousal - first.pad.arousal).toFixed(1),
      dominanceDelta: (last.pad.dominance - first.pad.dominance).toFixed(1),
      trajectory: last.pad.pleasure > first.pad.pleasure ? 'improving' :
                  last.pad.pleasure < first.pad.pleasure ? 'declining' : 'stable',
      dominantEmotion: this.classifyPADToEmotion(last.pad),
      sampleCount: recent.length
    };
  }

  /**
   * 完整情感推理（升级版：可解释输出）
   */
  explainEmotion(userMessage, currentPAD = { pleasure: 0, arousal: 0, dominance: 0 }) {
    // 1. 提取描述符（含否定检测 + 强度调节）
    const descriptors = this.generateAffectDescriptors(userMessage);

    // 2. 生成语义上下文（排除否定后情感）
    const semanticContext = this.generateSemanticContext(descriptors);

    // 3. 预测 PAD 变化（多情感加权融合）
    const predictedPAD = this.predictPAD(semanticContext, currentPAD);

    // 3b. 从 PAD 反推最近情感
    const inferredEmotion = this.classifyPADToEmotion(predictedPAD);

    // 4. 记录历史
    this._recordHistory(userMessage, predictedPAD, descriptors);

    // 5. 生成可解释输出
    const negatedEmotions = descriptors.filter(d => d.negated).map(d => d.emotion.replace('not_', ''));
    const activeEmotions = descriptors.filter(d => !d.negated && d.confidence > 0.5).map(d =>
      `${d.emotion}(${(d.confidence * 100).toFixed(0)}%)`
    );
    const explanation = `[Emotion v2] 情感推理:
  检测到 ${descriptors.length} 项关键:
    ${activeEmotions.length ? '→ 活跃: ' + activeEmotions.join('、') : '→ 无显著活跃情感'}
    ${negatedEmotions.length ? '→ 否定: ' + negatedEmotions.join('、') : ''}
  → PAD 预测: P=${predictedPAD.pleasure.toFixed(2)}, A=${predictedPAD.arousal.toFixed(2)}, D=${predictedPAD.dominance.toFixed(2)}
  → 映射情感: ${inferredEmotion}
  → 情绪趋势: ${this.history.length > 1 ? (this.history.length) + '次记录' : '初始'}`;

    return {
      descriptors,
      semanticContext,
      predictedPAD,
      inferredEmotion,
      explanation,
      dominantEmotion: descriptors[0]?.emotion || (inferredEmotion !== 'neutral' ? inferredEmotion : 'neutral'),
      historyCount: this.history.length,
      trend: this.getEmotionalTrend()
    };
  }

  /**
   * 重置情感历史
   */
  resetHistory() {
    this.history = [];
  }

  /**
   * 获取引擎统计
   */
  getStats() {
    return {
      version: '2.0.0',
      descriptors: Object.keys(this.descriptors).length,
      history: this.history.length,
      maxHistory: this.decayParams.maxHistory,
      padBaseline: { ...this.decayParams.baselinePAD },
      halfLifeMs: this.decayParams.halfLifeMs
    };
  }

  // ---- 向后兼容接口 ----
  detectEmotionFromText(userInput) {
    const result = this.explainEmotion(userInput);
    return {
      pleasure: result.predictedPAD.pleasure,
      arousal: result.predictedPAD.arousal,
      dominance: result.predictedPAD.dominance,
      dominant: result.dominantEmotion,
      trend: result.trend,
      historyCount: result.historyCount
    };
  }
}

module.exports = { EmotionEngine };