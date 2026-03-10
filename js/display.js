// Generate a random ID for the TV so the user can connect
const tvId = 'TV-' + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
let peer = null;

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
            colorDark : "#00f3ff",
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
        showAnnouncement(data.text, data.align, data.size);
    } else if (data.type === 'tasks') {
        showTasks(data.tasks);
    }
}

function showAnnouncement(text, align, size) {
    tasksLayer.classList.add('hidden');
    announcementLayer.classList.remove('hidden');

    announcementText.innerText = text;
    
    // Apply alignment
    announcementText.className = 'text-glow'; // Reset classes
    announcementText.classList.add('align-' + align);
    
    // Apply size (using rem)
    announcementText.style.fontSize = size + 'rem';
}

function showTasks(tasks) {
    announcementLayer.classList.add('hidden');
    tasksLayer.classList.remove('hidden');

    tvTasks.innerHTML = ''; // Clear current tasks

    if (tasks.length === 0) {
        tvTasks.innerHTML = '<p style="font-size: 2rem; color: #666; font-family: Orbitron;">NO HAY TAREAS PENDIENTES</p>';
        return;
    }

    tasks.forEach(task => {
        const card = document.createElement('div');
        card.className = 'task-card' + (task.completed ? ' completed' : '');
        card.innerText = task.text;
        tvTasks.appendChild(card);
    });
}

// Start app
window.onload = initDisplay;
