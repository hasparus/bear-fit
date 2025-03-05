import { nanoid } from "nanoid";

import type { UserId } from "./schemas";

export function getUserId() {
  let userId = window.localStorage.getItem("userId") as UserId | null;

  if (!userId) {
    userId = nanoid() as UserId;
    window.localStorage.setItem("userId", userId);
  }

  return userId;
}
