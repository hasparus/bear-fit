import { adjectives, animals } from "unique-names-generator";

import type { UserId } from "./schemas";

// cyrb53: unique-names-generator's own `seed` sums char codes, so ids collide
function hash(str: string) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

const capitalize = (word: string) => word[0].toUpperCase() + word.slice(1);

export function anonymousName(userId: UserId) {
  const h = hash(userId);
  const adjective = adjectives[h % adjectives.length];
  const animal = animals[Math.floor(h / adjectives.length) % animals.length];
  return `${capitalize(adjective)} ${capitalize(animal)}`;
}

export function displayName(
  names: Readonly<Record<UserId, string>>,
  userId: UserId,
) {
  return names[userId] || anonymousName(userId);
}
