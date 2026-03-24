import {
    ensureFirebaseAuth,
    mutateKioskState,
    resetKioskState,
    subscribeKioskHistory,
    subscribeKioskState,
    upsertKiosk
} from './firebase-service.js';

let tasks = [];
let announcements = [];
let currentTvId = null;
let actorId = null;
let unsubscribeState = null;
let unsubscribeHistory = null;
let editingAnnouncementId = null;

const connectBtn = document.getElementById('connect-btn');
const disconnectBtn = document.getElementById('disconnect-btn');
const targetIdInput = document.getElementById('target-id');
const statusMsg = document.getElementById('connection-status');
const connectPanel = document.getElementById('connect-panel');
const controlPanel = document.getElementById('control-panel');

const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

const announcementEditor = document.getElementById('announcement-editor');
const alignSelect = document.getElementById('align-select');
const fontSelect = document.getElementById('font-select');
const sendAnnouncementsBtn = document.getElementById('send-announcements');
const addAnnouncementBtn = document.getElementById('add-announcement-btn');
const announcementList = document.getElementById('announcement-list');
const formatBtns = document.querySelectorAll('.format-btn');

const newTaskInput = document.getElementById('new-task-input');
const addTaskBtn = document.getElementById('add-task-btn');
const mobileTasksContainer = document.getElementById('mobile-tasks');
const syncTasksBtn = document.getElementById('sync-tasks-btn');
const historyList = document.getElementById('history-list');
const resetKioskBtn = document.getElementById('reset-kiosk-btn');

function initController() {
    const urlParams = new URLSearchParams(window.location.search);
    const idFromUrl = urlParams.get('id');
    if (idFromUrl) {
        targetIdInput.value = idFromUrl.toUpperCase();
    }

    connectBtn.addEventListener('click', connectToTv);
    disconnectBtn.addEventListener('click', disconnect);
    sendAnnouncementsBtn.addEventListener('click', projectAnnouncementsMode);
    addAnnouncementBtn.addEventListener('click', addAnnouncement);
    syncTasksBtn.addEventListener('click', projectTasksMode);
    addTaskBtn.addEventListener('click', addTask);
    resetKioskBtn.addEventListener('click', handleResetKiosk);

    newTaskInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTask();
    });

    tabBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            tabBtns.forEach((b) => b.classList.remove('active'));
            tabContents.forEach((c) => c.classList.add('hidden'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.target).classList.remove('hidden');
        });
    });

    formatBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            announcementEditor.focus();
            document.execCommand(btn.dataset.cmd, false, null);
        });
    });

    renderMobileTasks();
    renderAnnouncementQueue();
    renderHistory([]);
}

async function connectToTv() {
    const tvId = targetIdInput.value.trim().toUpperCase();
    if (!tvId) {
        setStatus('Por favor ingresa un ID valido.', '#ff3333');
        return;
    }

    setStatus('Conectando a Firebase...', 'var(--neon-blue)');

    try {
        const user = await ensureFirebaseAuth();
        actorId = user.uid;
        currentTvId = tvId;

        await upsertKiosk(currentTvId);
        startSubscriptions();

        connectPanel.classList.add('hidden');
        controlPanel.classList.remove('hidden');
        setStatus('Conectado', 'var(--neon-green)');
    } catch (error) {
        console.error(error);
        setStatus('Error al conectar Firebase. Revisa configuracion.', '#ff3333');
    }
}

function startSubscriptions() {
    cleanupSubscriptions();

    unsubscribeState = subscribeKioskState(
        currentTvId,
        (state) => {
            tasks = state.tasks;
            announcements = state.announcements;
            renderMobileTasks();
            renderAnnouncementQueue();
        },
        (err) => {
            console.error(err);
            setStatus('Error de sincronizacion en tiempo real.', '#ff3333');
        }
    );

    unsubscribeHistory = subscribeKioskHistory(
        currentTvId,
        (items) => renderHistory(items),
        (err) => console.error(err)
    );
}

function disconnect() {
    cleanupSubscriptions();
    currentTvId = null;
    connectPanel.classList.remove('hidden');
    controlPanel.classList.add('hidden');
    setStatus('Desconectado.', '#aaa');
}

function cleanupSubscriptions() {
    if (unsubscribeState) {
        unsubscribeState();
        unsubscribeState = null;
    }
    if (unsubscribeHistory) {
        unsubscribeHistory();
        unsubscribeHistory = null;
    }
}

function setStatus(text, color) {
    statusMsg.innerText = text;
    statusMsg.style.color = color;
}

async function projectAnnouncementsMode() {
    await updateState((state) => ({
        state: {
            ...state,
            activeMode: 'announcements'
        },
        type: 'mode_announcements',
        message: 'Modo anuncios activado'
    }));
}

async function projectTasksMode() {
    await updateState((state) => ({
        state: {
            ...state,
            activeMode: 'tasks'
        },
        type: 'mode_tasks',
        message: 'Modo tareas activado'
    }));
}

async function addAnnouncement() {
    const html = sanitizeRichHtml(announcementEditor.innerHTML);
    const plainText = stripHtml(html).trim();
    if (!plainText) return;

    const targetId = editingAnnouncementId || Date.now().toString();

    await updateState((state) => {
        const existing = state.announcements.find((item) => item.id === targetId);

        if (existing) {
            existing.html = html;
            existing.align = alignSelect.value;
            existing.fontFamily = fontSelect.value;
        } else {
            state.announcements.push({
                id: targetId,
                html,
                align: alignSelect.value,
                fontFamily: fontSelect.value
            });
        }

        state.activeMode = 'announcements';

        return {
            state,
            type: existing ? 'announcement_edit' : 'announcement_add',
            message: existing ? 'Se edito un anuncio' : 'Se agrego un anuncio',
            payload: { id: targetId }
        };
    });

    announcementEditor.innerHTML = '';
    editingAnnouncementId = null;
    addAnnouncementBtn.querySelector('.btn-text').innerText = 'AGREGAR A COLA';
}

function editAnnouncement(id) {
    const item = announcements.find((row) => row.id === id);
    if (!item) return;

    editingAnnouncementId = id;
    announcementEditor.innerHTML = item.html || '';
    alignSelect.value = item.align || 'center';
    fontSelect.value = item.fontFamily || 'Orbitron';
    addAnnouncementBtn.querySelector('.btn-text').innerText = 'GUARDAR EDICION';
}

async function deleteAnnouncement(id) {
    await updateState((state) => {
        state.announcements = state.announcements.filter((item) => item.id !== id);
        return {
            state,
            type: 'announcement_delete',
            message: 'Se elimino un anuncio',
            payload: { id }
        };
    });
}

async function addTask() {
    const text = newTaskInput.value.trim();
    if (!text) return;

    const task = {
        id: Date.now().toString(),
        text,
        completed: false
    };

    await updateState((state) => {
        state.tasks.push(task);
        state.activeMode = 'tasks';
        return {
            state,
            type: 'task_add',
            message: 'Se agrego una tarea',
            payload: { id: task.id }
        };
    });

    newTaskInput.value = '';
}

async function editTask(id) {
    const task = tasks.find((item) => item.id === id);
    if (!task) return;

    const nextText = prompt('Editar tarea:', task.text);
    if (nextText === null) return;

    const trimmed = nextText.trim();
    if (!trimmed) return;

    await updateState((state) => {
        const row = state.tasks.find((item) => item.id === id);
        if (row) row.text = trimmed;
        return {
            state,
            type: 'task_edit',
            message: 'Se edito una tarea',
            payload: { id }
        };
    });
}

async function toggleTask(id) {
    await updateState((state) => {
        const task = state.tasks.find((item) => item.id === id);
        if (task) task.completed = !task.completed;
        return {
            state,
            type: 'task_toggle',
            message: 'Se actualizo una tarea',
            payload: { id }
        };
    });
}

async function deleteTask(id) {
    await updateState((state) => {
        state.tasks = state.tasks.filter((item) => item.id !== id);
        return {
            state,
            type: 'task_delete',
            message: 'Se elimino una tarea',
            payload: { id }
        };
    });
}

async function updateState(mutateFn) {
    if (!currentTvId || !actorId) {
        alert('Conectate primero a una TV.');
        return;
    }

    try {
        await mutateKioskState(currentTvId, actorId, mutateFn);
    } catch (error) {
        console.error(error);
        alert('No se pudo guardar el cambio en Firebase.');
    }
}

async function handleResetKiosk() {
    if (!currentTvId) {
        alert('Conectate primero a una TV.');
        return;
    }

    const ok = confirm('Esto borrara tareas, anuncios e historial. Continuar?');
    if (!ok) return;

    try {
        await resetKioskState(currentTvId);
        editingAnnouncementId = null;
        addAnnouncementBtn.querySelector('.btn-text').innerText = 'AGREGAR A COLA';
    } catch (error) {
        console.error(error);
        alert('No se pudo ejecutar el reset total.');
    }
}

function renderAnnouncementQueue() {
    announcementList.innerHTML = '';

    if (announcements.length === 0) {
        announcementList.innerHTML = '<p style="color:#666;text-align:center;padding:8px;">No hay anuncios en cola.</p>';
        return;
    }

    announcements.forEach((item, index) => {
        const row = document.createElement('div');
        row.className = 'announcement-item';

        const preview = document.createElement('div');
        preview.className = 'announcement-preview';
        preview.innerText = stripHtml(item.html).trim();

        const meta = document.createElement('div');
        meta.className = 'announcement-meta';
        meta.innerText = `#${index + 1} | ${item.fontFamily} | Tamaño auto | ${item.align}`;

        const infoWrap = document.createElement('div');
        infoWrap.style.flex = '1';
        infoWrap.appendChild(preview);
        infoWrap.appendChild(meta);

        const removeBtn = document.createElement('button');
        removeBtn.className = 'announcement-remove-btn';
        removeBtn.type = 'button';
        removeBtn.innerText = '✗';
        removeBtn.addEventListener('click', () => deleteAnnouncement(item.id));

        const editBtn = document.createElement('button');
        editBtn.className = 'announcement-remove-btn';
        editBtn.type = 'button';
        editBtn.style.color = '#f5c96f';
        editBtn.innerText = '✎';
        editBtn.addEventListener('click', () => editAnnouncement(item.id));

        row.appendChild(infoWrap);
        row.appendChild(editBtn);
        row.appendChild(removeBtn);
        announcementList.appendChild(row);
    });
}

function renderMobileTasks() {
    mobileTasksContainer.innerHTML = '';

    if (tasks.length === 0) {
        mobileTasksContainer.innerHTML = '<p style="color:#666;text-align:center;margin-top:20px;">No hay tareas. Agregalas arriba.</p>';
        return;
    }

    tasks.forEach((task) => {
        const item = document.createElement('div');
        item.className = 'mobile-task-item' + (task.completed ? ' completed' : '');

        const text = document.createElement('span');
        text.innerText = task.text;

        const actions = document.createElement('div');
        actions.className = 'task-actions';

        const checkBtn = document.createElement('button');
        checkBtn.className = 'check-btn';
        checkBtn.type = 'button';
        checkBtn.innerText = '✓';
        checkBtn.addEventListener('click', () => toggleTask(task.id));

        const delBtn = document.createElement('button');
        delBtn.className = 'del-btn';
        delBtn.type = 'button';
        delBtn.innerText = '✗';
        delBtn.addEventListener('click', () => deleteTask(task.id));

        const editBtn = document.createElement('button');
        editBtn.className = 'edit-btn';
        editBtn.type = 'button';
        editBtn.innerText = '✎';
        editBtn.addEventListener('click', () => editTask(task.id));

        actions.appendChild(checkBtn);
        actions.appendChild(editBtn);
        actions.appendChild(delBtn);
        item.appendChild(text);
        item.appendChild(actions);
        mobileTasksContainer.appendChild(item);
    });
}

function renderHistory(items) {
    historyList.innerHTML = '';

    if (!items || items.length === 0) {
        historyList.innerHTML = '<p style="color:#666;text-align:center;padding:8px;">Sin eventos aun.</p>';
        return;
    }

    items.forEach((item) => {
        const row = document.createElement('div');
        row.className = 'announcement-item';

        const message = document.createElement('div');
        message.className = 'announcement-preview';
        message.innerText = item.message || item.type || 'Evento';

        const meta = document.createElement('div');
        meta.className = 'announcement-meta';
        const date = item.createdAt?.toDate ? item.createdAt.toDate() : null;
        meta.innerText = date ? date.toLocaleString() : 'Pendiente de fecha';

        row.appendChild(message);
        row.appendChild(meta);
        historyList.appendChild(row);
    });
}

function sanitizeRichHtml(input) {
    const template = document.createElement('template');
    template.innerHTML = input || '';

    const allowed = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'BR', 'P', 'DIV', 'UL', 'OL', 'LI', 'SPAN']);

    function cleanNode(node) {
        if (node.nodeType === Node.TEXT_NODE) return;
        if (node.nodeType !== Node.ELEMENT_NODE) {
            node.remove();
            return;
        }

        if (!allowed.has(node.tagName)) {
            const parent = node.parentNode;
            while (node.firstChild) {
                parent.insertBefore(node.firstChild, node);
            }
            parent.removeChild(node);
            return;
        }

        Array.from(node.attributes).forEach((attr) => node.removeAttribute(attr.name));
        Array.from(node.childNodes).forEach(cleanNode);
    }

    Array.from(template.content.childNodes).forEach(cleanNode);
    return template.innerHTML.trim();
}

function stripHtml(html) {
    const temp = document.createElement('div');
    temp.innerHTML = html || '';
    return temp.textContent || temp.innerText || '';
}

window.onload = initController;
