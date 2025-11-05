#!/usr/bin/env node

/**
 * 修复API路由文件中的edge runtime配置
 * 移除所有export const runtime = 'edge'声明，使其使用默认的server runtime
 * 以兼容OpenNext构建流程
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('=== 开始修复API路由文件中的edge runtime配置 ===');

const API_DIR = path.join(process.cwd(), 'src', 'app', 'api');
const EDGE_RUNTIME_REGEX = /export const runtime = 'edge';/g;

let filesToFix = [];

// 递归查找所有使用了edge runtime的文件
function findFilesWithEdgeRuntime(directory) {
  const files = fs.readdirSync(directory);
  
  files.forEach(file => {
    const filePath = path.join(directory, file);
    const stats = fs.statSync(filePath);
    
    if (stats.isDirectory()) {
      findFilesWithEdgeRuntime(filePath);
    } else if (file === 'route.ts' || file === 'route.js') {
      const content = fs.readFileSync(filePath, 'utf8');
      if (EDGE_RUNTIME_REGEX.test(content)) {
        filesToFix.push(filePath);
      }
    }
  });
}

// 修复文件中的edge runtime配置
function fixEdgeRuntime(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // 替换edge runtime配置为注释
    content = content.replace(EDGE_RUNTIME_REGEX, '// 移除edge runtime配置，使用默认的server runtime以兼容OpenNext构建');
    
    // 写回文件
    fs.writeFileSync(filePath, content, 'utf8');
    
    console.log(`✓ 已修复: ${path.relative(process.cwd(), filePath)}`);
    return true;
  } catch (error) {
    console.error(`❌ 修复失败: ${path.relative(process.cwd(), filePath)}`, error.message);
    return false;
  }
}

// 主函数
function main() {
  try {
    // 查找所有需要修复的文件
    console.log('正在查找使用edge runtime的API路由文件...');
    findFilesWithEdgeRuntime(API_DIR);
    
    console.log(`找到 ${filesToFix.length} 个需要修复的文件`);
    
    if (filesToFix.length === 0) {
      console.log('没有找到需要修复的文件，所有API路由已经兼容OpenNext');
      return;
    }
    
    // 修复文件
    console.log('开始修复文件...');
    let successCount = 0;
    let failCount = 0;
    
    filesToFix.forEach(filePath => {
      if (fixEdgeRuntime(filePath)) {
        successCount++;
      } else {
        failCount++;
      }
    });
    
    console.log('\n=== 修复完成 ===');
    console.log(`成功修复: ${successCount} 个文件`);
    console.log(`修复失败: ${failCount} 个文件`);
    
    console.log('\n提示:');
    console.log('1. 所有API路由现在使用默认的server runtime');
    console.log('2. 这将确保与OpenNext构建流程兼容');
    console.log('3. 建议在部署前运行测试构建脚本验证修复效果');
    console.log('   node scripts/test-build-compatibility.js');
  } catch (error) {
    console.error('修复过程中发生错误:', error.message);
    process.exit(1);
  }
}

// 运行主函数
main();