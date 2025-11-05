/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';

// 移除edge runtime配置，使用默认的server runtime以兼容OpenNext构建

export async function GET() {
  try {
    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      runtime: 'edge',
      storageType: process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage',
      hasDB: !!(globalThis as any).DB,
      nodeEnv: process.env.NODE_ENV
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Debug failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
