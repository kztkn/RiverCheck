/** Limit the editable preview without limiting actual game attendance. */
export const MAX_PREVIEW_PARTICIPANT_COUNT = 20;

export function limitPreviewParticipantCount(value: string): string {
  return /^\d+$/.test(value) && Number(value) > MAX_PREVIEW_PARTICIPANT_COUNT
    ? String(MAX_PREVIEW_PARTICIPANT_COUNT)
    : value;
}
