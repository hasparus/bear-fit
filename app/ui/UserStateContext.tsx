import { type } from "arktype";
import {
  createContext,
  type Dispatch,
  useContext,
  useEffect,
  useReducer,
} from "react";

import { CalendarEvent } from "../schemas";
import { UnreachableCaseError } from "./UnreachableCaseError";

const LOCAL_STORAGE_KEY = "🐻👤state";

interface UserStateContextValue {
  /**
   * In Nerd Mode, the user sees JSON import & export buttons, and change history.
   */
  nerdMode: boolean;
  /**
   * Calendars the user interacted with.
   */
  calendars: CalendarEvent[];
}

const UserStateContextValue = type({
  events: CalendarEvent.array(),
  nerdMode: "boolean",
});

const DEFAULT_USER_STATE: UserStateContextValue = {
  calendars: [],
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
      type: "forget-calendar";
      payload: string;
    }
  | {
      type: "remember-calendar";
      payload: CalendarEvent;
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
    case "forget-calendar": {
      const calendars = state.calendars.filter(
        (calendar) => calendar.id !== action.payload,
      );

      if (calendars.length === state.calendars.length) return state;

      return {
        ...state,
        calendars,
      };
    }
    case "remember-calendar": {
      const [first] = state.calendars;
      if (
        first?.id === action.payload.id &&
        first.name === action.payload.name &&
        first.startDate === action.payload.startDate &&
        first.endDate === action.payload.endDate &&
        first.rolling === action.payload.rolling
      ) {
        return state;
      }
      return {
        ...state,
        calendars: [
          action.payload,
          ...state.calendars.filter(
            (calendar) => calendar.id !== action.payload.id,
          ),
        ].slice(0, 100),
      };
    }
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
  const { events, nerdMode } = UserStateContextValue.assert(storage);
  stateFromStorage = { calendars: events, nerdMode };
} catch {
  // we don't care about the error here
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

    localStorage.setItem(
      LOCAL_STORAGE_KEY,
      JSON.stringify({ events: state.calendars, nerdMode: state.nerdMode }),
    );
  }, [state]);

  return (
    <UserStateDispatchContext.Provider value={dispatch}>
      <UserStateContext.Provider value={state}>
        {children}
      </UserStateContext.Provider>
    </UserStateDispatchContext.Provider>
  );
}
