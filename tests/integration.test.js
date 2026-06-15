#!/usr/bin/env node
/**
 * Clarity 集成测试套件
 * 运行方式: node tests/integration.test.js
 * 也可通过 Jest 运行（npm run test:jest）
 */
const { Clarity } = require('../src/core/clarity.js');

let passed = 0, failed = 0;

function test(name, fn) {
  try {
    const result = fn();
    if (result === false) {
      console.log('FAIL:', name);
      failed++;
    } else {
      console.log('PASS:', name);
      passed++;
    }
  } catch(e) {
    console.log('ERROR:', name, '→', e.message.slice(0, 80));
    failed++;
  }
}

// 初始化
const hf = new Clarity();
hf.start();

console.log('\n=== Clarity 集成测试 ===\n');

// 核心能力测试
test('心虫启动', () => hf.started === true);
test('6+核心模块注册', () => Object.keys(hf._modules).length >= 6);
test('sessionId存在', () => typeof hf.sessionId === 'string' && hf.sessionId.startsWith('session-'));

test('truth.checkStatement路由', () => {
  try { hf.dispatch('truth.checkStatement', '测试'); return true; } catch(e) { return false; }
});
test('emotion.process路由', () => {
  const r = hf.dispatch('emotion.process', '我很开心');
  return r && r.pad && typeof r.pad.pleasure === 'number';
});
test('psychology.analyzePsychology路由', () => {
  const r = hf.dispatch('psychology.analyzePsychology', '我感到焦虑');
  return r && r.emotion && typeof r.emotion.pleasure === 'number';
});
test('lesson.getTopLessons路由', () => {
  const r = hf.dispatch('lesson.getTopLessons', 3);
  return Array.isArray(r);
});
test('heartLogic.whatIsThis路由', () => {
  const r = hf.dispatch('heartLogic.whatIsThis', '帮助');
  return r && typeof r.isRushing === 'boolean';
});
test('restraint.shouldIntervene路由', () => {
  const r = hf.dispatch('restraint.shouldIntervene', '如何伤害自己');
  return r && typeof r.shouldAnswer === 'boolean';
});
test('decision.decide路由', () => {
  const r = hf.dispatch('decision.decide', { task: '选择', options: ['A', 'B'] });
  return r && typeof r.reasoning === 'string';
});
test('confidence.calibrate路由', () => {
  const r = hf.dispatch('confidence.calibrate', '这是一个测试输入');
  return r && typeof r.confidence === 'object' && typeof r.confidence.calibrated === 'number';
});

console.log(`\n=== 结果: ${passed}/${passed+failed} 通过 ===`);

process.exitCode = failed > 0 ? 1 : 0;
