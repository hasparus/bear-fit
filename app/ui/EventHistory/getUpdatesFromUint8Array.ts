export function getUpdatesFromUint8Array(body: Uint8Array) {
  const textDecoder = new TextDecoder();
  const parts: Uint8Array[] = [];
  let start = 0;

  for (let i = 0; i < body.length - 1; i++) {
    if (body[i] === 10 && body[i + 1] === 10) {
      parts.push(body.slice(start, i));
      start = i + 2;
      i++;
    }
  }

  if (start < body.length) {
    parts.push(body.slice(start));
  }

  const updates: { clock: string; value: Uint8Array }[] = [];

  for (let i = 0; i < parts.length; i += 2) {
    const clockOrSv = textDecoder.decode(parts[i]);
    const value = parts[i + 1];
    updates.push({ clock: clockOrSv, value });
  }

  return updates;
}
