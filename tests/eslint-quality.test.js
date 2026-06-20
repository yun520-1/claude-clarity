/**
 * ESLint 质量验收测试
 *
 * 验证核心模块能正常加载、函数导出正确、基本功能不抛异常。
 * 覆盖 src/utils/、src/identity/、src/planner/、src/memory/ 四个目录。
 */

// ============================================================
// 1. 工具模块 (src/utils)
// ============================================================
describe('src/utils 工具模块', () => {
  test('atomic-write 模块应加载且导出 atomicWrite', () => {
    const mod = require('../src/utils/atomic-write.js');
    expect(mod).toBeDefined();
    expect(typeof mod.atomicWrite).toBe('function');
  });

  test('write-ahead-log 模块应加载且导出 WriteAheadLog', () => {
    const mod = require('../src/utils/write-ahead-log.js');
    expect(mod).toBeDefined();
    expect(typeof mod.WriteAheadLog).toBe('function');
    expect(mod.OP_TYPES).toBeDefined();
  });
});

// ============================================================
// 2. 身份模块 (src/identity)
// ============================================================
describe('src/identity 身份模块', () => {
  test('identity-core 导出 IdentityCore 构造函数', () => {
    const mod = require('../src/identity/identity-core.js');
    expect(mod.IdentityCore).toBeDefined();
    expect(typeof mod.IdentityCore).toBe('function');
  });

  test('identity-rules 导出规则和校验函数', () => {
    const mod = require('../src/identity/identity-rules.js');
    expect(Array.isArray(mod.IDENTITY_RULES)).toBe(true);
    expect(typeof mod.checkIdentityAlignment).toBe('function');
    expect(typeof mod.getIdentitySummary).toBe('function');
    expect(typeof mod.getActiveRules).toBe('function');
  });

  test('self-verifier 导出 SelfVerifier 构造函数', () => {
    const mod = require('../src/identity/self-verifier.js');
    expect(mod.SelfVerifier).toBeDefined();
    expect(typeof mod.SelfVerifier).toBe('function');
  });

  test('self-model 导出 SelfModel', () => {
    const mod = require('../src/identity/self-model.js');
    expect(mod.SelfModel).toBeDefined();
    expect(typeof mod.SelfModel).toBe('function');
  });

  test('topic-scope 导出 TopicScope', () => {
    const mod = require('../src/identity/topic-scope.js');
    expect(mod.TopicScope).toBeDefined();
    expect(typeof mod.TopicScope).toBe('function');
  });
});

// ============================================================
// 3. 规划器模块 (src/planner)
// ============================================================
describe('src/planner 规划器模块', () => {
  test('strategy-selector 导出 StrategySelector', () => {
    const { StrategySelector } = require('../src/planner/strategy-selector.js');
    expect(StrategySelector).toBeDefined();
    expect(typeof StrategySelector).toBe('function');
  });

  test('StrategySelector.selectStrategy 应返回默认策略', () => {
    const { StrategySelector } = require('../src/planner/strategy-selector.js');
    const selector = new StrategySelector();
    const result = selector.selectStrategy('test task');
    expect(result).toBeDefined();
    expect(result.name).toBeDefined();
    expect(typeof result.confidence).toBe('number');
  });

  test('replan-trigger 导出 ReplanTrigger', () => {
    const { ReplanTrigger } = require('../src/planner/replan-trigger.js');
    expect(ReplanTrigger).toBeDefined();
    expect(typeof ReplanTrigger).toBe('function');
  });

  test('ReplanTrigger.shouldReplan 应判断是否需要重新规划', () => {
    const { ReplanTrigger } = require('../src/planner/replan-trigger.js');
    const trigger = new ReplanTrigger();
    const result = trigger.shouldReplan(
      { success: true, errors: [], stepResults: {} },
      { steps: [] }
    );
    expect(result).toBe(false);
  });

  test('ReplanTrigger 失败时应返回 true', () => {
    const { ReplanTrigger } = require('../src/planner/replan-trigger.js');
    const trigger = new ReplanTrigger();
    const result = trigger.shouldReplan(
      { success: false, errors: ['致命错误'], stepResults: {} },
      { steps: [{ id: 'step1' }] }
    );
    expect(result).toBe(true);
  });

  test('adaptive-planner 导出 AdaptivePlanner', () => {
    const { AdaptivePlanner } = require('../src/planner/adaptive-planner.js');
    expect(AdaptivePlanner).toBeDefined();
    expect(typeof AdaptivePlanner).toBe('function');
  });

  test('AdaptivePlanner 应能制定计划', () => {
    const { AdaptivePlanner } = require('../src/planner/adaptive-planner.js');
    const planner = new AdaptivePlanner();
    const plan = planner.plan('实现用户登录功能');
    expect(plan).toBeDefined();
    expect(plan.plan).toBeDefined();
    expect(Array.isArray(plan.plan.steps)).toBe(true);
    expect(plan.plan.steps.length).toBeGreaterThan(0);
    expect(typeof plan.confidence).toBe('number');
  });

  test('AdaptivePlanner.adapt 应支持重规划', () => {
    const { AdaptivePlanner } = require('../src/planner/adaptive-planner.js');
    const planner = new AdaptivePlanner();
    const plan = planner.plan('修复测试错误');
    const adaptResult = planner.adapt(
      '修复测试错误',
      plan.plan,
      {
        success: false,
        errors: ['syntax error'],
        stepResults: { [plan.plan.steps[0].id]: { status: 'failed' } }
      }
    );
    expect(adaptResult).toBeDefined();
    expect(adaptResult.needsReplan).toBeDefined();
  });
});

// ============================================================
// 4. 记忆模块 (src/memory)
// ============================================================
describe('src/memory 记忆模块', () => {
  test('session-memory 导出 SessionMemory', () => {
    const { SessionMemory } = require('../src/memory/session-memory.js');
    expect(SessionMemory).toBeDefined();
    expect(typeof SessionMemory).toBe('function');
  });

  test('SessionMemory 应能启动并写入会话', () => {
    const { SessionMemory } = require('../src/memory/session-memory.js');
    const session = new SessionMemory({ autoSave: false });
    session.startSession('test-session');
    session.set('key1', 'value1');
    expect(session.get('key1')).toBe('value1');
    expect(session.get('not-exist', 'default')).toBe('default');
    session.endSession();
  });

  test('long-term-memory 导出 LongTermMemory', () => {
    const { LongTermMemory } = require('../src/memory/long-term-memory.js');
    expect(LongTermMemory).toBeDefined();
    expect(typeof LongTermMemory).toBe('function');
  });

  test('cross-session-index 导出 CrossSessionIndex', () => {
    const { CrossSessionIndex } = require('../src/memory/cross-session-index.js');
    expect(CrossSessionIndex).toBeDefined();
    expect(typeof CrossSessionIndex).toBe('function');
  });

  test('forgetting 模块导出具名函数', () => {
    const mod = require('../src/memory/forgetting.js');
    expect(mod).toBeDefined();
    // 应导出至少一个函数（forget 或 preserveStructure）
    const exportedNames = Object.keys(mod);
    expect(exportedNames.length).toBeGreaterThan(0);
  });

  test('project-context 导出 ProjectContext', () => {
    const { ProjectContext } = require('../src/memory/project-context.js');
    expect(ProjectContext).toBeDefined();
    expect(typeof ProjectContext).toBe('function');
  });

  test('meaningful-memory 导出 MeaningfulMemory', () => {
    const { MeaningfulMemory } = require('../src/memory/meaningful-memory.js');
    expect(MeaningfulMemory).toBeDefined();
    expect(typeof MeaningfulMemory).toBe('function');
  });

  test('knowledge-graph 导出 KnowledgeGraph', () => {
    const { KnowledgeGraph } = require('../src/memory/knowledge-graph.js');
    expect(KnowledgeGraph).toBeDefined();
    expect(typeof KnowledgeGraph).toBe('function');
  });

  test('retrieval-anchor 导出 RetrievalAnchor', () => {
    const { RetrievalAnchor } = require('../src/memory/retrieval-anchor.js');
    expect(RetrievalAnchor).toBeDefined();
    expect(typeof RetrievalAnchor).toBe('function');
  });
});

// ============================================================
// 5. 跨模块集成测试
// ============================================================
describe('跨模块集成', () => {
  test('所有修复过的模块应能同时加载不冲突', () => {
    expect(() => {
      require('../src/utils/atomic-write.js');
      require('../src/identity/identity-rules.js');
      require('../src/identity/self-verifier.js');
      require('../src/planner/strategy-selector.js');
      require('../src/planner/replan-trigger.js');
      require('../src/planner/adaptive-planner.js');
      require('../src/memory/session-memory.js');
      require('../src/memory/cross-session-index.js');
      require('../src/memory/long-term-memory.js');
      require('../src/memory/project-context.js');
      require('../src/memory/forgetting.js');
    }).not.toThrow();
  });
});
