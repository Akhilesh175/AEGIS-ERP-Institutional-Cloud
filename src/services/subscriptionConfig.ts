export interface SubscriptionFeatures {
  communications: boolean; // Forums/Discussions/Chat
  advancedAnalytics: boolean; // SaaS Telemetry
  billing: boolean; // Fee Management
  quizzes: boolean; // Online Exams
  auditLogs: boolean; // Global Audit Logs
}

export interface SubscriptionLimits {
  maxStudents: number;
  maxTeachers: number;
}

export interface SubscriptionConfig {
  features: SubscriptionFeatures;
  limits: SubscriptionLimits;
}

export const subscriptionPlans: Record<string, SubscriptionConfig> = {
  freemium: {
    features: {
      communications: false,
      advancedAnalytics: false,
      billing: false,
      quizzes: false,
      auditLogs: false,
    },
    limits: {
      maxStudents: 50,
      maxTeachers: 5,
    }
  },
  basic: {
    features: {
      communications: true,
      advancedAnalytics: false,
      billing: true,
      quizzes: false,
      auditLogs: false,
    },
    limits: {
      maxStudents: 500,
      maxTeachers: 50,
    }
  },
  pro: {
    features: {
      communications: true,
      advancedAnalytics: true,
      billing: true,
      quizzes: true,
      auditLogs: true,
    },
    limits: {
      maxStudents: 2500,
      maxTeachers: 200,
    }
  },
  enterprise: {
    features: {
      communications: true,
      advancedAnalytics: true,
      billing: true,
      quizzes: true,
      auditLogs: true,
    },
    limits: {
      maxStudents: 9999999, // practically unlimited
      maxTeachers: 999999,
    }
  }
};

export const isTabLocked = (role: string, tabId: string, planName: string): boolean => {
  const plan = planName.toLowerCase();
  if (role === 'STUDENT') {
    if (tabId === 'materials') return plan !== 'enterprise';
    if (tabId === 'library') return plan !== 'enterprise';
    if (tabId === 'transit') return plan !== 'enterprise';
    if (tabId === 'hostel') return plan !== 'enterprise';
    if (tabId === 'quizzes') return plan === 'freemium' || plan === 'basic';
    if (tabId === 'forums') return plan === 'freemium';
    if (tabId === 'fees') return plan === 'freemium';
  }
  if (role === 'PARENT') {
    if (tabId === 'homework') return plan !== 'enterprise';
    if (tabId === 'materials') return plan !== 'enterprise';
    if (tabId === 'library') return plan !== 'enterprise';
    if (tabId === 'transit') return plan !== 'enterprise';
    if (tabId === 'hostel') return plan !== 'enterprise';
    if (tabId === 'quizzes') return plan === 'freemium' || plan === 'basic';
    if (tabId === 'forums') return plan === 'freemium';
    if (tabId === 'fees') return plan === 'freemium';
  }
  if (role === 'TEACHER') {
    if (tabId === 'classroster') return plan === 'freemium';
    if (tabId === 'attendance') return plan === 'freemium';
    if (tabId === 'marksheets') return plan === 'freemium' || plan === 'basic';
    if (tabId === 'analytics') return plan !== 'enterprise';
    if (tabId === 'assignments') return plan !== 'enterprise';
    if (tabId === 'quizzes') return plan === 'freemium' || plan === 'basic';
    if (tabId === 'materials') return plan !== 'enterprise';
    if (tabId === 'forums') return plan === 'freemium';
  }
  if (role === 'ADMIN') {
    if (tabId === 'attendance') return plan === 'freemium';
    if (tabId === 'fees') return plan === 'freemium';
    if (tabId === 'hostel') return plan !== 'enterprise';
    if (tabId === 'communications') return plan === 'freemium';
    if (tabId === 'analytics') return plan === 'freemium' || plan === 'basic';
    if (tabId === 'rbac') return plan !== 'enterprise' && plan !== 'pro';
    if (tabId === 'backups') return plan !== 'enterprise';
  }
  return false;
};

