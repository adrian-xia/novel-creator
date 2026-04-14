import { NextResponse } from 'next/server';
import { API_BASE_URL } from '../../../../lib/api';

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;

  await fetch(`${API_BASE_URL}/projects/${projectId}/continue`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({})
  });

  return NextResponse.redirect(new URL(`/projects/${projectId}`, request.url), {
    status: 303
  });
}
