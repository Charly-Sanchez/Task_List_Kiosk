import {
    ensureFirebaseAuth,
    subscribeKioskState,
    upsertKiosk
} from './firebase-service.js';

const ANNOUNCEMENT_ROTATION_MS = 5000;
const TASKS_PER_PAGE = 7;
const TASK_LOOP_TARGET = 3;
const MIN_ANNOUNCEMENT_SIZE_REM = 1.2;
const TASK_SPEED_PX_PER_SEC = 20;

let announcementRotationTimer = null;
let announcementFadeTimeout = null;
let announcementQueue = [];
let currentAnnouncement = null;

let tasksQueue = [];
let taskPages = [];
let currentTaskPageIndex = 0;
let taskLoopCount = 0;
let taskRollRafId = null;
let taskRollLastTs = 0;
let taskOffsetPx = 0;
let taskSetHeightPx = 0;
let activeMode = 'announcements';
let interleaveMode = false;
let announcementIndex = 0;
let lastTasksSignature = '';

const connectionScreen = document.getElementById('connection-screen');
const appContent = document.getElementById('app-content');
const announcementLayer = document.getElementById('announcement-layer');
const tasksLayer = document.getElementById('tasks-layer');
const announcementBox = document.getElementById('announcement-box');
const announcementText = document.getElementById('announcement-text');
const tvTasks = document.getElementById('tv-tasks');
const myIdElement = document.getElementById('my-id');
const tvIdCornerElement = document.getElementById('tv-id-corner');

function getTvIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('tv');
    if (fromQuery) {
        const normalized = fromQuery.toUpperCase();
        localStorage.setItem('kioskTvId', normalized);
        return normalized;
    }

    const persisted = localStorage.getItem('kioskTvId');
    if (persisted) {
        params.set('tv', persisted);
        const nextPersisted = `${window.location.pathname}?${params.toString()}`;
        window.history.replaceState({}, '', nextPersisted);
        return persisted;
    }

    const generated = 'TV-' + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    localStorage.setItem('kioskTvId', generated);
    params.set('tv', generated);
    const next = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', next);
    return generated;
}

async function initDisplay() {
    const tvId = getTvIdFromUrl();
    myIdElement.innerText = tvId;
    tvIdCornerElement.innerText = `TV ID: ${tvId}`;

    const baseUrl = `${window.location.origin}${window.location.pathname}`;
    const controllerUrl = baseUrl.replace('display.html', 'controller.html') + `?id=${tvId}`;

    new QRCode(document.getElementById('qrcode'), {
        text: controllerUrl,
        width: 256,
        height: 256,
        colorDark: '#4f6178',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
    });

    try {
        await ensureFirebaseAuth();
        await upsertKiosk(tvId);

        subscribeKioskState(
            tvId,
            (state) => {
                announcementQueue = state.announcements;
                tasksQueue = state.tasks;
                activeMode = state.activeMode;
                renderByMode();
            },
            (error) => {
                console.error(error);
            }
        );

        connectionScreen.classList.add('hidden');
        appContent.classList.remove('hidden');
    } catch (error) {
        console.error(error);
        alert('No se pudo iniciar Firebase. Revisa js/firebase-config.js');
    }

    window.addEventListener('resize', () => {
        if (currentAnnouncement) {
            fitAnnouncementText(currentAnnouncement.size || 6);
        }
    });
}

function renderByMode() {
    interleaveMode = announcementQueue.length > 0 && tasksQueue.length > 0;

    if (interleaveMode) {
        showAnnouncements(announcementQueue);
        return;
    }

    if (activeMode === 'tasks') {
        showTasks(tasksQueue);
    } else {
        showAnnouncements(announcementQueue);
    }
}

function showAnnouncements(items) {
    stopTaskRoll();
    announcementQueue = Array.isArray(items) ? items.filter((item) => item && item.html) : [];

    tasksLayer.classList.add('hidden');
    announcementLayer.classList.remove('hidden');

    if (announcementQueue.length === 0) {
        currentAnnouncement = null;
        announcementText.innerText = 'Sin anuncios para mostrar';
        announcementText.className = 'text-glow align-center';
        announcementText.style.fontFamily = 'Orbitron, sans-serif';
        announcementText.style.fontSize = '4rem';
        stopAnnouncementRotation();
        return;
    }

    if (interleaveMode) {
        announcementIndex = announcementIndex % announcementQueue.length;
        renderAnnouncement(announcementQueue[announcementIndex], false);
        announcementIndex = (announcementIndex + 1) % announcementQueue.length;

        stopAnnouncementRotation();
        announcementRotationTimer = setInterval(() => {
            stopAnnouncementRotation();
            showTasks(tasksQueue);
        }, ANNOUNCEMENT_ROTATION_MS);
        return;
    }

    let index = 0;
    renderAnnouncement(announcementQueue[index], false);

    stopAnnouncementRotation();
    if (announcementQueue.length > 1) {
        announcementRotationTimer = setInterval(() => {
            index = (index + 1) % announcementQueue.length;
            renderAnnouncement(announcementQueue[index], true);
        }, ANNOUNCEMENT_ROTATION_MS);
    }
}

function renderAnnouncement(item, smooth) {
    currentAnnouncement = item;

    if (!smooth) {
        applyAnnouncement(item);
        return;
    }

    if (announcementFadeTimeout) {
        clearTimeout(announcementFadeTimeout);
    }

    announcementText.classList.add('fade-out');
    announcementFadeTimeout = setTimeout(() => {
        applyAnnouncement(item);
        announcementText.classList.remove('fade-out');
    }, 260);
}

function applyAnnouncement(item) {
    announcementText.className = 'text-glow';
    announcementText.classList.add('align-' + (item.align || 'center'));
    announcementText.style.fontFamily = `${item.fontFamily || 'Orbitron'}, sans-serif`;
    announcementText.innerHTML = item.html;
    fitAnnouncementText(Number(item.size) || 6);
}

function fitAnnouncementText(preferredRem) {
    if (!announcementBox || !announcementText) return;

    const rootFont = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const maxPx = Math.max(MIN_ANNOUNCEMENT_SIZE_REM * rootFont, preferredRem * rootFont);
    const minPx = MIN_ANNOUNCEMENT_SIZE_REM * rootFont;

    let low = minPx;
    let high = maxPx;
    let best = minPx;

    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        announcementText.style.fontSize = `${mid}px`;

        const fitsWidth = announcementText.scrollWidth <= announcementBox.clientWidth;
        const fitsHeight = announcementText.scrollHeight <= announcementBox.clientHeight;

        if (fitsWidth && fitsHeight) {
            best = mid;
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }

    announcementText.style.fontSize = `${best}px`;
}

function showTasks(tasks) {
    stopAnnouncementRotation();
    tasksQueue = Array.isArray(tasks) ? tasks : [];

    announcementLayer.classList.add('hidden');
    tasksLayer.classList.remove('hidden');

    if (tasksQueue.length === 0) {
        tvTasks.innerHTML = '<p style="font-size:2rem;color:#666;font-family:Orbitron;">NO HAY TAREAS PENDIENTES</p>';
        stopTaskRoll();
        return;
    }

    const nextPages = chunkTasks(tasksQueue, TASKS_PER_PAGE);
    const nextSignature = buildTasksSignature(tasksQueue);

    const tasksChanged = nextSignature !== lastTasksSignature;
    taskPages = nextPages;
    lastTasksSignature = nextSignature;

    if (tasksChanged) {
        currentTaskPageIndex = 0;
    } else if (taskPages.length > 0) {
        currentTaskPageIndex = currentTaskPageIndex % taskPages.length;
    }

    startTaskPageRoll();
}

function startTaskPageRoll() {
    const currentPage = taskPages[currentTaskPageIndex] || [];
    renderTaskRoulette(currentPage);
    taskLoopCount = 0;
}

function renderTaskRoulette(tasks) {
    tvTasks.innerHTML = '';
    stopTaskRoll();

    const firstSet = document.createElement('div');
    firstSet.className = 'tasks-track-set';

    tasks.forEach((task, index) => {
        firstSet.appendChild(createTaskCard(task, index + 1));
    });

    const secondSet = firstSet.cloneNode(true);
    tvTasks.appendChild(firstSet);
    tvTasks.appendChild(secondSet);

    requestAnimationFrame(() => {
        taskSetHeightPx = firstSet.offsetHeight;
        taskOffsetPx = 0;
        taskRollLastTs = 0;
        tvTasks.style.transform = 'translateY(0px)';
        taskRollRafId = requestAnimationFrame(stepTaskMarquee);
    });
}

function stepTaskMarquee(timestamp) {
    if (!taskRollLastTs) {
        taskRollLastTs = timestamp;
    }

    const dt = (timestamp - taskRollLastTs) / 1000;
    taskRollLastTs = timestamp;
    taskOffsetPx += TASK_SPEED_PX_PER_SEC * dt;

    if (taskSetHeightPx > 0 && taskOffsetPx >= taskSetHeightPx) {
        taskOffsetPx -= taskSetHeightPx;
        taskLoopCount += 1;
        handleTaskLoopCompleted();
    }

    tvTasks.style.transform = `translateY(-${taskOffsetPx}px)`;
    taskRollRafId = requestAnimationFrame(stepTaskMarquee);
}

function handleTaskLoopCompleted() {
    if (taskLoopCount < TASK_LOOP_TARGET) return;

    taskLoopCount = 0;

    if (interleaveMode && announcementQueue.length > 0) {
        if (taskPages.length > 1) {
            currentTaskPageIndex = (currentTaskPageIndex + 1) % taskPages.length;
        }
        showAnnouncements(announcementQueue);
        return;
    }

    if (taskPages.length <= 1) {
        if (announcementQueue.length > 0) {
            showAnnouncements(announcementQueue);
        }
        return;
    }

    currentTaskPageIndex = (currentTaskPageIndex + 1) % taskPages.length;
    tvTasks.classList.add('soft-hidden');

    setTimeout(() => {
        startTaskPageRoll();
        tvTasks.classList.remove('soft-hidden');
    }, 300);
}

function createTaskCard(task, orderNumber) {
    const card = document.createElement('div');
    card.className = 'task-card' + (task.completed ? ' completed' : '');

    const order = document.createElement('div');
    order.className = 'task-index';
    order.innerText = task.completed ? 'OK' : String(orderNumber).padStart(2, '0');

    const text = document.createElement('div');
    text.className = 'task-text';
    text.innerText = task.text;

    card.appendChild(order);
    card.appendChild(text);
    return card;
}

function stopAnnouncementRotation() {
    if (announcementRotationTimer) {
        clearInterval(announcementRotationTimer);
        announcementRotationTimer = null;
    }

    if (announcementFadeTimeout) {
        clearTimeout(announcementFadeTimeout);
        announcementFadeTimeout = null;
    }
}

function stopTaskRoll() {
    if (taskRollRafId) {
        cancelAnimationFrame(taskRollRafId);
        taskRollRafId = null;
    }

    tvTasks.classList.remove('soft-hidden');
    tvTasks.style.transform = 'translateY(0px)';
    taskRollLastTs = 0;
    taskOffsetPx = 0;
    taskSetHeightPx = 0;
}

function chunkTasks(items, size) {
    const output = [];
    for (let i = 0; i < items.length; i += size) {
        output.push(items.slice(i, i + size));
    }
    return output;
}

function buildTasksSignature(tasks) {
    return tasks
        .map((task) => `${task.id || ''}:${task.text || ''}:${task.completed ? '1' : '0'}`)
        .join('|');
}

window.onload = initDisplay;
