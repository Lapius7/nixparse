/**
 * ヘッダー行から列の開始位置を検出し、各データ行を列名→値のオブジェクトに変換する。
 * 最後の列は値の中にスペースを含みうるため、末尾まで含めて切り出す。
 */
export function parseFixedColumnTable(
  lines: string[],
  headerNames: string[],
): Record<string, string>[] {
  if (lines.length === 0) return [];
  const header = lines[0]!;
  const starts = headerNames.map((name) => {
    const idx = header.indexOf(name);
    if (idx === -1) {
      throw new Error(`Header column "${name}" not found in: ${header}`);
    }
    return idx;
  });

  const rows = lines.slice(1).filter((l) => l.trim().length > 0);

  return rows.map((line) => {
    const record: Record<string, string> = {};
    for (let i = 0; i < headerNames.length; i++) {
      const start = starts[i]!;
      const end = i + 1 < starts.length ? starts[i + 1]! : line.length;
      record[headerNames[i]!] = line.slice(start, end).trim();
    }
    return record;
  });
}

export function splitNonEmptyLines(text: string): string[] {
  return text.split("\n").filter((l) => l.trim().length > 0);
}
