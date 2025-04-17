import type { Doc } from "yjs";

import { getUserId } from "../getUserId";
import { AvailabilityKey, type UserId } from "../schemas";
import { YDocJsonSchema } from "../shared-data";

export function overwriteYDocWithJson(yDoc: Doc, json: unknown) {
  const jsonData = YDocJsonSchema.assert(json);

  const currentUserId = getUserId();

  yDoc.transact(() => {
    const namesMap = yDoc.getMap("names");

    const currentUserName =
      namesMap.get(currentUserId) || localStorage.getItem("userName");

    const sameNameUserIds: UserId[] = [];
    Object.entries(jsonData.names).forEach(([id, name]) => {
      if (name === currentUserName && id !== currentUserId) {
        sameNameUserIds.push(id as UserId);
      }
    });

    const availabilityMap = yDoc.getMap("availability");

    const keysToDelete: string[] = [];
    availabilityMap.forEach((_value, key) => {
      keysToDelete.push(key);
    });

    keysToDelete.forEach((key) => {
      availabilityMap.delete(key);
    });

    Object.entries(jsonData.availability).forEach(([key, value]) => {
      try {
        const belongsToSameNameUser = sameNameUserIds.some((userId) =>
          key.startsWith(userId),
        );

        if (belongsToSameNameUser) {
          const { date } = AvailabilityKey.parseToObject(key);
          const newKey = AvailabilityKey(currentUserId, date);
          availabilityMap.set(newKey, value);
        } else {
          availabilityMap.set(key, value);
        }
      } catch (e: unknown) {
        console.error("Error importing availability:", e);
        availabilityMap.set(key, value);
      }
    });

    const eventMap = yDoc.getMap("event");
    Object.entries(jsonData.event).forEach(([key, value]) => {
      if (key === "creator") {
        return;
      }
      eventMap.set(key, value);
    });

    Object.entries(jsonData.names).forEach(([key, value]) => {
      if (!sameNameUserIds.includes(key as UserId)) {
        namesMap.set(key, value);
      }
    });

    namesMap.set(currentUserId, currentUserName);
  });
}
