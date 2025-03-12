import React from "react";
import { unsafeKeys } from "unsafe-keys";

import type { IsoDate, UserId } from "../schemas";

import { cn } from "./cn";

// TODO: Click users to visualize a subset of the availability grid

export function UserAvailabilitySummary({
  availabilityForUsers,
  creatorId,
  names,
  onHover,
  // TODO
  onSelect: _,
  userId,
}: {
  availabilityForUsers: Record<UserId, IsoDate[]>;
  creatorId: UserId | undefined;
  names: Record<UserId, string>;
  onHover: (userId: UserId | null) => void;
  // TODO
  onSelect?: (userId: UserId | null) => void;
  userId: UserId | null;
}) {
  const userIds = unsafeKeys(availabilityForUsers);

  const currentUserDidNotSelectYet = !userId || !availabilityForUsers[userId];
  const allUsersCount = userIds.length + (currentUserDidNotSelectYet ? 1 : 0);

  return (
    <dl
      className={cn(
        allUsersCount > 6 &&
          "max-h-[144px] overflow-y-auto overflow-x-clip border border-black p-2 rounded-sm bg-neutral-50 inset-shadow-2xs",
      )}
      onMouseLeave={() => onHover(null)}
    >
      {userIds.map((user) => {
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
      {currentUserDidNotSelectYet && (
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
      className="-mx-1 -my-0.5 flex cursor-default justify-between gap-2 rounded-sm px-1 py-0.5 hover:bg-neutral-100 hover:text-neutral-800 "
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
