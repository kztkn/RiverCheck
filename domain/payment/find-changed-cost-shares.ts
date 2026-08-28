export function findChangedCostSharePlayerIds(
  before: Array<{ groupPlayerId: string; costShare: number }>,
  after: Array<{ groupPlayerId: string; costShare: number }>,
): string[] {
  const afterByPlayerId = new Map(
    after.map((result) => [result.groupPlayerId, result.costShare]),
  );
  return before
    .filter(
      (result) => afterByPlayerId.get(result.groupPlayerId) !== result.costShare,
    )
    .map((result) => result.groupPlayerId);
}
