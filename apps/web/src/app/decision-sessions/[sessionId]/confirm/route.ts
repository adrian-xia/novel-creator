import { NextResponse } from 'next/server';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3001';

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

async function readErrorMessage(response: Response) {
  try {
    const body = await response.json() as { message?: unknown };

    if (typeof body.message === 'string' && body.message.trim().length > 0) {
      return body.message;
    }
  } catch {
    // Fall back to a generic message when the upstream body is not JSON.
  }

  return 'Failed to confirm gate';
}

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await context.params;
  const formData = await request.formData();
  const target = new URL(`/decision-sessions/${sessionId}`, request.url);

  try {
    const upstream = await fetch(`${API_BASE_URL}/decision-sessions/${sessionId}/confirm`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        selectedOptionId: readString(formData, 'selectedOptionId'),
        humanNotes: readString(formData, 'humanNotes') || null
      })
    });

    if (!upstream.ok) {
      target.searchParams.set('error', await readErrorMessage(upstream));
    }

    return NextResponse.redirect(target, {
      status: upstream.ok ? 303 : 302
    });
  } catch {
    target.searchParams.set('error', 'Failed to reach gate confirmation service');

    return NextResponse.redirect(target, { status: 302 });
  }
}
