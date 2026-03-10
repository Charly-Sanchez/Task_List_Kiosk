// Generate a random ID for the TV so controllers can connect.
const tvId = 'TV-' + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
let peer = null;

const ANNOUNCEMENT_ROTATION_MS = 5000;
const TASKS_PER_PAGE = 7;
const TASK_LOOP_TARGET = 3;
const MIN_ANNOUNCEMENT_SIZE_REM = 1.2;

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
const TASK_SPEED_PX_PER_SEC = 20;

const activeConnections = [];

// DOM Elements
const connectionScreen = document.getElementById('connection-screen');
const appContent = document.getElementById('app-content');
const announcementLayer = document.getElementById('announcement-layer');
const tasksLayer = document.getElementById('tasks-layer');
const announcementBox = document.getElementById('announcement-box');
const announcementText = document.getElementById('announcement-text');
const tvTasks = document.getElementById('tv-tasks');
const myIdElement = document.getElementById('my-id');
const tvIdCornerElement = document.getElementById('tv-id-corner');

function initDisplay() {
    peer = new Peer(tvId);

    peer.on('open', (id) => {
        myIdElement.innerText = id;
        tvIdCornerElement.innerText = `TV ID: ${id}`;

        const currentUrl = window.location.href;
        const controllerUrl = currentUrl.replace('display.html', 'controller.html') + '?id=' + id;

        new QRCode(document.getElementById('qrcode'), {
            text: controllerUrl,
            width: 256,
            height: 256,
            colorDark: '#4f6178',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.H
        });
    });

    peer.on('connection', (conn) => {
        activeConnections.push(conn);
        connectionScreen.classList.add('hidden');
        appContent.classList.remove('hidden');
        syncStateToConnection(conn);

        conn.on('data', (data) => {
            handleIncomingData(data, conn);
        });

        conn.on('close', () => {
            const index = activeConnections.indexOf(conn);
            if (index >= 0) activeConnections.splice(index, 1);
        });
    });

    peer.on('error', (err) => {
        console.error('PeerJS error:', err);
    });

    window.addEventListener('resize', () => {
        if (currentAnnouncement) {
            fitAnnouncementText(currentAnnouncement.size || 6);
        }
    });
}

function handleIncomingData(data, sourceConn) {
    if (!data || !data.type) return;

    if (data.type === 'announcements') {
        showAnnouncements(Array.isArray(data.announcements) ? data.announcements : []);
        broadcastState(sourceConn);
        return;
    }

    if (data.type === 'tasks') {
        showTasks(Array.isArray(data.tasks) ? data.tasks : []);
        broadcastState(sourceConn);
        return;
    }

    // Backward compatibility for older payloads.
    if (data.type === 'announcement') {
        showAnnouncements([
            {
                html: escapeHtml(data.text || ''),
                align: data.align || 'center',
                size: Number(data.size) || 6,
                fontFamily: 'Orbitron'
            }
        ]);
    }
}

function showAnnouncements(items) {
    stopTaskRoll();
    announcementQueue = items.filter((item) => item && item.html);

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
    tasksQueue = tasks;

    announcementLayer.classList.add('hidden');
    tasksLayer.classList.remove('hidden');

    if (tasksQueue.length === 0) {
        tvTasks.innerHTML = '<p style="font-size:2rem;color:#666;font-family:Orbitron;">NO HAY TAREAS PENDIENTES</p>';
        stopTaskRoll();
        return;
    }

    taskPages = chunkTasks(tasksQueue, TASKS_PER_PAGE);
    currentTaskPageIndex = 0;
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

function syncStateToConnection(conn) {
    if (!conn || !conn.open) return;

    conn.send({
        type: 'sync_state',
        announcements: announcementQueue,
        tasks: tasksQueue
    });
}

function broadcastState(excludeConn) {
    activeConnections.forEach((conn) => {
        if (conn !== excludeConn && conn.open) {
            syncStateToConnection(conn);
        }
    });
}

function chunkTasks(items, size) {
    const output = [];
    for (let i = 0; i < items.length; i += size) {
        output.push(items.slice(i, i + size));
    }
    return output;
}

function escapeHtml(text) {
    const temp = document.createElement('div');
    temp.innerText = text;
    return temp.innerHTML;
}

window.onload = initDisplay;
