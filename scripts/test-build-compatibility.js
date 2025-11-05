#!/usr/bin/env node

/**
 * Cloudflare Pages构建兼容性测试脚本
 * 用于验证修复后的构建是否能在Node.js 20.10.0环境下正常工作
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('=== KatelyaTV构建兼容性测试脚本 ===');
console.log('此脚本将测试项目是否能在类似Cloudflare Pages的环境中成功构建');
console.log('目标: 验证在Node.js 20.x环境下的构建兼容性\n');

try {
  // 检查Node.js版本
  console.log('检查当前Node.js版本...');
  const nodeVersion = execSync('node -v').toString().trim();
  console.log(`当前Node.js版本: ${nodeVersion}`);
  
  // 检查项目依赖
  console.log('\n检查项目依赖...');
  if (!fs.existsSync(path.join(process.cwd(), 'node_modules'))) {
    console.log('未找到node_modules，正在安装依赖...');
    execSync('pnpm install --frozen-lockfile', { stdio: 'inherit' });
  }
  
  // 执行兼容性构建测试
  console.log('\n执行兼容性构建测试...');
  console.log('使用pages:build:cf-compat脚本进行构建...');
  
  // 记录开始时间
  const startTime = Date.now();
  
  // 执行构建命令
  execSync('pnpm run pages:build:cf-compat', { stdio: 'inherit' });
  
  // 计算构建时间
  const buildTime = Math.round((Date.now() - startTime) / 1000);
  
  // 验证构建输出
  console.log('\n验证构建输出...');
  const outputDir = path.join(process.cwd(), '.vercel/output/static');
  
  if (fs.existsSync(outputDir) && fs.readdirSync(outputDir).length > 0) {
    console.log(`✓ 构建成功! 输出目录: ${outputDir}`);
    console.log(`✓ 构建用时: ${buildTime}秒`);
    
    // 检查关键文件是否存在
    const importantFiles = ['index.html', '_next', 'sw.js'];
    importantFiles.forEach(file => {
      const filePath = path.join(outputDir, file);
      if (fs.existsSync(filePath)) {
        console.log(`  ✓ 找到 ${file}`);
      } else {
        console.log(`  ⚠ 未找到 ${file}`);
      }
    });
    
    console.log('\n=== 构建兼容性测试通过 ===');
    console.log('项目应该可以在Cloudflare Pages上成功部署。');
    console.log('建议的部署步骤:');
    console.log('  1. 确保package.json中的resolutions正确锁定了undici版本');
    console.log('  2. 确保wrangler.toml使用了正确的构建命令');
    console.log('  3. 将代码推送到GitHub仓库');
    console.log('  4. Cloudflare Pages将自动使用配置的命令进行构建');
  } else {
    console.error('❌ 构建输出目录为空或不存在');
    process.exit(1);
  }
  
} catch (error) {
  console.error('\n❌ 构建测试失败:', error.message);
  console.error('\n故障排查建议:');
  console.error('  1. 确保已运行兼容性修复脚本: node scripts/fix-node-compatibility.js');
  console.error('  2. 检查package.json中的resolutions配置');
  console.error('  3. 确保依赖已正确安装: pnpm install --frozen-lockfile');
  console.error('  4. 尝试使用不同的构建脚本: pnpm run pages:build:cf');
  process.exit(1);
}