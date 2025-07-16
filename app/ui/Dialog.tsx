import { Dialog as BaseDialog } from "@base-ui-components/react/dialog";
import {
  type ComponentPropsWithoutRef,
  createContext,
  type ReactNode,
  use,
  useMemo,
  useState,
} from "react";

type DialogId = string & { __brand?: "DialogName" };
type DialogsOpenStates = Record<DialogId, boolean>;
interface DialogsContext {
  set: (id: DialogId, open: boolean) => void;
  states: DialogsOpenStates;
}
const context = createContext<DialogsContext>({
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
        open={ctx.states[props.id]}
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
  const [states, setStates] = useState<DialogsOpenStates>({});
  return (
    <Provider
      value={useMemo(() => {
        return {
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
