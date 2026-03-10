// Replace these values with your Firebase Web App config.
export const firebaseConfig = {
    apiKey: 'REPLACE_ME',
    authDomain: 'REPLACE_ME',
    projectId: 'REPLACE_ME',
    storageBucket: 'REPLACE_ME',
    messagingSenderId: 'REPLACE_ME',
    appId: 'REPLACE_ME'
};

export function isFirebaseConfigured() {
    return Object.values(firebaseConfig).every((value) => value && value !== 'REPLACE_ME');
}
