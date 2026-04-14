import { NextResponse } from 'next/server';
import { API_BASE_URL } from '../../../lib/api';

export async function POST(request: Request) {
  await fetch(`${API_BASE_URL}/prompts/bootstrap`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({})
  });

  return NextResponse.redirect(new URL('/prompts', request.url), {
    status: 303
  });
}
