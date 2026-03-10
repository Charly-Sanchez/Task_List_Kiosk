// Replace these values with your Firebase Web App config.
export const firebaseConfig = {
    apiKey: 'AIzaSyCzOBfrmTfDFV7MUITKVkQe64_LeOxI-H4',
    authDomain: 'task-list-kiosk.firebaseapp.com',
    projectId: 'task-list-kiosk',
    storageBucket: 'task-list-kiosk.firebasestorage.app',
    messagingSenderId: '748498996203',
    appId: '1:748498996203:web:c4f04e98ae42dc0a11a7ae'
};

export function isFirebaseConfigured() {
    return Object.values(firebaseConfig).every((value) => value && value !== 'REPLACE_ME');
}
