export function secondsUntil(
  deadlineIso: string | null | undefined,
  now: number = Date.now(),
): number | null {
  if (!deadlineIso) {
    return null;
  }

  const deadlineMs = new Date(deadlineIso).getTime();
  if (Number.isNaN(deadlineMs)) {
    return null;
  }

  return Math.max(0, Math.ceil((deadlineMs - now) / 1000));
}
