export type SourceArchiveStatusInput = {
  fileName: string;
  sourceUrl: string;
  acquiredAt: Date;
  recordCount: number;
  archiveSha256: string;
};

export function sourceArchiveStatus(archive: SourceArchiveStatusInput | null | undefined) {
  if (!archive) {
    return {
      label: "Official source prepared",
      detail: "No approved official archive has been imported yet. Cairn will not answer from this source until it has evidence.",
      acquiredDate: null,
      shortSha256: null,
    };
  }
  return {
    label: "Official archive active",
    detail: `${archive.recordCount.toLocaleString()} active records`,
    acquiredDate: new Date(archive.acquiredAt).toISOString().slice(0, 10),
    shortSha256: `${archive.archiveSha256.slice(0, 12)}…`,
  };
}
