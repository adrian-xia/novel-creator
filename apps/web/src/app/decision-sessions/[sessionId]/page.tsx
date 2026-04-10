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

function readGateOptions(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((option) => ({
      optionId: readString(option.optionId),
      title: readString(option.title, 'Untitled option'),
      strategy: readString(option.strategy, 'alternative'),
      rationale: readString(option.rationale),
      impactSummary: readString(option.impactSummary)
    }))
    .filter((option) => option.optionId.length > 0);
}

export default async function DecisionSessionPage({
  params,
  searchParams
}: {
  params: Promise<{ sessionId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { sessionId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const detail = await getDecisionSessionDetail(sessionId);
  const actionError = (() => {
    const raw = resolvedSearchParams.error;

    if (typeof raw === 'string') {
      return raw;
    }

    if (Array.isArray(raw) && typeof raw[0] === 'string') {
      return raw[0];
    }

    return '';
  })();

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
  const gateType = readString(detail.gateType, '');
  const gateOptions = readGateOptions(detail.options);
  const isHumanGate = gateType.length > 0;
  const gateActionsEnabled = isHumanGate && detail.status !== 'resolved' && detail.status !== 'cancelled';
  const recommendedOptionId = readString(detail.recommendedOptionId, '');
  const selectedOptionId = readString(detail.selectedOptionId, '');
  const humanNotes = readString(detail.humanNotes, '');
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
        {detail.chapterNumber !== null && detail.chapterNumber !== undefined ? (
          <p>Chapter: {detail.chapterNumber}</p>
        ) : null}
        {detail.status ? <p>Status: {detail.status}</p> : null}
        {gateType ? <p>Gate Type: {gateType}</p> : null}
        {detail.triggerReason ? <p>{detail.triggerReason}</p> : null}
        {actionError ? <p>Action Error: {actionError}</p> : null}
      </section>
      {isHumanGate ? (
        <section>
          <h2>Recommended Options</h2>
          {gateOptions.length > 0 ? (
            <ol>
              {gateOptions.map((option) => (
                <li key={option.optionId}>
                  <strong>{option.title}</strong>
                  <div>{option.optionId}</div>
                  <div>{option.strategy === 'recommended' ? '系统推荐' : '备选方案'}</div>
                  <p>{option.rationale}</p>
                  <p>{option.impactSummary}</p>
                  {recommendedOptionId === option.optionId ? <p>推荐选项</p> : null}
                  {selectedOptionId === option.optionId ? <p>已确认选项</p> : null}
                </li>
              ))}
            </ol>
          ) : (
            <p>No gate options available.</p>
          )}
        </section>
      ) : null}
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
        {isHumanGate ? (
          <>
            {gateActionsEnabled && gateOptions.length > 0 ? (
              <form action={`/decision-sessions/${detail.sessionId}/confirm`} method="POST">
                <label htmlFor={`gate-selected-option-${detail.sessionId}`}>Selected Option</label>
                <select
                  id={`gate-selected-option-${detail.sessionId}`}
                  name="selectedOptionId"
                  defaultValue={recommendedOptionId || gateOptions[0]?.optionId || ''}
                >
                  {gateOptions.map((option) => (
                    <option key={option.optionId} value={option.optionId}>
                      {option.title} ({option.optionId})
                    </option>
                  ))}
                </select>
                <label htmlFor={`gate-human-notes-${detail.sessionId}`}>人工备注</label>
                <textarea
                  id={`gate-human-notes-${detail.sessionId}`}
                  name="humanNotes"
                  rows={4}
                  defaultValue={humanNotes}
                />
                <button type="submit">采用推荐方案</button>
              </form>
            ) : gateActionsEnabled ? (
              <p>Gate options are unavailable, so confirmation is disabled.</p>
            ) : (
              <p>Gate actions are no longer available for this session status.</p>
            )}
            {gateActionsEnabled ? (
              <form action={`/decision-sessions/${detail.sessionId}/cancel`} method="POST">
                <button type="submit">取消 Gate</button>
              </form>
            ) : null}
          </>
        ) : (
          <>
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
          </>
        )}
      </section>
    </main>
  );
}
