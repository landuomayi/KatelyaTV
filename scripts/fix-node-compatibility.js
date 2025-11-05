#!/usr/bin/env node

/**
 * Cloudflare Pages Node.js版本兼容性修复脚本
 * 用于解决undici版本与Node.js 20.10.0的兼容性问题
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('=== KatelyaTV Node.js兼容性修复脚本 ===');
console.log('此脚本将帮助修复Cloudflare Pages部署时的Node.js版本兼容性问题');
console.log('目标: 锁定undici版本为5.28.4，兼容Node.js 20.10.0\n');

try {
  // 检查pnpm是否安装
  console.log('检查pnpm是否安装...');
  execSync('pnpm --version', { stdio: 'pipe' });
  
  // 清理node_modules和现有的锁文件
  console.log('清理现有依赖...');
  if (fs.existsSync(path.join(process.cwd(), 'node_modules'))) {
    console.log('删除node_modules目录...');
    fs.rmSync(path.join(process.cwd(), 'node_modules'), { recursive: true, force: true });
  }
  
  // 重新安装依赖并锁定undici版本
  console.log('重新安装依赖并锁定undici版本...');
  execSync('pnpm install', { stdio: 'inherit' });
  
  // 显式添加undici@5.28.4
  console.log('锁定undici版本为5.28.4...');
  execSync('pnpm add undici@5.28.4 --save-exact --save-peer', { stdio: 'inherit' });
  
  // 验证undici版本
  console.log('\n验证undici版本...');
  const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
  if (packageJson.resolutions && packageJson.resolutions.undici === '5.28.4') {
    console.log('✓ package.json中的resolutions已正确设置undici版本为5.28.4');
  } else {
    console.log('⚠ 请确保package.json中的resolutions正确设置了undici版本');
  }
  
  console.log('\n=== 兼容性修复完成 ===');
  console.log('现在可以使用以下命令进行Cloudflare Pages构建:');
  console.log('  pnpm run pages:build:cf-compat');
  console.log('或直接推送到GitHub让Cloudflare Pages自动构建');
  
} catch (error) {
  console.error('\n❌ 执行过程中出现错误:', error.message);
  console.error('请确保您有足够的权限，并且pnpm已正确安装');
  console.error('您也可以手动执行以下命令来解决问题:');
  console.error('  1. pnpm install');
  console.error('  2. pnpm add undici@5.28.4 --save-exact --save-peer');
  process.exit(1);
}