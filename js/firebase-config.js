// firebase-config.js

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyD7F53ev6DSIwk-dTX_AI7QEpjg6--Z53I",
    authDomain: "mywebsite-38deb.firebaseapp.com",
    projectId: "mywebsite-38deb",
    storageBucket: "mywebsite-38deb.firebasestorage.app",
    messagingSenderId: "61618209135",
    appId: "1:61618209135:web:d10c16ae9a24a9df76a89a",
    measurementId: "G-J5SKQJW1LY"
};

// Global variables for Firebase services
let auth, db;

// Initialize Firebase with error handling
try {
    // Check if Firebase is already initialized to avoid duplicates
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
        console.log('🔥 Firebase initialized successfully');
        console.log('📊 Project ID:', firebaseConfig.projectId);
    } else {
        console.log('🔥 Firebase already initialized, using existing instance');
    }

    // Initialize Firebase services
    auth = firebase.auth();
    db = firebase.firestore();

    // Configure Firestore settings
    db.settings({ 
        merge: true 
    });

    console.log('✅ Firebase Auth service ready');
    console.log('✅ Firestore service ready');

    // Enable offline persistence for Firestore with better error handling
    const enablePersistence = async () => {
        try {
            await db.enablePersistence({
                synchronizeTabs: true
            });
            console.log('💾 Firestore offline persistence enabled');
        } catch (err) {
            if (err.code == 'failed-precondition') {
                console.log('⚠️ Persistence failed: Multiple tabs open');
            } else if (err.code == 'unimplemented') {
                console.log('⚠️ Persistence not supported by browser');
            } else {
                console.log('❌ Persistence error:', err);
            }
        }
    };

    // Only enable persistence in supported environments
    if (typeof window !== 'undefined' && window.indexedDB) {
        enablePersistence();
    }

} catch (error) {
    console.error('💥 Firebase initialization error:', error);
    
    // Provide helpful error messages
    if (error.code === 'app/duplicate-app') {
        console.error('Firebase app already exists. This is normal in development.');
    } else {
        console.error('Check your Firebase configuration and internet connection.');
    }
}

// Export services for use in other files
if (typeof module !== 'undefined' && module.exports) {
    // Node.js environment
    module.exports = { firebase, auth, db, firebaseConfig };
} else {
    // Browser environment - attach to window object
    window.firebaseServices = { auth, db };
}

console.log("🚀 Firebase services ready to use");

// Utility function to check Firebase connection
function checkFirebaseConnection() {
    console.group('🔍 Firebase Connection Check');
    console.log('Firebase App:', firebase.app().name);
    console.log('Project ID:', firebase.app().options.projectId);
    console.log('Auth Domain:', firebase.app().options.authDomain);
    
    // Test Auth service
    auth.onAuthStateChanged((user) => {
        console.log('Auth Service:', user ? `Connected - User: ${user.email}` : 'Connected - No user');
    });
    
    // Test Firestore service
    db.collection('test').doc('connection').get()
        .then(() => console.log('Firestore Service: ✅ Connected'))
        .catch(err => console.log('Firestore Service: ❌ Error -', err.message));
    
    console.groupEnd();
}

// Auto-check connection when in development
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    setTimeout(checkFirebaseConnection, 1000);
}

// Error handling for Firebase services
auth.onAuthStateChanged((user) => {
    if (user) {
        console.log('👤 User authenticated:', user.email);
    } else {
        console.log('👤 No user signed in');
    }
});

// Handle auth errors
auth.useDeviceLanguage();

// Export for global access
window.firebaseAuth = auth;
window.firebaseDb = db;

console.log('🎯 Firebase configuration completed successfully');