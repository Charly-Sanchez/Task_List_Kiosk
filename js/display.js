// Generate a random ID for the TV so the user can connect
const tvId = 'TV-' + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
let peer = null;
const ROTATION_MS = 10000;

let announcementRotationTimer = null;
let announcementQueue = [];
let tasksQueue = [];

// DOM Elements
const connectionScreen = document.getElementById('connection-screen');
const appContent = document.getElementById('app-content');
const announcementLayer = document.getElementById('announcement-layer');
const tasksLayer = document.getElementById('tasks-layer');
const announcementText = document.getElementById('announcement-text');
const tvTasks = document.getElementById('tv-tasks');
const myIdElement = document.getElementById('my-id');

// Initialize PeerJS
function initDisplay() {
    peer = new Peer(tvId);

    peer.on('open', (id) => {
        myIdElement.innerText = id;
        
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
        
        // Hide connection screen and show app content when connected
        connectionScreen.classList.add('hidden');
        appContent.classList.remove('hidden');

        conn.on('data', (data) => {
            handleIncomingData(data);
        });

        conn.on('close', () => {
            // Optional: Show disconnect warning or revert to standby
            console.log("Connection closed");
        });
    });

    peer.on('error', (err) => {
        console.error("PeerJS error:", err);
    });
}

function handleIncomingData(data) {
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
    } else if (data.type === 'tasks') {
        showTasks(data.tasks);
    }
}

function showAnnouncements(items) {
    stopTaskRotation();
    announcementQueue = items.filter((item) => item && item.html);

    tasksLayer.classList.add('hidden');
    announcementLayer.classList.remove('hidden');

    if (announcementQueue.length === 0) {
        announcementText.innerText = 'Sin anuncios para mostrar';
        announcementText.className = 'text-glow align-center';
        announcementText.style.fontSize = '4rem';
        announcementText.style.fontFamily = 'Orbitron, sans-serif';
        stopAnnouncementRotation();
        return;
    }

    let index = 0;
    renderAnnouncement(announcementQueue[index]);

    stopAnnouncementRotation();
    if (announcementQueue.length > 1) {
        announcementRotationTimer = setInterval(() => {
            index = (index + 1) % announcementQueue.length;
            renderAnnouncement(announcementQueue[index]);
        }, ROTATION_MS);
    }
}

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
    ]);
}

function showTasks(tasks) {
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
    tvTasks.classList.remove('rolling');
    tvTasks.style.removeProperty('animation-duration');
    tvTasks.style.removeProperty('--roll-distance');
}

function escapeHtml(text) {
    const temp = document.createElement('div');
    temp.innerText = text;
    return temp.innerHTML;
}

// Start app
window.onload = initDisplay;
