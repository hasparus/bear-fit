import {
  createContext,
  type Dispatch,
  useContext,
  useEffect,
  useReducer,
} from "react";
import * as v from "valibot";

import { CalendarEvent } from "../schemas";
import { UnreachableCaseError } from "./UnreachableCaseError";

const LOCAL_STORAGE_KEY = "🐻👤state";

/**
 * The preferences and user metadata are stored in localStorage.
 * We're later store this in the users DB.
 */
interface UserStateContextValue {
  /**
   * In Nerd Mode, the user sees JSON import & export buttons, and change history.
   */
  nerdMode: boolean;
  /**
   * Events the user interacted with.
   */
  events: CalendarEvent[];
}

const UserStateContextValue = v.object({
  events: v.array(CalendarEvent),
  nerdMode: v.boolean(),
});

const DEFAULT_USER_STATE: UserStateContextValue = {
  events: [],
  nerdMode: false,
};

const UserStateContext = createContext<UserStateContextValue | null>(null);

export function useUserState() {
  const context = useContext(UserStateContext);
  if (!context) {
    throw new Error(
      "usePreferences is used outside of the PreferencesProvider",
    );
  }
  return context;
}

const UserStateDispatchContext = createContext<Dispatch<UserStateAction>>(
  () => {
    throw new Error(
      "useUserStateDispatch is used outside of the UserStateProvider",
    );
  },
);

export function useUserDispatch() {
  return useContext(UserStateDispatchContext);
}

export type UserStateAction =
  | {
      // we only store events you interacted with
      type: "remember-event";
      payload: CalendarEvent;
    }
  | {
      type: "forget-event";
      /** event ID */
      payload: string;
    }
  | {
      type: "set-nerd-mode";
      payload: boolean;
    }
  | {
      type: "~load-from-storage";
      payload: UserStateContextValue;
    };

function userStateReducer(
  state: UserStateContextValue,
  action: UserStateAction,
) {
  switch (action.type) {
    case "forget-event": {
      const newEvents = state.events.filter(
        (event) => event.id !== action.payload,
      );

      if (newEvents.length === state.events.length) return state;

      return {
        ...state,
        events: newEvents,
      };
    }
    case "remember-event":
      if (state.events.some((event) => event.id === action.payload.id)) {
        return state;
      }
      return {
        ...state,
        events: [action.payload, ...state.events].slice(0, 10),
      };
    case "set-nerd-mode":
      return { ...state, nerdMode: action.payload };
    case "~load-from-storage":
      return { ...state, ...action.payload };
    default:
      throw new UnreachableCaseError(action);
  }
}

let stateFromStorage: UserStateContextValue | null = null;
try {
  const storage = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || "{}");
  stateFromStorage = v.parse(UserStateContextValue, storage);
} catch (error) {
  console.error("Error parsing user state from localStorage", error);
}

export function PreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, dispatch] = useReducer(userStateReducer, DEFAULT_USER_STATE);

  useEffect(() => {
    if (stateFromStorage) {
      dispatch({
        type: "~load-from-storage",
        payload: stateFromStorage,
      });
      stateFromStorage = null;
      return;
    }

    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  return (
    <UserStateDispatchContext.Provider value={dispatch}>
      <UserStateContext.Provider value={state}>
        {children}
      </UserStateContext.Provider>
    </UserStateDispatchContext.Provider>
  );
}
