import { create } from 'zustand';
import { AuthSession } from '../services/mockApi';

interface SchoolERPStore {
  session: AuthSession | null;
  theme: 'light' | 'dark';
  activeStudentId: string | null; // For parents viewing linked children
  activeChatUserId: string | null; // Selected user in drawer
  isMobileMenuOpen: boolean; // Mobile navigation control
  activeAcademicSessionId: string | null; // Selected session for filters
  setSession: (session: AuthSession | null) => void;
  toggleTheme: () => void;
  setActiveStudentId: (studentId: string | null) => void;
  setActiveChatUserId: (userId: string | null) => void;
  setMobileMenuOpen: (isOpen: boolean) => void;
  setActiveAcademicSessionId: (sessionId: string | null) => void;
  initializeStore: () => void;
  syncSubscriptionPlan: () => Promise<void>;
  syncUserSession: () => Promise<void>;
  switchActiveRole: (newRole: string) => Promise<void>;
}

export const useStore = create<SchoolERPStore>((set, get) => ({
  session: null,
  theme: 'dark',
  activeStudentId: null,
  activeChatUserId: null,
  isMobileMenuOpen: false,
  activeAcademicSessionId: null,

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

  setActiveAcademicSessionId: (sessionId) => {
    set({ activeAcademicSessionId: sessionId });
    if (sessionId) {
      localStorage.setItem('aegis_active_session_id', sessionId);
    } else {
      localStorage.removeItem('aegis_active_session_id');
    }
  },

  initializeStore: () => {
    // Theme initialization
    const savedTheme = localStorage.getItem('aegis_theme') as 'light' | 'dark' | null;
    const initialTheme = savedTheme || 'dark';
    set({ theme: initialTheme });

    const savedSessionId = localStorage.getItem('aegis_active_session_id');
    if (savedSessionId) {
      set({ activeAcademicSessionId: savedSessionId });
    }
    
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
              let updatedUser = { ...parsed.user };
              let sessionChanged = false;
              if (!parsed.user.academicSessionId) {
                const activeSessId = await mockApi.resolveActiveSessionId(parsed.user.schoolId);
                if (activeSessId) {
                  updatedUser.academicSessionId = activeSessId;
                  sessionChanged = true;
                }
              }

              const livePlan = await mockApi.getLiveSchoolSubscriptionPlan(parsed.user.schoolId);
              if (!localStorage.getItem('aegis_session')) {
                console.log('Session was cleared during background sync. Aborting.');
                return;
              }
              if (livePlan || sessionChanged) {
                const updatedSession = { 
                  ...parsed, 
                  user: updatedUser,
                  schoolSubscriptionPlan: livePlan ? livePlan.toLowerCase() : parsed.schoolSubscriptionPlan 
                };
                set({ session: updatedSession });
                localStorage.setItem('aegis_session', JSON.stringify(updatedSession));
                
                if (livePlan) {
                  // Force sync the local mockDb school registry to invalidate any stale premium tier states
                  const dbSchoolsRaw = localStorage.getItem('aegis_erp_db_schools');
                  if (dbSchoolsRaw) {
                    try {
                      const dbSchools = JSON.parse(dbSchoolsRaw);
                      const idx = dbSchools.findIndex((s: any) => s.id === parsed.user.schoolId);
                      if (idx !== -1 && dbSchools[idx].subscriptionPlan !== livePlan.toLowerCase()) {
                        dbSchools[idx].subscriptionPlan = livePlan.toLowerCase();
                        localStorage.setItem('aegis_erp_db_schools', JSON.stringify(dbSchools));
                      }
                      
                      // Keep the in-memory mockDb singleton in sync!
                      const { mockDb } = await import('../services/mockDb');
                      const memIdx = mockDb.schools.findIndex((s: any) => s.id === parsed.user.schoolId);
                      if (memIdx !== -1) {
                        mockDb.schools[memIdx].subscriptionPlan = livePlan.toLowerCase();
                      }
                    } catch (err) {
                      console.error('Failed to parse cached schools:', err);
                    }
                  }
                }
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
    if (!sess) return;
    const schoolId = sess?.user?.schoolId;
    if (!schoolId) return;
    
    try {
      const { mockApi } = await import('../services/mockApi');
      const livePlan = await mockApi.getLiveSchoolSubscriptionPlan(schoolId);
      
      // Re-read session FRESH after the async call to avoid overwriting concurrent changes
      const currentSession = get().session;
      if (!currentSession || !localStorage.getItem('aegis_session')) {
        console.log('Session was cleared during syncSubscriptionPlan. Aborting.');
        return;
      }
      
      if (livePlan) {
        const planNormalized = livePlan.toLowerCase();
        
        // Only update if plan actually changed to avoid unnecessary re-renders
        if (currentSession.schoolSubscriptionPlan === planNormalized) return;
        
        const updatedSession = { ...currentSession, schoolSubscriptionPlan: planNormalized };
        set({ session: updatedSession });
        localStorage.setItem('aegis_session', JSON.stringify(updatedSession));
        
        // Force sync the local mockDb school registry as well
        const dbSchoolsRaw = localStorage.getItem('aegis_erp_db_schools');
        if (dbSchoolsRaw) {
          try {
            const dbSchools = JSON.parse(dbSchoolsRaw);
            const idx = dbSchools.findIndex((s: any) => s.id === schoolId);
            if (idx !== -1 && dbSchools[idx].subscriptionPlan !== planNormalized) {
              dbSchools[idx].subscriptionPlan = planNormalized;
              localStorage.setItem('aegis_erp_db_schools', JSON.stringify(dbSchools));
            }
            
            // Keep the in-memory mockDb singleton in sync!
            const { mockDb } = await import('../services/mockDb');
            const memIdx = mockDb.schools.findIndex((s: any) => s.id === schoolId);
            if (memIdx !== -1) {
              mockDb.schools[memIdx].subscriptionPlan = planNormalized;
            }
          } catch (err) {
            console.error('Failed to sync mockDb schools local storage:', err);
          }
        }
      }
    } catch (e) {
      console.error('Failed to sync subscription plan in polling loop:', e);
    }
  },

  syncUserSession: async () => {
    const currentSession = get().session;
    if (!currentSession) return;
    try {
      const { supabase } = await import('../lib/supabase');
      const { data: dbUser, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', currentSession.user.id)
        .single();
      
      if (error || !dbUser) {
        console.error('Failed to fetch user from DB:', error);
        return;
      }

      // Check if user role has updated
      if (currentSession.user.role !== dbUser.role) {
        console.log(`Role updated in DB from ${currentSession.user.role} to ${dbUser.role}. Refreshing session...`);
        const updatedUser = {
          ...currentSession.user,
          role: dbUser.role,
          firstName: dbUser.first_name,
          lastName: dbUser.last_name,
          phone: dbUser.phone || '',
          isActive: dbUser.is_active
        };
        const updatedSession = { ...currentSession, user: updatedUser };
        set({ session: updatedSession });
        localStorage.setItem('aegis_session', JSON.stringify(updatedSession));
      }
    } catch (e) {
      console.error('Error in syncUserSession:', e);
    }
  },

  switchActiveRole: async (newRole: string) => {
    const currentSession = get().session;
    if (!currentSession) return;
    
    try {
      const { mockApi } = await import('../services/mockApi');
      const { supabase } = await import('../lib/supabase');
      
      // Update session's active role on server (updates users.role in database to cache RLS)
      await mockApi.switchActiveRole(currentSession.user.id, currentSession.user.schoolId || '', newRole as any);

      // Resolve sub-entity IDs for student, teacher, or parent if the target role requires it
      let studentId = currentSession.studentId;
      let teacherId = currentSession.teacherId;
      let parentId = currentSession.parentId;

      if (newRole === 'STUDENT' && !studentId) {
        const { data: st } = await supabase.from('students').select('id').eq('user_id', currentSession.user.id).maybeSingle();
        studentId = st?.id;
      } else if (newRole === 'TEACHER' && !teacherId) {
        const { data: tc } = await supabase.from('teachers').select('id').eq('user_id', currentSession.user.id).maybeSingle();
        teacherId = tc?.id;
      } else if (newRole === 'PARENT' && !parentId) {
        const { data: pr } = await supabase.from('parents').select('id').eq('user_id', currentSession.user.id).maybeSingle();
        parentId = pr?.id;
      }

      // Create new session object with updated user role
      const updatedUser = {
        ...currentSession.user,
        role: newRole as any
      };
      
      const updatedSession = {
        ...currentSession,
        user: updatedUser,
        studentId,
        teacherId,
        parentId
      };

      set({ session: updatedSession });
      localStorage.setItem('aegis_session', JSON.stringify(updatedSession));
      console.log(`Zustand store: Successfully switched active role to ${newRole}`);
    } catch (e) {
      console.error('Zustand store: Failed to switch active role:', e);
      throw e;
    }
  }
}));
