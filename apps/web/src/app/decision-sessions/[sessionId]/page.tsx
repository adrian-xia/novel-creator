import React from 'react';
import { getDecisionSessionDetail } from '../../../lib/api';

function readString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
}

function renderRepeatedInputs(name: string, values: string[]) {
  const entries = values.length > 0 ? values : [''];

  return entries.map((value, index) => (
    <input key={`${name}-${index}`} name={name} defaultValue={value} />
  ));
}

export default async function DecisionSessionPage({
  params
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const detail = await getDecisionSessionDetail(sessionId);

  if ('message' in detail) {
    return (
      <main>
        <h1>Decision Session</h1>
        <p>{detail.message}</p>
      </main>
    );
  }

  const draftResolution = detail.currentDraftResolution ?? {};
  const draftResolutionType = readString(draftResolution.resolutionType, 'accept_alternative');
  const draftDecisionSummary = readString(
    draftResolution.decisionSummary,
    detail.triggerReason ?? ''
  );
  const draftStoryFactsToApply = readStringArray(draftResolution.storyFactsToApply);
  const draftChapterPlanAdjustments = readStringArray(draftResolution.chapterPlanAdjustments);
  const draftVolumeImpact = readString(draftResolution.volumeImpact, '');
  const confirmNextAction =
    draftResolutionType === 'pause_project'
      ? 'pause_project'
      : draftResolutionType === 'replan_required'
        ? 'replan_window'
        : 'resume_current_chapter';

  return (
    <main>
      <h1>Decision Session</h1>
      <section>
        <h2>Session Status</h2>
        <p>Session: {detail.sessionId}</p>
        {detail.chapterNumber ? <p>Chapter: {detail.chapterNumber}</p> : null}
        {detail.status ? <p>Status: {detail.status}</p> : null}
        {detail.triggerReason ? <p>{detail.triggerReason}</p> : null}
      </section>
      <section>
        <h2>Decision Packet</h2>
        <pre>{JSON.stringify(detail.packet, null, 2)}</pre>
      </section>
      <section>
        <h2>Message History</h2>
        {detail.messages.length === 0 ? (
          <p>No messages yet.</p>
        ) : (
          <ol>
            {detail.messages.map((message, index) => (
              <li key={`${message.sequence ?? index}-${message.role}`}>
                <strong>{message.role}</strong>: {message.content}
              </li>
            ))}
          </ol>
        )}
      </section>
      <section>
        <h2>Draft Resolution</h2>
        {detail.currentDraftResolution ? (
          <pre>{JSON.stringify(detail.currentDraftResolution, null, 2)}</pre>
        ) : (
          <p>No draft resolution yet.</p>
        )}
      </section>
      <section>
        <h2>Controls</h2>
        {detail.confirmation ? (
          <>
            <p>Confirmation required: {detail.confirmation.required ? 'yes' : 'no'}</p>
            <p>Request type: {detail.confirmation.requestType}</p>
          </>
        ) : (
          <p>No pending confirmation request.</p>
        )}
      </section>
      <section>
        <h2>Resolution</h2>
        {detail.resolution ? (
          <pre>{JSON.stringify(detail.resolution, null, 2)}</pre>
        ) : (
          <p>Not resolved yet.</p>
        )}
      </section>
      <section>
        <h2>Actions</h2>
        <form action={`/decision-sessions/${detail.sessionId}/messages`} method="POST">
          <label htmlFor={`decision-message-${detail.sessionId}`}>Message</label>
          <textarea
            id={`decision-message-${detail.sessionId}`}
            name="content"
            rows={4}
            defaultValue=""
          />
          <button type="submit">Send Message</button>
        </form>
        <form
          action={`/decision-sessions/${detail.sessionId}/generate-resolution`}
          method="POST"
        >
          <label htmlFor={`decision-resolution-type-${detail.sessionId}`}>Resolution Type</label>
          <input
            id={`decision-resolution-type-${detail.sessionId}`}
            name="resolutionType"
            defaultValue={draftResolutionType}
          />
          <label htmlFor={`decision-resolution-summary-${detail.sessionId}`}>Decision Summary</label>
          <textarea
            id={`decision-resolution-summary-${detail.sessionId}`}
            name="decisionSummary"
            rows={4}
            defaultValue={draftDecisionSummary}
          />
          <fieldset>
            <legend>Story Facts To Apply</legend>
            {renderRepeatedInputs('storyFactsToApply', draftStoryFactsToApply)}
          </fieldset>
          <fieldset>
            <legend>Chapter Plan Adjustments</legend>
            {renderRepeatedInputs('chapterPlanAdjustments', draftChapterPlanAdjustments)}
          </fieldset>
          <label htmlFor={`decision-volume-impact-${detail.sessionId}`}>Volume Impact</label>
          <textarea
            id={`decision-volume-impact-${detail.sessionId}`}
            name="volumeImpact"
            rows={2}
            defaultValue={draftVolumeImpact}
          />
          <label htmlFor={`decision-replan-start-${detail.sessionId}`}>Replan Start Chapter</label>
          <input
            id={`decision-replan-start-${detail.sessionId}`}
            name="replanRangeStartChapter"
            defaultValue=""
          />
          <label htmlFor={`decision-replan-end-${detail.sessionId}`}>Replan End Chapter</label>
          <input
            id={`decision-replan-end-${detail.sessionId}`}
            name="replanRangeEndChapter"
            defaultValue=""
          />
          <button type="submit">Generate Draft Resolution</button>
        </form>
        <form action={`/decision-sessions/${detail.sessionId}/resolve`} method="POST">
          <label htmlFor={`decision-confirm-type-${detail.sessionId}`}>Resolution Type</label>
          <input
            id={`decision-confirm-type-${detail.sessionId}`}
            name="resolutionType"
            defaultValue={draftResolutionType}
          />
          <label htmlFor={`decision-confirm-summary-${detail.sessionId}`}>Decision Summary</label>
          <textarea
            id={`decision-confirm-summary-${detail.sessionId}`}
            name="decisionSummary"
            rows={4}
            defaultValue={draftDecisionSummary}
          />
          <fieldset>
            <legend>Story Facts To Apply</legend>
            {renderRepeatedInputs('storyFactsToApply', draftStoryFactsToApply)}
          </fieldset>
          <fieldset>
            <legend>Chapter Plan Adjustments</legend>
            {renderRepeatedInputs('chapterPlanAdjustments', draftChapterPlanAdjustments)}
          </fieldset>
          <label htmlFor={`decision-confirm-volume-impact-${detail.sessionId}`}>Volume Impact</label>
          <textarea
            id={`decision-confirm-volume-impact-${detail.sessionId}`}
            name="volumeImpact"
            rows={2}
            defaultValue={draftVolumeImpact}
          />
          <label htmlFor={`decision-next-action-${detail.sessionId}`}>Next Action</label>
          <input
            id={`decision-next-action-${detail.sessionId}`}
            name="nextAction"
            defaultValue={confirmNextAction}
          />
          <label htmlFor={`decision-resume-from-${detail.sessionId}`}>Resume From Chapter</label>
          <input
            id={`decision-resume-from-${detail.sessionId}`}
            name="resumeFromChapter"
            defaultValue=""
          />
          <label htmlFor={`decision-confirm-replan-start-${detail.sessionId}`}>
            Replan Start Chapter
          </label>
          <input
            id={`decision-confirm-replan-start-${detail.sessionId}`}
            name="replanRangeStartChapter"
            defaultValue=""
          />
          <label htmlFor={`decision-confirm-replan-end-${detail.sessionId}`}>
            Replan End Chapter
          </label>
          <input
            id={`decision-confirm-replan-end-${detail.sessionId}`}
            name="replanRangeEndChapter"
            defaultValue=""
          />
          <label htmlFor={`decision-invalidate-plans-${detail.sessionId}`}>
            Invalidate Existing Plans
          </label>
          <input
            id={`decision-invalidate-plans-${detail.sessionId}`}
            name="invalidateExistingPlans"
            defaultValue={draftResolutionType === 'replan_required' ? 'true' : 'false'}
          />
          <button type="submit">Confirm Resolution</button>
        </form>
      </section>
    </main>
  );
}
