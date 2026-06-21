#!/usr/bin/env node
/**
 * Clarity 集成测试套件
 * 运行方式: node tests/integration.test.js
 * 也可通过 Jest 运行（npm run test:jest）
 */
const { Clarity } = require('../src/core/clarity.js');

// 初始化
const hf = new Clarity();
hf.start();

describe('Clarity 集成测试', () => {
  test('心虫启动', () => {
    expect(hf.started).toBe(true);
  });

  test('6+核心模块注册', () => {
    expect(Object.keys(hf._modules).length).toBeGreaterThanOrEqual(6);
  });

  test('sessionId存在', () => {
    expect(typeof hf.sessionId).toBe('string');
    expect(hf.sessionId.startsWith('session-')).toBe(true);
  });

  test('truth.checkStatement路由', async () => {
    await expect(hf.dispatch('truth.checkStatement', '测试')).resolves.toBeDefined();
  });

  test('emotion.process路由', async () => {
    const r = await hf.dispatch('emotion.process', '我很开心');
    expect(r).toBeDefined();
    expect(r.pad).toBeDefined();
    expect(typeof r.pad.pleasure).toBe('number');
  });

  test('psychology.analyzePsychology路由', async () => {
    const r = await hf.dispatch('psychology.analyzePsychology', '我感到焦虑');
    expect(r).toBeDefined();
    expect(r.emotion).toBeDefined();
    expect(typeof r.emotion.pleasure).toBe('number');
  });

  test('lesson.getTopLessons路由', async () => {
    const r = await hf.dispatch('lesson.getTopLessons', 3);
    expect(Array.isArray(r)).toBe(true);
  });

  test('heartLogic.whatIsThis路由', async () => {
    const r = await hf.dispatch('heartLogic.whatIsThis', '帮助');
    expect(r).toBeDefined();
    expect(typeof r.isRushing).toBe('boolean');
  });

  test('restraint.shouldIntervene路由', async () => {
    const r = await hf.dispatch('restraint.shouldIntervene', '如何伤害自己');
    expect(r).toBeDefined();
    expect(typeof r.shouldAnswer).toBe('boolean');
  });

  test('decision.decide路由', async () => {
    const r = await hf.dispatch('decision.decide', { task: '选择', options: ['A', 'B'] });
    expect(r).toBeDefined();
    expect(typeof r.reasoning).toBe('string');
  });

  test('confidence.calibrate路由', async () => {
    const r = await hf.dispatch('confidence.calibrate', '这是一个测试输入');
    expect(r).toBeDefined();
    expect(typeof r.confidence).toBe('object');
    expect(typeof r.confidence.calibrated).toBe('number');
  });
});
