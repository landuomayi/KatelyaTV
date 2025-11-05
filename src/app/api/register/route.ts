/* eslint-disable no-console,@typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';
import { db } from '@/lib/db';

export const runtime = 'edge';

// 读取存储类型环境变量，默认 localstorage
const STORAGE_TYPE =
  (process.env.NEXT_PUBLIC_STORAGE_TYPE as
    | 'localstorage'
    | 'redis'
    | 'd1'
    | 'upstash'
    | undefined) || 'localstorage';

// 生成签名（同步版本）
function generateSignature(
  data: string,
  secret: string
): string {
  // 简单的哈希实现，确保同步执行
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 转换为32位整数
  }
  
  // 添加密钥混合
  for (let i = 0; i < secret.length; i++) {
    const char = secret.charCodeAt(i);
    hash ^= char;
    hash = ((hash << 7) | (hash >>> 25)) * 31;
    hash = hash & hash; // 保持为32位整数
  }
  
  // 转换为十六进制字符串
  return Math.abs(hash).toString(16);
}

// 生成认证Cookie（带签名）
function generateAuthCookie(username: string): string {
  const authData: any = {
    role: 'user',
    username,
    timestamp: Date.now(),
  };

  // 使用process.env.AUTH_PASSWORD作为签名密钥，而不是用户密码
  const signingKey = process.env.AUTH_PASSWORD || '';
  const signature = generateSignature(username, signingKey);
  authData.signature = signature;

  return encodeURIComponent(JSON.stringify(authData));
}

export async function POST(req: NextRequest) {
  try {
    // localstorage 模式下不支持注册
    if (STORAGE_TYPE === 'localstorage') {
      return NextResponse.json(
        { error: '当前模式不支持注册' },
        { status: 400 }
      );
    }

    const config = await getConfig();
    // 校验是否开放注册
    if (!config.UserConfig.AllowRegister) {
      return NextResponse.json({ error: '当前未开放注册' }, { status: 400 });
    }

    const { username, password } = await req.json();

    if (!username || typeof username !== 'string') {
      return NextResponse.json({ error: '用户名不能为空' }, { status: 400 });
    }
    if (!password || typeof password !== 'string') {
      return NextResponse.json({ error: '密码不能为空' }, { status: 400 });
    }

    // 检查是否和管理员重复
    if (username === process.env.USERNAME) {
      return NextResponse.json({ error: '用户已存在' }, { status: 400 });
    }

    try {
      // 检查用户是否已存在
      const exist = await db.checkUserExist(username);
      if (exist) {
        return NextResponse.json({ error: '用户已存在' }, { status: 400 });
      }

      await db.registerUser(username, password);

      // 添加到配置中并保存
      config.UserConfig.Users.push({
        username,
        role: 'user',
      });
      await db.saveAdminConfig(config);

      // 注册成功，设置认证cookie
      const response = NextResponse.json({ ok: true });
      const cookieValue = generateAuthCookie(username);
      const expires = new Date();
      expires.setDate(expires.getDate() + 7); // 7天过期

      response.cookies.set('auth', cookieValue, {
        path: '/',
        expires,
        sameSite: 'lax', // 改为 lax 以支持 PWA
        httpOnly: false, // PWA 需要客户端可访问
        secure: false, // 根据协议自动设置
      });

      return response;
    } catch (err) {
      console.error('数据库注册失败', err);
      return NextResponse.json({ error: '数据库错误' }, { status: 500 });
    }
  } catch (error) {
    console.error('注册接口异常', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
