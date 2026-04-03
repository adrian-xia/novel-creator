import { NextResponse } from 'next/server';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3001';

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await context.params;
  const formData = await request.formData();
  const content = String(formData.get('content') ?? '');

  const upstream = await fetch(`${API_BASE_URL}/decision-sessions/${sessionId}/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ content })
  });

  return NextResponse.redirect(new URL(`/decision-sessions/${sessionId}`, request.url), {
    status: upstream.ok ? 303 : 302
  });
}
