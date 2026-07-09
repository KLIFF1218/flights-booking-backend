export function encodeCursor(obj: any): string {
  return Buffer.from(JSON.stringify(obj)).toString('base64');
}

export function decodeCursor(cursor?: string) {
  if (!cursor) return null;
  try {
    return JSON.parse(Buffer.from(cursor, 'base64').toString());
  } catch {
    return null;
  }
}
