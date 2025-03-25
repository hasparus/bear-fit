import {
  createContext,
  type Dispatch,
  useContext,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
} from "react";

import { UnreachableCaseError } from "./UnreachableCaseError";

const LOCAL_STORAGE_KEY = "🐻👤";

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
  events: string[];
}

function parseUserState(value: string): UserStateContextValue {
  try {
    const json = JSON.parse(value);
    if (
      typeof json !== "object" ||
      json === null ||
      typeof json.nerdMode !== "boolean" ||
      !Array.isArray(json.events || {}) ||
      json.events.some((event: unknown) => typeof event !== "string")
    ) {
      throw new Error("invalid user state");
    }
    return json as UserStateContextValue;
  } catch (error) {
    console.error(error);
    throw new Error("invalid user state");
  }
}

const DEFAULT_USER_STATE: UserStateContextValue = {
  nerdMode: false,
  events: [],
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
      type: "set-nerd-mode";
      payload: boolean;
    }
  | {
      // we only store events you interacted with
      type: "remember-event";
      /** event ID */
      payload: string;
    }
  | {
      type: "forget-event";
      /** event ID */
      payload: string;
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
    case "~load-from-storage":
      return { ...state, ...action.payload };
    case "set-nerd-mode":
      return { ...state, nerdMode: action.payload };
    case "remember-event":
      return { ...state, events: [...state.events, action.payload] };
    case "forget-event":
      return {
        ...state,
        events: state.events.filter((id) => id !== action.payload),
      };
    default:
      throw new UnreachableCaseError(action);
  }
}

export function PreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, dispatch] = useReducer(userStateReducer, DEFAULT_USER_STATE);

  useLayoutEffect(() => {
    const storedState = localStorage.getItem("🐻👤");
    const parsedState = storedState ? parseUserState(storedState) : null;
    if (parsedState) {
      dispatch({
        type: "~load-from-storage",
        payload: parsedState,
      });
    }
  }, []);

  useEffect(() => {
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
