export interface SubscriptionFeatures {
  communications: boolean; // Forums/Discussions
  advancedAnalytics: boolean;
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
    },
    limits: {
      maxStudents: 9999999, // practically unlimited
      maxTeachers: 999999,
    }
  }
};
