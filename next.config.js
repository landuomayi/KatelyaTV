/** @type {import('next').NextConfig} */
/* eslint-disable @typescript-eslint/no-var-requires */
const nextConfig = {
  output: 'standalone',
  eslint: {
    dirs: ['src'],
  },

  reactStrictMode: false,
  swcMinify: true,

  // Uncoment to add domain whitelist
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },

  webpack(config) {
    // Grab the existing rule that handles SVG imports
    const fileLoaderRule = config.module.rules.find((rule) =>
      rule.test?.test?.('.svg')
    );

    config.module.rules.push(
      // Reapply the existing rule, but only for svg imports ending in ?url
      {
        ...fileLoaderRule,
        test: /\.svg$/i,
        resourceQuery: /url/, // *.svg?url
      },
      // Convert all other *.svg imports to React components
      {
        test: /\.svg$/i,
        issuer: { not: /\.(css|scss|sass)$/ },
        resourceQuery: { not: /url/ }, // exclude if *.svg?url
        loader: '@svgr/webpack',
        options: {
          dimensions: false,
          titleProp: true,
        },
      }
    );

    // Modify the file loader rule to ignore *.svg, since we have it handled now.
    fileLoaderRule.exclude = /\.svg$/i;

    // 更激进的webpack配置来阻止async_hooks导入
    // 1. 添加一个空模块别名
    config.resolve.alias = {
      ...config.resolve.alias,
      // 对async_hooks使用一个空模块
      'async_hooks': false,
      'node:async_hooks': false,
      // 阻止任何包含async_hooks的路径
      'async_hooks/': false,
      'node:async_hooks/': false,
    };

    // 2. 添加一个解析插件来拦截所有async_hooks相关的导入
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

    // 3. 配置模块规则来忽略async_hooks
    config.module.rules.push({
      test: /async_hooks/, // 匹配任何包含async_hooks的路径
      use: 'null-loader', // 使用null-loader来返回空模块
    });

    // 4. 配置fallback选项
    config.resolve.fallback = {
      ...config.resolve.fallback,
      // 设置所有Node.js核心模块为false或适当的替代品
      net: false,
      tls: false,
      crypto: false,
      async_hooks: false,
      fs: false,
      path: false,
      os: false,
      stream: false,
      http: false,
      https: false,
    };

    // 5. 配置ignoreWarnings来忽略async_hooks相关的警告
    config.ignoreWarnings = [
      /Cannot find module 'async_hooks'/,
      /Module not found: Error: Can't resolve 'async_hooks'/,
      /Module not found: Error: Can't resolve 'node:async_hooks'/,
    ];

    return config;
  },
};

const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
});

module.exports = withPWA(nextConfig);
