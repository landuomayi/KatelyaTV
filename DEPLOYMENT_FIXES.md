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

## 推荐的Cloudflare Pages构建配置

在Cloudflare Pages控制台中设置以下构建配置：

- **构建命令**: `pnpm install --frozen-lockfile && pnpm run pages:build:full`
- **构建输出目录**: `.vercel/output/static`
- **Node.js 版本**: `20.x`

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