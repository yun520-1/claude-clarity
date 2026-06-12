/**
 * Clarity 核心模块单元测试
 *
 * 测试引擎启动、基本感知能力和核心路由
 */
const { createClarity } = require('../../src/core/clarity.js');

describe('Clarity 核心引擎', () => {
  let clarity;

  beforeAll(async () => {
    clarity = createClarity({ rootPath: __dirname + '/../..' });
    clarity.start();
  });

  afterAll(() => {
    clarity.shutdown();
  });

  test('引擎启动后应存活', () => {
    expect(clarity.heartLogic.isAlive()).toBe(true);
  });

  test('应有自我意识', () => {
    const result = clarity.heartLogic.isAware();
    expect(result).toBeDefined();
    expect(result.result).toBe(true);
  });

  test('应有进化能力', () => {
    const result = clarity.heartLogic.isEvolving();
    expect(result).toBeDefined();
    expect(result.result).toBe(true);
  });

  test('dispatch 应支持 truth.checkStatement 路由', () => {
    const result = clarity.dispatch('truth.checkStatement', '测试陈述');
    expect(result).toBeDefined();
  });

  test('健康检查应返回完整状态', () => {
    const health = clarity.healthCheck();
    expect(health).toBeDefined();
    expect(health.started).toBe(true);
    expect(health.version).toBeDefined();
  });
});
