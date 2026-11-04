# Velvet & Vows

A React + Vite couples game with Firebase Authentication and Cloud Firestore real-time rooms/chat.

## Local development

1. Create a Firebase project.
2. Enable **Authentication → Anonymous**.
3. Create a Cloud Firestore database and configure rules appropriate for your use. Do not deploy unrestricted public write rules for production.
4. Copy `.env.example` to `.env` and fill in the Firebase web-app configuration.
5. Run `npm install` and `npm run build`.

Required environment variables: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`.

The app's original Firestore data path is `artifacts/{appId}/public/data/rooms/{roomCode}`. Configure Firestore security rules before inviting anyone. Firebase credentials are not included in this repository.
