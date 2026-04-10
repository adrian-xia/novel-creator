import { NextResponse } from 'next/server';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3001';

async function readErrorMessage(response: Response) {
  try {
    const body = await response.json() as { message?: unknown };

    if (typeof body.message === 'string' && body.message.trim().length > 0) {
      return body.message;
    }
  } catch {
    // Fall back to a generic message when the upstream body is not JSON.
  }

  return 'Failed to cancel gate';
}

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await context.params;
  try {
    const upstream = await fetch(`${API_BASE_URL}/decision-sessions/${sessionId}/cancel`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({})
    });

    const target = upstream.ok
      ? new URL('/decision-sessions', request.url)
      : new URL(`/decision-sessions/${sessionId}`, request.url);

    if (!upstream.ok) {
      target.searchParams.set('error', await readErrorMessage(upstream));
    }

    return NextResponse.redirect(target, {
      status: upstream.ok ? 303 : 302
    });
  } catch {
    const target = new URL(`/decision-sessions/${sessionId}`, request.url);
    target.searchParams.set('error', 'Failed to reach gate cancellation service');

    return NextResponse.redirect(target, { status: 302 });
  }
}
