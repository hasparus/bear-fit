import { Dialog as BaseDialog } from "@base-ui-components/react/dialog";
import {
  type ComponentPropsWithoutRef,
  createContext,
  type ReactNode,
  use,
  useMemo,
  useState,
} from "react";

export interface DialogIds {
  // use declaration merging to add dialog ids here like
  // "edit-event": true;
}

export type DialogId = keyof DialogIds;
export type DialogsOpenStates = Partial<Record<DialogId, boolean>>;
export interface DialogsContext {
  isOpen: (id: DialogId) => boolean;
  set: (id: DialogId, open: boolean) => void;
  states: DialogsOpenStates;
}
const context = createContext<DialogsContext>({
  isOpen: () => false,
  states: {},
  set: () => {
    throw new Error("useDialogs must be used within a DialogsProvider");
  },
});

export interface DialogRootProps
  extends Omit<ComponentPropsWithoutRef<typeof BaseDialog.Root>, "open"> {
  id: DialogId;
}

export const Dialog = {
  ...BaseDialog,
  Root(props: DialogRootProps) {
    const ctx = use(context);

    return (
      <BaseDialog.Root
        {...props}
        open={ctx.states[props.id] || false}
        onOpenChange={(open, event, reason) => {
          ctx.set(props.id, open);
          props.onOpenChange?.(open, event, reason);
        }}
      />
    );
  },
};

const { Provider } = context;
export function DialogsProvider({ children }: { children: ReactNode }) {
  // todo: search params list of open dialogs
  const [states, setStates] = useState<DialogsOpenStates>({});
  return (
    <Provider
      value={useMemo(() => {
        return {
          isOpen: (id: DialogId) => states[id] || false,
          states,
          set: (id: DialogId, open: boolean) => {
            setStates((prev) => ({ ...prev, [id]: open }));
          },
        };
      }, [states])}
    >
      {children}
    </Provider>
  );
}

export function useDialogs() {
  return use(context);
}
