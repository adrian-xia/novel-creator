import { NextResponse } from 'next/server';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3001';

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

function readStringList(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .map((value) => String(value))
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function readOptionalNumber(formData: FormData, key: string) {
  const raw = readString(formData, key);

  if (raw.length === 0) {
    return null;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function readBoolean(formData: FormData, key: string) {
  return readString(formData, key) === 'true';
}

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await context.params;
  const formData = await request.formData();
  const startChapter = readOptionalNumber(formData, 'replanRangeStartChapter');
  const endChapter = readOptionalNumber(formData, 'replanRangeEndChapter');

  const upstream = await fetch(`${API_BASE_URL}/decision-sessions/${sessionId}/resolve`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      resolutionType: readString(formData, 'resolutionType'),
      decisionSummary: readString(formData, 'decisionSummary'),
      storyFactsToApply: readStringList(formData, 'storyFactsToApply'),
      chapterPlanAdjustments: readStringList(formData, 'chapterPlanAdjustments'),
      volumeImpact: readString(formData, 'volumeImpact') || null,
      nextAction: readString(formData, 'nextAction'),
      replanRange:
        startChapter !== null && endChapter !== null
          ? { startChapter, endChapter }
          : null,
      resumeFromChapter: readOptionalNumber(formData, 'resumeFromChapter'),
      invalidateExistingPlans: readBoolean(formData, 'invalidateExistingPlans')
    })
  });

  return NextResponse.redirect(new URL(`/decision-sessions/${sessionId}`, request.url), {
    status: upstream.ok ? 303 : 302
  });
}
