import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const key = process.env.OPENROUTER_API_KEY;

  if (!key) {
    return NextResponse.json({
      status: 'error',
      message: 'OPENROUTER_API_KEY not set',
    });
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
        'HTTP-Referer': 'https://luxury-lebkuchen-6d1677.netlify.app',
        'X-Title': 'Wayfarer',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-haiku-4.5',
        max_tokens: 20,
        messages: [{ role: 'user', content: 'Reply with only the word "connected"' }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({
        status: 'error',
        http_status: response.status,
        error: data.error || data,
        key_prefix: key.substring(0, 12) + '...',
      });
    }

    return NextResponse.json({
      status: 'ok',
      model: data.model,
      reply: data.choices?.[0]?.message?.content,
      usage: data.usage,
    });
  } catch (err: unknown) {
    return NextResponse.json({
      status: 'error',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
}
