/**
 * 真实性核查模块测试
 *
 * 测试 truth 模块的 dispatch 路由功能
 */
const { createClarity } = require('../../src/core/clarity.js');

describe('TruthChecker 真实性核查', () => {
  let clarity;

  beforeAll(async () => {
    clarity = createClarity({ rootPath: __dirname + '/../..' });
    clarity.start();
  });

  afterAll(() => {
    clarity.shutdown();
  });

  test('应能判断陈述真实性', () => {
    const result = clarity.dispatch('truth.checkStatement', '2+2=4');
    expect(result).toBeDefined();
  });

  test('dispatch 应返回标准格式', () => {
    const result = clarity.dispatch('truth.checkStatement', '地球是平的');
    expect(result).toBeDefined();
  });
});
