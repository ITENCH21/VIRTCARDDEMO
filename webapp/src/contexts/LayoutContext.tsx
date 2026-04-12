import { createContext, useContext, ReactNode } from 'react';

type LayoutMode = 'mobile' | 'desktop';

interface LayoutContextType {
  mode: LayoutMode;
  isDesktop: boolean;
  isMobile: boolean;
}

const LayoutContext = createContext<LayoutContextType>({
  mode: 'mobile',
  isDesktop: false,
  isMobile: true,
});

export function LayoutProvider({ mode, children }: { mode: LayoutMode; children: ReactNode }) {
  const value: LayoutContextType = {
    mode,
    isDesktop: mode === 'desktop',
    isMobile: mode === 'mobile',
  };
  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>;
}

export function useLayout() {
  return useContext(LayoutContext);
}
