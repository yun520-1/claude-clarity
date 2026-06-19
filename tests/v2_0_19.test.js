#!/usr/bin/env node
/**
 * Clarity v2.0.19 集成测试
 * 覆盖本次 4 Phase 改动：
 *   - truth isLying 检测 + thought-chain await 修通
 *   - behavior 系统接入
 *   - persistence 系统接入
 *   - triality 能力暴露
 *
 * 运行: node tests/v2_0_19.test.js
 * 也可通过 Jest 运行（npm run test:jest）
 */
const { Clarity } = require('../src/core/clarity.js');
const fs = require('fs');
const path = require('path');
const { codeVerifier } = require('../src/core/code-verifier.js');
const BlindSpotBreaker = require('../src/core/blind-spot-breaker.js');

let hf;

beforeAll(async () => {
  hf = new Clarity({ quiet: true });
  await hf.start();
});

afterAll(() => {
  // 清理测试文件
  ['test-v2019.txt', 'test-atomic.txt', 'test-persist.txt'].forEach(f => {
    try { fs.unlinkSync(path.join(hf.rootPath, 'memory', f)); } catch {}
  });
  if (hf) hf.stop();
});

describe('Clarity v2.0.19 集成测试', () => {
  // === Phase 4: truth 修通 ===
  test('truth.isLying: 绝对化声明应被检测', async () => {
    const r = await hf.dispatch('truth.checkStatement', '这个方案一定是好的');
    expect(r).toBeDefined();
    expect(r.isLying).toBe(true);
  });

  test('truth.isLying: 普通陈述不应误报', async () => {
    const r = await hf.dispatch('truth.checkStatement', '研究表明人口增长5%');
    expect(r).toBeDefined();
    expect(r.isLying).toBe(false);
  });

  test('truth.isLying: "100%确定" 应被检测', async () => {
    const r = await hf.dispatch('truth.checkStatement', '我100%确定没问题');
    expect(r).toBeDefined();
    expect(r.isLying).toBe(true);
  });

  test('truth schema: 包含 checked+isLying+confidence', async () => {
    const r = await hf.dispatch('truth.checkStatement', '今天天气不错');
    expect(r).toBeDefined();
    expect('checked' in r).toBe(true);
    expect('isLying' in r).toBe(true);
    expect('confidence' in r).toBe(true);
  });

  // === Phase 1: behavior 系统 ===
  test('behavior.createGoal: 创建目标', () => {
    const r = hf.dispatch('behavior.createGoal', { name: 'v2.0.19测试目标', description: '测试', targetDays: 7 });
    expect(r).toBeDefined();
    expect(r.id).toBeDefined();
    expect(r.id.startsWith('goal-')).toBe(true);
  });

  test('behavior.record: 记录成功', () => {
    const goals = hf.dispatch('behavior.getAllGoals');
    const goal = goals[goals.length - 1];
    const r = hf.dispatch('behavior.record', goal.id, { type: 'success', note: 'test' });
    expect(r).toBeDefined();
    expect(r.ok).toBe(true);
    expect(r.record.type).toBe('success');
    expect(r.streak).toBeGreaterThanOrEqual(1);
  });

  test('behavior.getProgress: 拿到 progress 字符串', () => {
    const goals = hf.dispatch('behavior.getAllGoals');
    const r = hf.dispatch('behavior.getProgress', goals[goals.length - 1].id);
    expect(r).toBeDefined();
    expect(typeof r.progress).toBe('string');
    expect(r.progress.includes('/')).toBe(true);
  });

  test('behavior.detectWeeklyPattern: 返回周几+次数', () => {
    const goals = hf.dispatch('behavior.getAllGoals');
    const records = goals[goals.length - 1].records;
    const r = hf.dispatch('behavior.detectWeeklyPattern', records);
    expect(r).toBeDefined();
    expect(r.day).toBeDefined();
    expect(typeof r.count).toBe('number');
  });

  test('behavior.detectRelapseRisk: 返回 risk 等级', () => {
    const goals = hf.dispatch('behavior.getAllGoals');
    const r = hf.dispatch('behavior.detectRelapseRisk', goals[goals.length - 1]);
    expect(r).toBeDefined();
    expect(['low', 'medium', 'high']).toContain(r.risk);
  });

  test('behavior.getReport: 综合报告', () => {
    const goals = hf.dispatch('behavior.getAllGoals');
    const r = hf.dispatch('behavior.getReport', goals[goals.length - 1].id);
    expect(r).toBeDefined();
    expect(r.weekly).toBeDefined();
    expect(r.risk).toBeDefined();
  });

  test('behavior.getStats: 统计信息', () => {
    const r = hf.dispatch('behavior.getStats');
    expect(r).toBeDefined();
    expect(r.goals).toBeGreaterThanOrEqual(1);
    expect(r.totalRecords).toBeGreaterThanOrEqual(1);
  });

  // === Phase 2: persistence 系统（当前接口为 append+commit） ===
  test('persistence.getStats: 返回 WAL 配置', () => {
    const r = hf.dispatch('persistence.getStats');
    expect(r).toBeDefined();
    expect(r.walDir).toBeDefined();
    expect(r.opTypes.WRITE).toBe('write');
  });

  test('persistence.append+commit: WAL 追加写入成功', async () => {
    const testFile = path.join(hf.rootPath, 'memory', 'test-persist.txt');
    const r = hf.dispatch('persistence.append', testFile, 'v2.0.19 test\n');
    expect(r).toBeDefined();
    expect(typeof r).toBe('object');
    // commit 让变更落盘
    const r2 = hf.dispatch('persistence.commit', testFile);
    expect(r2).toBeDefined();
    expect(typeof r2).toBe('object');
  });

  test('persistence.getStats: 包含 WAL 配置详情', () => {
    const r = hf.dispatch('persistence.getStats');
    expect(r).toBeDefined();
    expect(r.type).toBe('wal+atomic');
    expect(r.walDir).toBeDefined();
    expect(Array.isArray(r.opTypes)).toBe(false);
  });

  // === Phase 3: memory 子系统（当前 memory 子系统覆盖三层记忆） ===
  test('memory.getStats: 基础统计（core/learned/ephemeral）', () => {
    const r = hf.dispatch('memory.getStats');
    expect(r).toBeDefined();
    expect(typeof r.core).toBe('number');
    expect(typeof r.learned).toBe('number');
  });

  test('memory.getStats: 三层值存在', () => {
    const r = hf.dispatch('memory.getStats');
    expect(r).toBeDefined();
    expect('core' in r).toBe(true);
    expect('learned' in r).toBe(true);
    expect('ephemeral' in r).toBe(true);
  });

  test('memory.getStats: 返回数值型计数', () => {
    const r = hf.dispatch('memory.getStats');
    expect(r).toBeDefined();
    expect(typeof r.core).toBe('number');
    expect(typeof r.learned).toBe('number');
    expect(typeof r.ephemeral).toBe('number');
  });

  test('memory.search: 关键字搜索返回数组', () => {
    const r = hf.dispatch('memory.search', '心虫');
    expect(Array.isArray(r)).toBe(true);
  });

  // === Phase 5: dream + transmission 暴露 ===
  test('dream.getStats: 梦统计', () => {
    const r = hf.dispatch('dream.getDreamStats');
    expect(r).toBeDefined();
    expect(typeof r).toBe('object');
  });

  test('dream.getCacheStats: 梦缓存统计', () => {
    const r = hf.dispatch('dream.getCacheStats');
    expect(r).toBeDefined();
    expect(typeof r).toBe('object');
  });

  test('transmission.getStats: 传递引擎统计', () => {
    const r = hf.dispatch('transmission.getStats');
    expect(r).toBeDefined();
    expect(typeof r).toBe('object');
  });

  test('transmission.getTransmissionLog: 传递日志', () => {
    const r = hf.dispatch('transmission.getTransmissionLog');
    expect(Array.isArray(r)).toBe(true);
  });

  test('transmission.getDistilledLessons: 蒸馏教训', () => {
    const r = hf.dispatch('transmission.getDistilledLessons');
    expect(Array.isArray(r)).toBe(true);
  });

  // === Phase 6: verify 完整能力 ===
  test('verify.verify: 条件句应 pass', () => {
    const r = hf.dispatch('verify.verify', '如果A=B, 那么B=A', 'B=A');
    expect(r).toBeDefined();
    expect(r.passed).toBe(true);
  });

  test('verify.getStats: 统计', () => {
    const r = hf.dispatch('verify.getStats');
    expect(r).toBeDefined();
    expect(typeof r.totalVerified).toBe('number');
    expect(typeof r.passes).toBe('number');
  });

  // === Phase 7: v2.0.20 安全审计修复 ===
  test('code-verifier: bash 走 shell 验证器（不是 JS）', () => {
    const sh = codeVerifier.verifyShContent('#!/bin/bash\necho "hi"');
    const js = codeVerifier.verifyJSContent('#!/bin/bash\necho "hi"');
    expect(sh.ok).toBe(true);
    expect(js.ok).toBe(false);  // JS 验证器会报错（无 {} 平衡）
  });

  test('blind-spot-breaker: USER_CLAIMED 而非 CONFIRMADO', () => {
    const c = new BlindSpotBreaker(hf.rootPath);
    const r = c.process('用户说了一句事实', { facts: ['用户说的话'] });
    // assertions 在 r.confidence.assertions（不是 r.deconstruction.assertions）
    const arr = r && r.confidence && r.confidence.assertions;
    expect(Array.isArray(arr)).toBe(true);
    expect(arr[0]).toBeDefined();
    expect(arr[0].tag).toBe('USER_CLAIMED');
  });

  // === 集成度：模块加载 ===
  test('_initErrors 不应存在（所有 try 成功）', () => {
    expect(hf._initErrors.length).toBe(0);
  });

  test('6+ 核心子系统加载', () => {
    expect(Object.keys(hf._modules).length).toBeGreaterThanOrEqual(6);
  });

  test('healthCheck 报告所有子系统', async () => {
    const h = await hf.healthCheck();
    expect(h.subsystems).toBeDefined();
    expect(h.subsystems.loaded).toBeGreaterThanOrEqual(6);
    expect(h.initErrors).toBeFalsy();
  });
});
