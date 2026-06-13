import { initializeApp, getApps, getApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || '',
};

let messaging: Messaging | null = null;
let isFirebaseSupported = false;

// Initialize Firebase in browser context
if (typeof window !== 'undefined' && 'serviceWorker' in navigator && firebaseConfig.messagingSenderId) {
  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    messaging = getMessaging(app);
    isFirebaseSupported = true;
  } catch (error) {
    console.warn('Firebase Messaging initialization skipped or not supported:', error);
  }
}

export { messaging, isFirebaseSupported, firebaseConfig };

/**
 * Requests browser permission, registers service worker with query params, 
 * generates the FCM Web Push token, and saves it to the database.
 */
export const requestNotificationPermission = async (userId: string, role: string): Promise<string | null> => {
  if (!isFirebaseSupported || !messaging) {
    console.warn('FCM Registration Skipped: Firebase Messaging config not found or unsupported.');
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const configParams = new URLSearchParams(firebaseConfig as any).toString();
      
      // Register service worker and inject firebase app configurations
      const registration = await navigator.serviceWorker.register(
        `/firebase-messaging-sw.js?${configParams}`
      );

      // Wait for service worker to be active to avoid "Subscription failed - no active Service Worker"
      await new Promise<void>((resolve) => {
        if (registration.active && registration.active.state === 'activated') {
          resolve();
          return;
        }

        const activeWorker = registration.installing || registration.waiting || registration.active;
        if (!activeWorker) {
          resolve();
          return;
        }

        const stateChangeHandler = () => {
          if (activeWorker.state === 'activated') {
            activeWorker.removeEventListener('statechange', stateChangeHandler);
            resolve();
          }
        };
        activeWorker.addEventListener('statechange', stateChangeHandler);
        stateChangeHandler();
      });

      const token = await getToken(messaging, {
        serviceWorkerRegistration: registration,
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY || ''
      });

      if (token) {
        console.log('FCM Web Push token generated successfully.');
        
        // Save the generated token to our backend registry endpoint
        const res = await fetch('/api/register-fcm-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, role, token })
        });
        
        if (!res.ok) {
          console.error('Failed to sync FCM registration token with registry database.');
        }
        return token;
      }
    } else {
      console.warn('Browser notifications permission denied by user.');
    }
  } catch (error) {
    console.error('An error occurred during FCM token generation:', error);
  }
  return null;
};
