import { NextResponse } from 'next/server';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3001';

export async function POST(request: Request) {
  const formData = await request.formData();
  const projectId = String(formData.get('projectId') ?? '');
  const format = String(formData.get('format') ?? 'markdown');
  const chapterNumbers = formData
    .getAll('chapterNumber')
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  const upstream = await fetch(`${API_BASE_URL}/projects/${projectId}/exports`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chapterNumbers, format })
  });

  return new NextResponse(await upstream.arrayBuffer(), {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') ?? 'application/octet-stream',
      'content-disposition': upstream.headers.get('content-disposition') ?? 'attachment'
    }
  });
}
