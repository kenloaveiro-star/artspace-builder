import { createContext, useContext, type ReactNode } from "react";

type ArcadeExitContextValue = { exit: () => void };

const ArcadeExitContext = createContext<ArcadeExitContextValue>({ exit: () => {} });

export function ArcadeExitProvider({ exit, children }: { exit: () => void; children: ReactNode }) {
  return <ArcadeExitContext.Provider value={{ exit }}>{children}</ArcadeExitContext.Provider>;
}

export function useArcadeExit() {
  return useContext(ArcadeExitContext).exit;
}
