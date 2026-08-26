export type OfficialRecordHash = {
  recordKey: string;
  textSha256: string;
};

export function compareOfficialRecordSnapshots(previous: OfficialRecordHash[], next: OfficialRecordHash[]) {
  const previousByKey = new Map<string, OfficialRecordHash>();
  const nextByKey = new Map<string, OfficialRecordHash>();
  for (const record of previous) {
    if (previousByKey.has(record.recordKey)) throw new Error(`Previous archive repeats ${record.recordKey}.`);
    previousByKey.set(record.recordKey, record);
  }
  for (const record of next) {
    if (nextByKey.has(record.recordKey)) throw new Error(`Next archive repeats ${record.recordKey}.`);
    nextByKey.set(record.recordKey, record);
  }
  const added = next.filter((record) => !previousByKey.has(record.recordKey));
  const changed = next.filter((record) => {
    const prior = previousByKey.get(record.recordKey);
    return prior !== undefined && prior.textSha256 !== record.textSha256;
  });
  const unchanged = next.filter((record) => previousByKey.get(record.recordKey)?.textSha256 === record.textSha256);
  const retired = previous.filter((record) => !nextByKey.has(record.recordKey));
  return { added, changed, unchanged, retired };
}
