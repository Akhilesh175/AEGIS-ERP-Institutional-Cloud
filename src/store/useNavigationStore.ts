import { create } from 'zustand';

interface NavigationState {
  stack: string[];
  isBacking: boolean;
  push: (route: string) => void;
  pop: () => string | null;
  reset: (root?: string) => void;
  setIsBacking: (val: boolean) => void;
}

export const useNavigationStore = create<NavigationState>((set, get) => ({
  stack: ['dashboard'],
  isBacking: false,
  push: (route: string) => {
    set((state) => {
      const last = state.stack[state.stack.length - 1];
      if (last === route) return state;
      // If we navigate back to root dashboard, reset the stack
      if (route === 'dashboard') {
        return { stack: ['dashboard'] };
      }
      return { stack: [...state.stack, route] };
    });
  },
  pop: () => {
    let newRoute: string | null = null;
    set((state) => {
      if (state.stack.length <= 1) return state;
      const nextStack = [...state.stack];
      nextStack.pop();
      newRoute = nextStack[nextStack.length - 1];
      return { stack: nextStack, isBacking: true };
    });
    return newRoute;
  },
  reset: (root = 'dashboard') => set({ stack: [root], isBacking: false }),
  setIsBacking: (val: boolean) => set({ isBacking: val })
}));
