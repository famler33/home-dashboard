import { createContext, useContext } from 'react';

export type ShellLayout = 'tablet' | 'phone';
export type ShellTheme = 'day' | 'night';

export interface ShellContextValue {
  layout: ShellLayout;
  theme: ShellTheme;
}

/** Layout and theme as decided by the shell, for tiles whose content depends on them. */
export const ShellContext = createContext<ShellContextValue>({ layout: 'tablet', theme: 'day' });

export function useShell(): ShellContextValue {
  return useContext(ShellContext);
}
