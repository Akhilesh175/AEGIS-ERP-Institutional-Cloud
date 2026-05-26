import { create } from 'zustand';
import { AuthSession } from '../services/mockApi';

interface SchoolERPStore {
  session: AuthSession | null;
  theme: 'light' | 'dark';
  activeStudentId: string | null; // For parents viewing linked children
  activeChatUserId: string | null; // Selected user in drawer
  setSession: (session: AuthSession | null) => void;
  toggleTheme: () => void;
  setActiveStudentId: (studentId: string | null) => void;
  setActiveChatUserId: (userId: string | null) => void;
  initializeStore: () => void;
}

export const useStore = create<SchoolERPStore>((set, get) => ({
  session: null,
  theme: 'dark',
  activeStudentId: null,
  activeChatUserId: null,

  setSession: (session) => {
    set({ session });
    if (session?.user.role === 'PARENT' && !get().activeStudentId) {
      // We will set this when we fetch students in the parent portal
    }
  },

  toggleTheme: () => {
    const nextTheme = get().theme === 'dark' ? 'light' : 'dark';
    set({ theme: nextTheme });
    const root = window.document.documentElement;
    if (nextTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('aegis_theme', nextTheme);
  },

  setActiveStudentId: (studentId) => set({ activeStudentId: studentId }),
  
  setActiveChatUserId: (userId) => set({ activeChatUserId: userId }),

  initializeStore: () => {
    // Theme initialization
    const savedTheme = localStorage.getItem('aegis_theme') as 'light' | 'dark' | null;
    const initialTheme = savedTheme || 'dark';
    set({ theme: initialTheme });
    
    const root = window.document.documentElement;
    if (initialTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // Session recovery
    const recovered = localStorage.getItem('aegis_session');
    if (recovered) {
      try {
        set({ session: JSON.parse(recovered) });
      } catch {
        localStorage.removeItem('aegis_session');
      }
    }
  }
}));
