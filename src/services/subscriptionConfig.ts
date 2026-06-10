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
