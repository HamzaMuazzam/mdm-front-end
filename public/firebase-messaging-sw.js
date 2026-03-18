importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyACBZ07GKV8lb0DeAo0Q0ssfsI55qRjb7Y',
  authDomain: 'mdm-core-3c92c.firebaseapp.com',
  projectId: 'mdm-core-3c92c',
  storageBucket: 'mdm-core-3c92c.firebasestorage.app',
  messagingSenderId: '277791045836',
  appId: '1:277791045836:web:3b79865bc43a1741f0aa69',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification ?? {};
  self.registration.showNotification(title ?? 'Notification', {
    body: body ?? '',
  });
});
