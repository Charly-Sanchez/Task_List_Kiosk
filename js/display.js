// Generate a random ID for the TV so the user can connect
const tvId = 'TV-' + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
let peer = null;
const ANNOUNCEMENT_ROTATION_MS = 5000;
const TASKS_PER_PAGE = 7;
const TASK_LOOP_TARGET = 3;

let announcementRotationTimer = null;
let announcementQueue = [];
let tasksQueue = [];
let taskPages = [];
let currentTaskPageIndex = 0;
let taskLoopCount = 0;
let taskRollIterationHandler = null;
let announcementFadeTimeout = null;
const activeConnections = [];

// DOM Elements
const connectionScreen = document.getElementById('connection-screen');
const appContent = document.getElementById('app-content');
const announcementLayer = document.getElementById('announcement-layer');
const tasksLayer = document.getElementById('tasks-layer');
const announcementText = document.getElementById('announcement-text');
const tvTasks = document.getElementById('tv-tasks');
const myIdElement = document.getElementById('my-id');
const tvIdCornerElement = document.getElementById('tv-id-corner');

// Initialize PeerJS
function initDisplay() {
    peer = new Peer(tvId);

    peer.on('open', (id) => {
        myIdElement.innerText = id;
        tvIdCornerElement.innerText = `TV ID: ${id}`;
        
        // Generate QR code pointing to controller with the TV ID as query param
        // If hosted on gh-pages, this allows scanning to auto-connect (future enhancement)
        const currentUrl = window.location.href;
        const controllerUrl = currentUrl.replace('display.html', 'controller.html') + '?id=' + id;
        
        new QRCode(document.getElementById('qrcode'), {
            text: controllerUrl,
            width: 256,
            height: 256,
            colorDark : "#4f6178",
            colorLight : "#ffffff",
            correctLevel : QRCode.CorrectLevel.H
        });
    });

    peer.on('connection', (conn) => {
        console.log("Connected to controller:", conn.peer);
        activeConnections.push(conn);
        
        // Hide connection screen and show app content when connected
        connectionScreen.classList.add('hidden');
        appContent.classList.remove('hidden');
        syncStateToConnection(conn);

        conn.on('data', (data) => {
            handleIncomingData(data, conn);
        });

        conn.on('close', () => {
            const index = activeConnections.indexOf(conn);
            if (index >= 0) activeConnections.splice(index, 1);
            console.log("Connection closed");
        });
    });

    peer.on('error', (err) => {
        console.error("PeerJS error:", err);
    });
}

function handleIncomingData(data, sourceConn) {
    if (!data || !data.type) return;

    if (data.type === 'announcement') {
        showAnnouncements([
            {
                html: escapeHtml(data.text || ''),
                align: data.align || 'center',
                size: Number(data.size) || 6,
                fontFamily: 'Orbitron'
            }
        ]);
    } else if (data.type === 'announcements') {
        showAnnouncements(Array.isArray(data.announcements) ? data.announcements : []);
        broadcastState(sourceConn);
    } else if (data.type === 'tasks') {
        showTasks(data.tasks);
        broadcastState(sourceConn);
    }
}

function showAnnouncements(items) {
    stopTaskRoll();
    announcementQueue = items.filter((item) => item && item.html);

    tasksLayer.classList.add('hidden');
    announcementLayer.classList.remove('hidden');

    if (announcementQueue.length === 0) {
        announcementText.innerText = 'Sin anuncios para mostrar';
        announcementText.className = 'text-glow align-center';
        announcementText.style.fontSize = '4rem';
            renderAnnouncement(announcementQueue[index], false);
        stopAnnouncementRotation();
        return;
    }

    let index = 0;
                    renderAnnouncement(announcementQueue[index], true);
                }, ANNOUNCEMENT_ROTATION_MS);
    stopAnnouncementRotation();
    if (announcementQueue.length > 1) {
        announcementRotationTimer = setInterval(() => {
        function renderAnnouncement(item, smooth) {
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
            announcementText.style.fontSize = `${Number(item.size) || 6}rem`;
            announcementText.style.fontFamily = `${item.fontFamily || 'Orbitron'}, sans-serif`;
            announcementText.innerHTML = item.html;
function renderAnnouncement(item) {
    announcementText.className = 'text-glow';
    announcementText.classList.add('align-' + (item.align || 'center'));
    announcementText.style.fontSize = `${Number(item.size) || 6}rem`;
    announcementText.style.fontFamily = `${item.fontFamily || 'Orbitron'}, sans-serif`;
    announcementText.innerHTML = item.html;
}

function showAnnouncement(text, align, size) {
    showAnnouncements([
        {
            html: escapeHtml(text || ''),
            align: align,
            size: Number(size) || 6,
            fontFamily: 'Orbitron'
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
    stopAnnouncementRotation();
    tasksQueue = Array.isArray(tasks) ? tasks : [];

    tasksLayer.classList.add('hidden');
    announcementLayer.classList.add('hidden');
    tasksLayer.classList.remove('hidden');

    if (tasksQueue.length === 0) {
        tvTasks.innerHTML = '<p style="font-size: 2rem; color: #666; font-family: Orbitron;">NO HAY TAREAS PENDIENTES</p>';
        stopTaskRoll();
        return;
    }

    renderTaskRoulette(tasksQueue);
            const duration = Math.max(7, tasks.length * 1.35);

function syncStateToConnection(conn) {
                const distance = firstSet.offsetHeight;
    conn.send({
        type: 'sync_state',
        announcements: announcementQueue,
                attachTaskLoopListener();
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

    const duration = Math.max(ROTATION_MS / 1000, tasks.length * 2.8);

    requestAnimationFrame(() => {
        const distance = firstSet.offsetWidth;
        tvTasks.style.setProperty('--roll-distance', `-${distance}px`);
        tvTasks.style.animationDuration = `${duration}s`;
        tvTasks.classList.add('rolling');
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

function stopAnnouncementRotation() {
    if (announcementRotationTimer) {
        clearInterval(announcementRotationTimer);
        announcementRotationTimer = null;
    }
}

function stopTaskRoll() {
    if (taskRollIterationHandler) {
        tvTasks.removeEventListener('animationiteration', taskRollIterationHandler);
        taskRollIterationHandler = null;
    }

    tvTasks.classList.remove('rolling');
    tvTasks.classList.remove('soft-hidden');
    tvTasks.style.removeProperty('animation-duration');
    tvTasks.style.removeProperty('--roll-distance');
}

function attachTaskLoopListener() {
    if (taskRollIterationHandler) {
        tvTasks.removeEventListener('animationiteration', taskRollIterationHandler);
    }

    taskRollIterationHandler = () => {
        taskLoopCount += 1;
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
    };

    tvTasks.addEventListener('animationiteration', taskRollIterationHandler);
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

// Start app
window.onload = initDisplay;
