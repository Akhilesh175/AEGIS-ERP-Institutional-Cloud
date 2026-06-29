import { create } from 'zustand';

interface CoachNavigationState {
  stack: string[];
  isBacking: boolean;
  push: (tab: string) => void;
  pop: () => string | null;
  reset: () => void;
  setIsBacking: (val: boolean) => void;
}

export const useCoachNavigation = create<CoachNavigationState>((set, get) => ({
  stack: ['dashboard'],
  isBacking: false,
  push: (tab: string) => {
    set((state) => {
      const last = state.stack[state.stack.length - 1];
      if (last === tab) return state;
      // If we push a root tab (like dashboard), reset the stack to Level 0
      if (tab === 'dashboard') {
        return { stack: ['dashboard'] };
      }
      return { stack: [...state.stack, tab] };
    });
  },
  pop: () => {
    let newActive: string | null = null;
    set((state) => {
      if (state.stack.length <= 1) return state;
      const nextStack = [...state.stack];
      nextStack.pop(); // Pop current page
      newActive = nextStack[nextStack.length - 1];
      return { stack: nextStack, isBacking: true };
    });
    return newActive;
  },
  reset: () => set({ stack: ['dashboard'], isBacking: false }),
  setIsBacking: (val: boolean) => set({ isBacking: val })
}));
