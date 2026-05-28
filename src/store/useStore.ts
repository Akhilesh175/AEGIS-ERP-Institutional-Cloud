import { create } from 'zustand';
import { AuthSession } from '../services/mockApi';

interface SchoolERPStore {
  session: AuthSession | null;
  theme: 'light' | 'dark';
  activeStudentId: string | null; // For parents viewing linked children
  activeChatUserId: string | null; // Selected user in drawer
  isMobileMenuOpen: boolean; // Mobile navigation control
  setSession: (session: AuthSession | null) => void;
  toggleTheme: () => void;
  setActiveStudentId: (studentId: string | null) => void;
  setActiveChatUserId: (userId: string | null) => void;
  setMobileMenuOpen: (isOpen: boolean) => void;
  initializeStore: () => void;
  syncSubscriptionPlan: () => Promise<void>;
}

export const useStore = create<SchoolERPStore>((set, get) => ({
  session: null,
  theme: 'dark',
  activeStudentId: null,
  activeChatUserId: null,
  isMobileMenuOpen: false,

  setMobileMenuOpen: (isOpen) => set({ isMobileMenuOpen: isOpen }),

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
        const parsed = JSON.parse(recovered);
        set({ session: parsed });
        
        // Dynamically fetch and sync the subscription plan from Supabase in the background
        if (parsed?.user?.schoolId) {
          import('../services/mockApi').then(async ({ mockApi }) => {
            try {
              const livePlan = await mockApi.getLiveSchoolSubscriptionPlan(parsed.user.schoolId);
              if (livePlan) {
                const updatedSession = { ...parsed, schoolSubscriptionPlan: livePlan };
                set({ session: updatedSession });
                localStorage.setItem('aegis_session', JSON.stringify(updatedSession));
              }
            } catch (e) {
              console.error('Failed to sync live subscription plan:', e);
            }
          });
        }
      } catch {
        localStorage.removeItem('aegis_session');
      }
    }
  },

  syncSubscriptionPlan: async () => {
    const sess = get().session;
    if (sess?.user?.schoolId) {
      try {
        const { mockApi } = await import('../services/mockApi');
        const livePlan = await mockApi.getLiveSchoolSubscriptionPlan(sess.user.schoolId);
        if (livePlan && livePlan !== sess.schoolSubscriptionPlan) {
          const updatedSession = { ...sess, schoolSubscriptionPlan: livePlan };
          set({ session: updatedSession });
          localStorage.setItem('aegis_session', JSON.stringify(updatedSession));
        }
      } catch (e) {
        console.error('Failed to sync subscription plan in polling loop:', e);
      }
    }
  }
}));
