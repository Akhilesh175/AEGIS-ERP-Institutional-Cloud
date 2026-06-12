// Give the service worker access to Firebase Messaging.
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// Parse Firebase credentials passed dynamically from the main thread registration query parameters
const params = new URLSearchParams(self.location.search);
const firebaseConfig = {
  apiKey: params.get('apiKey') || '',
  authDomain: params.get('authDomain') || '',
  projectId: params.get('projectId') || '',
  storageBucket: params.get('storageBucket') || '',
  messagingSenderId: params.get('messagingSenderId') || '',
  appId: params.get('appId') || '',
};

if (firebaseConfig.messagingSenderId) {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  // Background Notification Listener
  messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Background Push Message received:', payload);
    
    const title = payload.notification?.title || payload.data?.title || 'Aegis ERP Alert';
    const options = {
      body: payload.notification?.body || payload.data?.body || 'New message notification received.',
      icon: '/logo.png',
      badge: '/badge.png',
      data: payload.data,
      tag: payload.data?.tag || 'aegis-notification'
    };

    self.registration.showNotification(title, options);
  });
}
