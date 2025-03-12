import React from "react";
import { unsafeKeys } from "unsafe-keys";

import type { IsoDate, UserId } from "../schemas";

export function UserAvailabilitySummary({
  availabilityForUsers,
  creatorId,
  names,
  onHover,
  userId,
}: {
  availabilityForUsers: Record<UserId, IsoDate[]>;
  creatorId: UserId | undefined;
  names: Record<UserId, string>;
  onHover: (userId: UserId | null) => void;
  userId: UserId | null;
}) {
  return (
    <dl onMouseLeave={() => onHover(null)}>
      {unsafeKeys(availabilityForUsers).map((user) => {
        const dates = availabilityForUsers[user];
        return (
          <UserAvailabilitySummaryItem
            dates={dates}
            isCreator={user === creatorId}
            isCurrentUser={user === userId}
            key={user}
            name={names[user as UserId] ?? user}
            onMouseEnter={() => onHover(user as UserId)}
          />
        );
      })}
      {userId && !availabilityForUsers[userId] && (
        <UserAvailabilitySummaryItem
          dates={[]}
          isCreator={creatorId === userId}
          isCurrentUser={true}
          key={userId}
          name={names[userId as UserId] ?? userId}
          onMouseEnter={() => onHover(userId as UserId)}
        />
      )}
    </dl>
  );
}

interface UserAvailabilitySummaryItemProps
  extends React.HTMLAttributes<HTMLDivElement> {
  dates: IsoDate[];
  isCreator: boolean;
  isCurrentUser: boolean;
  name: string;
}

function UserAvailabilitySummaryItem({
  dates,
  isCreator,
  isCurrentUser,
  name,
  ...rest
}: UserAvailabilitySummaryItemProps) {
  const labels = Object.entries({
    creator: isCreator,
    you: isCurrentUser,
  })
    .filter(([_, value]) => value)
    .map(([key]) => `${key}`)
    .join(", ");

  return (
    <div
      className="-mx-1 -my-0.5 flex cursor-default justify-between gap-2 rounded-sm px-1 py-0.5 hover:bg-neutral-100 hover:text-neutral-800"
      {...rest}
    >
      <dt>
        {name}
        {labels ? ` (${labels})` : ""}
      </dt>
      <dd>
        {dates.length} date{dates.length === 1 ? "" : "s"}
      </dd>
    </div>
  );
}
