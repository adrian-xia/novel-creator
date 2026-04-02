import {
  buildResolutionDraftFromConversation,
  type ResolutionDraftInput
} from './decision-resolution-draft';

export type { ResolutionDraftInput } from './decision-resolution-draft';

export function buildResolutionDraft(input: ResolutionDraftInput) {
  return buildResolutionDraftFromConversation(input);
}
