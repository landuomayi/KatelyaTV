# 部署问题修复记录

## 问题1：无限递归构建循环

**问题描述：**
部署日志显示OpenNext构建命令在无限递归调用自己，导致构建过程永远不会完成。

**根本原因：**
当`build`脚本被设置为`npx open-next@latest build`时，OpenNext内部会再次调用项目的`build`脚本，从而形成无限循环。

**解决方案：**
1. 将默认`build`脚本恢复为标准的`next build`
2. 为`pages:build`命令添加`--skip-build`参数，防止OpenNext再次调用构建脚本
3. 添加专门的`pages:build:full`命令，组合执行构建和转换步骤

```json
"scripts": {
  "build": "next build",
  "pages:build": "npx open-next@latest build --skip-build",
  "pages:build:full": "npm run build && npm run pages:build"
}
```

## 问题2：wrangler.toml配置错误

**问题描述：**
Cloudflare Pages部署失败，报错"Configuration file for Pages projects does not support 'build'"和"Unexpected fields found in top-level field: 'functions'"。

**根本原因：**
Cloudflare Pages的wrangler.toml配置不支持某些顶级配置项。

**解决方案：**
1. 移除不支持的`[functions]`和`[build]`配置块
2. 根据部署文档更新输出目录配置

```toml
# 修改前
pages_build_output_dir = "__next-on-pages-dist__"

# 修改后
pages_build_output_dir = ".vercel/output/static"
```

## 问题3：Webpack钩子配置错误

**问题描述：**
Next.js 14.2.30使用的Webpack版本将`NormalModuleFactory.beforeResolve`钩子从waterfall钩子更改为bailing钩子，导致原有的BlockAsyncHooks插件配置不再兼容。错误信息为：
```
NormalModuleFactory.beforeResolve (NormalModuleReplacementPlugin, IgnorePlugin, IgnorePlugin, BlockAsyncHooks) is no longer a waterfall hook, but a bailing hook instead. Do not return the passed object, but modify it instead.
```

**根本原因：**
Webpack钩子API变更导致插件配置不兼容。

**解决方案：**
更新next.config.js中的BlockAsyncHooks插件配置，按照bailing钩子的要求修改：

```javascript
config.plugins.push({
  apply: (compiler) => {
    compiler.hooks.normalModuleFactory.tap('BlockAsyncHooks', (nmf) => {
      nmf.hooks.beforeResolve.tap('BlockAsyncHooks', (resolveData) => {
        // 检查是否尝试导入async_hooks相关模块
        if (resolveData.request && 
            (resolveData.request === 'async_hooks' || 
             resolveData.request.startsWith('async_hooks/') ||
             resolveData.request === 'node:async_hooks' ||
             resolveData.request.startsWith('node:async_hooks/'))) {
          // 对于bailing钩子，返回false来忽略该请求
          return false;
        }
        // 对于bailing钩子，不返回修改后的对象，直接修改它
      });
    });
  }
});
```

## 问题4：Node.js版本兼容性问题

**问题描述：**
部署失败，出现`undici@7.14.0`需要`node >=20.18.1`的错误，但Cloudflare Pages环境使用的是`node v20.10.0`。

**根本原因：**
最新版本的依赖包（特别是undici）与Cloudflare Pages提供的Node.js v20.10.0版本不兼容。

**解决方案：**
1. 在package.json中添加resolutions字段，明确锁定undici版本为5.28.4，该版本与Node.js v20.10.0完全兼容
2. 更新构建脚本，添加专门的Cloudflare兼容构建脚本
3. 在wrangler.toml中指定正确的构建命令
4. 创建辅助脚本确保依赖正确安装和锁定

### 具体修改

**package.json中的更新：**
```json
{
  "scripts": {
    "build": "next build",
    "pages:build": "npx open-next@3.1.3 build --skip-build",
    "pages:build:full": "npm run build && npm run pages:build",
    "pages:build:cf-compat": "npm run build && npx open-next@3.1.3 build --skip-build --experimental-minify",
    "fix:undici": "pnpm add undici@5.28.4"
  },
  "resolutions": {
    "undici": "5.28.4"
  }
}
```

**wrangler.toml中的更新：**
```toml
# 指定Cloudflare Pages使用的构建命令
pages_build_command = "pnpm install --frozen-lockfile && pnpm run pages:build:cf-compat"
```

### 辅助脚本

我们创建了两个辅助脚本，帮助确保构建兼容性：

1. **fix-node-compatibility.js**: 用于清理和重新安装依赖，并确保undici版本正确锁定
   ```bash
   node scripts/fix-node-compatibility.js
   ```

2. **test-build-compatibility.js**: 用于在本地测试构建兼容性
   ```bash
   node scripts/test-build-compatibility.js
   ```

这些脚本提供了自动化的方式来解决和验证Node.js版本兼容性问题。

## 推荐的Cloudflare Pages构建配置

### 配置1：使用兼容性构建脚本（推荐）
在Cloudflare Pages控制台中使用以下构建配置：
- 构建命令：`pnpm install --frozen-lockfile && pnpm run pages:build:cf-compat`
- 输出目录：`.vercel/output/static`
- 环境：Node.js 20.x

### 配置2：使用OpenNext构建
- 构建命令：`pnpm install --frozen-lockfile && pnpm run pages:build:full`
- 输出目录：`.vercel/output/static`
- 环境：Node.js 20.x

### 本地验证步骤
在部署到Cloudflare Pages之前，建议先在本地验证构建兼容性：
1. 运行兼容性修复脚本：`node scripts/fix-node-compatibility.js`
2. 运行构建测试脚本：`node scripts/test-build-compatibility.js`
3. 确保构建测试通过后再部署到生产环境

这两种配置都已针对Cloudflare Pages环境进行了优化，解决了版本兼容性问题。

请确保在部署前设置所有必要的环境变量，并按照文档中的配置进行操作。

## 环境变量要求

确保已设置以下关键环境变量：

- `USERNAME` (必需): 管理员用户名
- `AUTH_PASSWORD` (必需): 访问密码，**必须**设置为"Plain text"类型
- `NEXT_PUBLIC_STORAGE_TYPE`: 存储类型，推荐为`d1`
- `NEXT_PUBLIC_SITE_NAME`: 站点名称
- `NODE_ENV`: 生产环境设置为`production`

## 部署验证

部署后验证以下端点：

- `/api/server-config` - 服务器配置
- `/api/debug/env` - 环境变量检查（开发时）
- 主页 `/` - 前端页面

## 常见问题排查

1. **500错误**: 通常是环境变量缺失，特别是`USERNAME`和`AUTH_PASSWORD`
2. **构建失败**: 检查Node.js版本和依赖安装
3. **数据库错误**: 验证D1数据库绑定是否正确配置为`DB`

## 紧急恢复

如果部署失败，可以在Cloudflare Pages控制台中选择之前的工作版本进行回滚。