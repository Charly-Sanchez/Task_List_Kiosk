import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import {
    collection,
    deleteDoc,
    doc,
    getFirestore,
    getDocs,
    limit,
    onSnapshot,
    orderBy,
    query,
    runTransaction,
    serverTimestamp,
    setDoc,
    writeBatch
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { firebaseConfig, isFirebaseConfigured } from './firebase-config.js';

let app = null;
let auth = null;
let db = null;

function getDefaultState() {
    return {
        tasks: [],
        announcements: [],
        activeMode: 'announcements'
    };
}

function normalizeState(data) {
    const base = getDefaultState();
    return {
        tasks: Array.isArray(data?.tasks) ? data.tasks : base.tasks,
        announcements: Array.isArray(data?.announcements) ? data.announcements : base.announcements,
        activeMode: data?.activeMode === 'tasks' ? 'tasks' : 'announcements',
        updatedAt: data?.updatedAt || null,
        updatedBy: data?.updatedBy || null
    };
}

function ensureInitialized() {
    if (!isFirebaseConfigured()) {
        throw new Error('Firebase no esta configurado. Edita js/firebase-config.js');
    }

    if (!app) {
        app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
    }

    return { auth, db };
}

export async function ensureFirebaseAuth() {
    const { auth: authInstance } = ensureInitialized();

    if (authInstance.currentUser) {
        return authInstance.currentUser;
    }

    const result = await signInAnonymously(authInstance);
    return result.user;
}

export async function upsertKiosk(tvId) {
    const { db: dbInstance } = ensureInitialized();
    const ref = doc(dbInstance, 'kiosks', tvId);

    await runTransaction(dbInstance, async (transaction) => {
        const snapshot = await transaction.get(ref);
        if (snapshot.exists()) {
            return;
        }

        transaction.set(ref, {
            ...getDefaultState(),
            updatedAt: serverTimestamp()
        });
    });
}

export function subscribeKioskState(tvId, onState, onError) {
    const { db: dbInstance } = ensureInitialized();
    const ref = doc(dbInstance, 'kiosks', tvId);

    return onSnapshot(
        ref,
        (snapshot) => {
            const state = normalizeState(snapshot.exists() ? snapshot.data() : null);
            onState(state);
        },
        (error) => {
            if (onError) onError(error);
        }
    );
}

export function subscribeKioskHistory(tvId, onHistory, onError) {
    const { db: dbInstance } = ensureInitialized();
    const historyRef = collection(dbInstance, 'kiosks', tvId, 'history');
    const historyQuery = query(historyRef, orderBy('createdAt', 'desc'), limit(20));

    return onSnapshot(
        historyQuery,
        (snapshot) => {
            const items = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
            onHistory(items);
        },
        (error) => {
            if (onError) onError(error);
        }
    );
}

export async function mutateKioskState(tvId, actorId, mutateFn) {
    const { db: dbInstance } = ensureInitialized();
    const kioskRef = doc(dbInstance, 'kiosks', tvId);

    await runTransaction(dbInstance, async (transaction) => {
        const snap = await transaction.get(kioskRef);
        const current = normalizeState(snap.exists() ? snap.data() : null);
        const nextInput = JSON.parse(JSON.stringify(current));

        const result = mutateFn(nextInput);
        if (!result || !result.state) return;

        const next = normalizeState(result.state);

        transaction.set(
            kioskRef,
            {
                tasks: next.tasks,
                announcements: next.announcements,
                activeMode: next.activeMode,
                updatedBy: actorId,
                updatedAt: serverTimestamp()
            },
            { merge: true }
        );

        const historyRef = doc(collection(dbInstance, 'kiosks', tvId, 'history'));
        transaction.set(historyRef, {
            type: result.type || 'update',
            message: result.message || 'Cambio aplicado',
            actorId,
            payload: result.payload || null,
            createdAt: serverTimestamp()
        });
    });
}

export async function resetKioskState(tvId) {
    const { db: dbInstance } = ensureInitialized();
    const kioskRef = doc(dbInstance, 'kiosks', tvId);

    await setDoc(
        kioskRef,
        {
            ...getDefaultState(),
            updatedAt: serverTimestamp(),
            updatedBy: 'reset'
        },
        { merge: true }
    );

    const historyRef = collection(dbInstance, 'kiosks', tvId, 'history');

    while (true) {
        const snapshot = await getDocs(query(historyRef, limit(100)));
        if (snapshot.empty) break;

        const batch = writeBatch(dbInstance);
        snapshot.docs.forEach((docSnap) => batch.delete(docSnap.ref));
        await batch.commit();
    }
}
