let peer = null;
let connection = null;

// App State
let tasks = [];

// DOM Elements
const connectBtn = document.getElementById('connect-btn');
const disconnectBtn = document.getElementById('disconnect-btn');
const targetIdInput = document.getElementById('target-id');
const statusMsg = document.getElementById('connection-status');
const connectPanel = document.getElementById('connect-panel');
const controlPanel = document.getElementById('control-panel');

// Tab System Elements
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Announcement Elements
const announceInput = document.getElementById('announcement-input');
const alignSelect = document.getElementById('align-select');
const sizeSlider = document.getElementById('size-slider');
const sendAnnounceBtn = document.getElementById('send-announcement');

// Task Elements
const newTaskInput = document.getElementById('new-task-input');
const addTaskBtn = document.getElementById('add-task-btn');
const mobileTasksContainer = document.getElementById('mobile-tasks');
const syncTasksBtn = document.getElementById('sync-tasks-btn');

// Initialize Controller App
function initController() {
    loadTasks();
    
    // Check URL parameters for auto-connect (scanned from QR)
    const urlParams = new URLSearchParams(window.location.search);
    const idFromUrl = urlParams.get('id');
    if(idFromUrl) {
        targetIdInput.value = idFromUrl;
    }

    // Connect logic
    connectBtn.addEventListener('click', () => {
        const targetId = targetIdInput.value.trim().toUpperCase();
        if (!targetId) {
            statusMsg.innerText = "Por favor ingresa un ID válido.";
            statusMsg.style.color = "#ff3333";
            return;
        }

        connectToTV(targetId);
    });

    disconnectBtn.addEventListener('click', disconnect);

    // Tab Navigation
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active classes
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.add('hidden'));
            
            // Add active to current
            btn.classList.add('active');
            document.getElementById(btn.dataset.target).classList.remove('hidden');
        });
    });

    // Content Sends
    sendAnnounceBtn.addEventListener('click', sendAnnouncement);
    syncTasksBtn.addEventListener('click', sendTasks);

    // Task Interactions
    addTaskBtn.addEventListener('click', addTask);
    newTaskInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTask();
    });

    renderMobileTasks();
}

function connectToTV(tvId) {
    statusMsg.innerText = "Conectando...";
    statusMsg.style.color = "var(--neon-blue)";
    
    // Create new peer if not exists
    if (!peer) {
        peer = new Peer();
    }

    // Disconnect existing before making new
    if (connection) {
        connection.close();
    }

    peer.on('open', (id) => {
        // Now that we have our own logic ready, connect to TV
        connection = peer.connect(tvId);

        connection.on('open', () => {
            statusMsg.innerText = "¡Conectado!";
            statusMsg.style.color = "var(--neon-green)";
            
            setTimeout(() => {
                connectPanel.classList.add('hidden');
                controlPanel.classList.remove('hidden');
                
                // On connect, optionally sync whatever tab is open
                // For now, let's sync tasks as default behavior to populate the screen
                sendTasks();
            }, 500);
        });

        connection.on('close', () => {
            handleDisconnect();
        });

        connection.on('error', (err) => {
            console.error(err);
            statusMsg.innerText = "Error de conexión. Verifica el ID.";
            statusMsg.style.color = "#ff3333";
        });
    });

    peer.on('error', (err) => {
        console.error("PeerJS error:", err);
        statusMsg.innerText = "Error: " + err.type;
        statusMsg.style.color = "#ff3333";
    });
}

function handleDisconnect() {
    connectPanel.classList.remove('hidden');
    controlPanel.classList.add('hidden');
    statusMsg.innerText = "Desconectado. Ingresa un ID.";
    statusMsg.style.color = "#aaa";
}

function disconnect() {
    if (connection) {
        connection.close();
    }
    handleDisconnect();
}

// ------ SENDING LOGIC ------

function sendData(data) {
    if (connection && connection.open) {
        connection.send(data);
    } else {
        alert("Sin conexión a la TV. Reconecta.");
    }
}

function sendAnnouncement() {
    const text = announceInput.value.trim() || ' ';
    const align = alignSelect.value;
    const size = sizeSlider.value; // Expected between 2 to 15 (rem)

    sendData({
        type: 'announcement',
        text: text,
        align: align,
        size: size
    });
}

function sendTasks() {
    sendData({
        type: 'tasks',
        tasks: tasks
    });
}

// ------ TASKS LOGIC ------

function addTask() {
    const text = newTaskInput.value.trim();
    if (!text) return;

    tasks.push({
        id: Date.now().toString(),
        text: text,
        completed: false
    });

    newTaskInput.value = '';
    saveTasks();
    renderMobileTasks();
    sendTasks(); // Auto-sync
}

function toggleTask(id) {
    const task = tasks.find(t => t.id === id);
    if (task) {
        task.completed = !task.completed;
        saveTasks();
        renderMobileTasks();
        sendTasks(); // Auto-sync
    }
}

function deleteTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    saveTasks();
    renderMobileTasks();
    sendTasks(); // Auto-sync
}

function renderMobileTasks() {
    mobileTasksContainer.innerHTML = '';
    
    if (tasks.length === 0) {
        mobileTasksContainer.innerHTML = '<p style="color: #666; text-align: center; margin-top: 20px;">No hay tareas. Agrégalas arriba.</p>';
        return;
    }

    tasks.forEach(task => {
        const item = document.createElement('div');
        item.className = 'mobile-task-item' + (task.completed ? ' completed' : '');
        
        item.innerHTML = `
            <span>${task.text}</span>
            <div class="task-actions">
                <button class="check-btn" onclick="toggleTask('${task.id}')">✓</button>
                <button class="del-btn" onclick="deleteTask('${task.id}')">✗</button>
            </div>
        `;
        
        mobileTasksContainer.appendChild(item);
    });
}

// Persistence using localStorage
function saveTasks() {
    localStorage.setItem('kioskTasks', JSON.stringify(tasks));
}

function loadTasks() {
    const saved = localStorage.getItem('kioskTasks');
    if (saved) {
        try {
            tasks = JSON.parse(saved);
        } catch (e) {
            tasks = [];
        }
    }
}

// Initialize on load
window.onload = initController;
