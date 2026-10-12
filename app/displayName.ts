import {
  adjectives,
  animals,
  uniqueNamesGenerator,
} from "unique-names-generator";

import type { UserId } from "./schemas";

export function anonymousName(userId: UserId) {
  return uniqueNamesGenerator({
    dictionaries: [adjectives, animals],
    seed: userId,
    separator: " ",
    style: "capital",
  });
}

export function displayName(
  names: Readonly<Record<UserId, string>>,
  userId: UserId,
) {
  return names[userId] || anonymousName(userId);
}
