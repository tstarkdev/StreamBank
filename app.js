// Configuración de rutas
const CONFIG = {
    basePath: window.location.pathname.includes('/streambank') ? '/streambank/' : '/',
    playlistsPath: 'playlists/',
    radioFolder: 'radio/',
    tvFolder: 'tv/'
};

// Estado de la aplicación
const AppState = {
    currentStream: null,
    hlsPlayer: null,
    radioStations: [],
    tvChannels: [],
    volume: 0.5,
    isPlayerVisible: false
};

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    setupEventListeners();
    setupPlayer();
    await loadAllPlaylists();
}

// Configurar el reproductor HLS
function setupPlayer() {
    const videoPlayer = document.getElementById('stream-player');
    
    if (Hls.isSupported()) {
        AppState.hlsPlayer = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 90
        });
        
        AppState.hlsPlayer.attachMedia(videoPlayer);
        
        AppState.hlsPlayer.on(Hls.Events.MANIFEST_PARSED, function() {
            console.log('Manifest cargado, listo para reproducir');
        });
        
        AppState.hlsPlayer.on(Hls.Events.ERROR, function(event, data) {
            console.error('Error HLS:', data);
            if (data.fatal) {
                switch(data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                        console.error('Error de red, intentando recuperar...');
                        AppState.hlsPlayer.startLoad();
                        break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                        console.error('Error de media, recuperando...');
                        AppState.hlsPlayer.recoverMediaError();
                        break;
                    default:
                        console.error('Error fatal, no se puede recuperar');
                        AppState.hlsPlayer.destroy();
                        break;
                }
            }
        });
    } else if (videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
        // Soporte nativo para Safari
        videoPlayer.addEventListener('loadedmetadata', function() {
            console.log('Stream cargado (Safari nativo)');
        });
    }
    
    // Configurar volumen inicial
    videoPlayer.volume = AppState.volume;
    updateVolumeDisplay();
}

// Cargar todas las listas de reproducción
async function loadAllPlaylists() {
    try {
        // Cargar radio y TV en paralelo
        await Promise.all([
            loadRadioStations(),
            loadTVChannels()
        ]);
        
        // Remover estados de carga
        document.querySelectorAll('.loading').forEach(el => {
            el.style.display = 'none';
        });
        
    } catch (error) {
        console.error('Error cargando playlists:', error);
        showError('Error al cargar las listas de reproducción');
    }
}

// Cargar estaciones de radio
async function loadRadioStations() {
    try {
        // Intentar cargar el index de radio primero
        const radioIndexPath = `${CONFIG.basePath}${CONFIG.playlistsPath}${CONFIG.radioFolder}`;
        
        // Obtener lista de archivos M3U en la carpeta radio
        const files = await scanFolder(radioIndexPath);
        const m3uFiles = files.filter(file => file.endsWith('.m3u'));
        
        // Procesar cada archivo M3U
        for (const file of m3uFiles) {
            await processM3UFile(`${CONFIG.radioFolder}${file}`, 'radio');
        }
        
        // Renderizar estaciones de radio
        renderRadioStations();
        
    } catch (error) {
        console.warn('No se pudo escanear carpeta de radio, usando método alternativo');
        // Método alternativo: cargar archivos conocidos
        const defaultRadioFiles = ['match_fm.m3u', 'lacaparojafm.m3u'];
        
        for (const file of defaultRadioFiles) {
            await processM3UFile(`${CONFIG.radioFolder}${file}`, 'radio');
        }
        
        renderRadioStations();
    }
}

// Cargar canales de TV
async function loadTVChannels() {
    try {
        // Intentar cargar el index de TV primero
        const tvIndexPath = `${CONFIG.basePath}${CONFIG.playlistsPath}${CONFIG.tvFolder}`;
        
        // Obtener lista de archivos M3U en la carpeta TV
        const files = await scanFolder(tvIndexPath);
        const m3uFiles = files.filter(file => file.endsWith('.m3u'));
        
        // Procesar cada archivo M3U
        for (const file of m3uFiles) {
            await processM3UFile(`${CONFIG.tvFolder}${file}`, 'tv');
        }
        
        // Renderizar canales de TV
        renderTVChannels();
        
    } catch (error) {
        console.warn('No se pudo escanear carpeta de TV, usando método alternativo');
        // Método alternativo: cargar archivos conocidos
        const defaultTVFiles = ['canales_generales.m3u', 'deportes.m3u'];
        
        for (const file of defaultTVFiles) {
            await processM3UFile(`${CONFIG.tvFolder}${file}`, 'tv');
        }
        
        renderTVChannels();
    }
}

// Escanear carpeta para obtener archivos (usando GitHub Pages API)
async function scanFolder(folderPath) {
    try {
        // Para GitHub Pages, podemos intentar obtener el listado
        const response = await fetch(folderPath);
        
        if (response.ok) {
            const html = await response.text();
            // Parsear HTML para encontrar enlaces a archivos
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const links = doc.querySelectorAll('a');
            
            const files = [];
            links.forEach(link => {
                const href = link.getAttribute('href');
                if (href && !href.startsWith('?') && !href.includes('/') && href !== '../') {
                    files.push(href);
                }
            });
            
            return files;
        }
        
        throw new Error('No se pudo leer la carpeta');
    } catch (error) {
        // Si falla, retornar array vacío
        return [];
    }
}

// Procesar archivo M3U
async function processM3UFile(filePath, type) {
    try {
        const fullPath = `${CONFIG.basePath}${CONFIG.playlistsPath}${filePath}`;
        const response = await fetch(fullPath);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${filePath}`);
        }
        
        const content = await response.text();
        const streams = parseM3UContent(content, filePath);
        
        // Agregar a la lista correspondiente
        if (type === 'radio') {
            AppState.radioStations.push(...streams);
        } else if (type === 'tv') {
            AppState.tvChannels.push(...streams);
        }
        
        console.log(`Cargados ${streams.length} streams de ${filePath}`);
        
    } catch (error) {
        console.error(`Error procesando ${filePath}:`, error);
    }
}

// Parsear contenido M3U
function parseM3UContent(content, sourceFile) {
    const lines = content.split('\n');
    const streams = [];
    let currentStream = null;
    const fileName = sourceFile.split('/').pop().replace('.m3u', '').replace(/_/g, ' ');
    
    lines.forEach((line, index) => {
        line = line.trim();
        
        if (line.startsWith('#EXTINF:')) {
            const match = line.match(/#EXTINF:(-?\d+)(?:,(.*))?/);
            if (match) {
                currentStream = {
                    id: `stream_${sourceFile}_${index}`,
                    duration: parseInt(match[1]),
                    title: match[2] || `Stream ${index}`,
                    url: '',
                    source: fileName,
                    type: sourceFile.includes('radio') ? 'radio' : 'tv'
                };
            }
        } else if (line && !line.startsWith('#')) {
            if (currentStream) {
                currentStream.url = line;
                streams.push(currentStream);
                currentStream = null;
            } else {
                // Stream sin metadata EXTINF
                streams.push({
                    id: `stream_${sourceFile}_${index}`,
                    title: `Stream ${index}`,
                    url: line,
                    source: fileName,
                    type: sourceFile.includes('radio') ? 'radio' : 'tv'
                });
            }
        }
    });
    
    return streams;
}

// Renderizar estaciones de radio
function renderRadioStations() {
    const radioContent = document.getElementById('radio-content');
    
    if (AppState.radioStations.length === 0) {
        radioContent.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-music"></i>
                <p>No se encontraron emisoras de radio</p>
            </div>
        `;
        return;
    }
    
    let html = '<div class="streams-grid">';
    
    AppState.radioStations.forEach((station, index) => {
        const isLive = station.duration === -1 || !station.duration;
        const durationText = isLive ? 'En vivo' : formatDuration(station.duration);
        
        html += `
            <div class="stream-card radio-card" data-id="${station.id}">
                <div class="card-header">
                    <i class="fas fa-${station.type === 'radio' ? 'radio' : 'tv'}"></i>
                    <h4 class="stream-title">${station.title}</h4>
                </div>
                <div class="card-body">
                    <div class="stream-meta">
                        <span class="stream-source">${station.source}</span>
                        <span class="stream-duration">${durationText}</span>
                    </div>
                    <button class="play-btn" data-index="${index}" data-type="radio">
                        <i class="fas fa-play"></i> Escuchar
                    </button>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    radioContent.innerHTML = html;
}

// Renderizar canales de TV
function renderTVChannels() {
    const tvContent = document.getElementById('tv-content');
    
    if (AppState.tvChannels.length === 0) {
        tvContent.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-tv"></i>
                <p>No se encontraron canales de TV</p>
            </div>
        `;
        return;
    }
    
    let html = '<div class="streams-grid">';
    
    AppState.tvChannels.forEach((channel, index) => {
        const isLive = channel.duration === -1 || !channel.duration;
        const durationText = isLive ? 'En vivo' : formatDuration(channel.duration);
        
        html += `
            <div class="stream-card tv-card" data-id="${channel.id}">
                <div class="card-header">
                    <i class="fas fa-tv"></i>
                    <h4 class="stream-title">${channel.title}</h4>
                </div>
                <div class="card-body">
                    <div class="stream-meta">
                        <span class="stream-source">${channel.source}</span>
                        <span class="stream-duration">${durationText}</span>
                    </div>
                    <button class="play-btn" data-index="${index}" data-type="tv">
                        <i class="fas fa-play"></i> Ver canal
                    </button>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    tvContent.innerHTML = html;
}

// Formatear duración
function formatDuration(seconds) {
    if (!seconds || seconds < 0) return 'N/A';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
}

// Configurar event listeners
function setupEventListeners() {
    // Botones de play
    document.addEventListener('click', (e) => {
        if (e.target.closest('.play-btn')) {
            const btn = e.target.closest('.play-btn');
            const index = parseInt(btn.dataset.index);
            const type = btn.dataset.type;
            
            playStream(index, type);
        }
        
        // Botones de refrescar
        if (e.target.closest('#refresh-radio')) {
            refreshRadio();
        }
        
        if (e.target.closest('#refresh-tv')) {
            refreshTV();
        }
        
        // Botones de colapsar/expandir
        if (e.target.closest('.collapse-btn')) {
            const btn = e.target.closest('.collapse-btn');
            const panel = btn.dataset.panel;
            togglePanel(panel);
        }
    });
    
    // Controles del reproductor
    const playBtn = document.getElementById('play-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const volumeUpBtn = document.getElementById('volume-up');
    const volumeDownBtn = document.getElementById('volume-down');
    const videoPlayer = document.getElementById('stream-player');
    
    playBtn.addEventListener('click', () => {
        if (videoPlayer.paused) {
            videoPlayer.play();
            updatePlayerControls();
        }
    });
    
    pauseBtn.addEventListener('click', () => {
        if (!videoPlayer.paused) {
            videoPlayer.pause();
            updatePlayerControls();
        }
    });
    
    volumeUpBtn.addEventListener('click', () => {
        AppState.volume = Math.min(1, AppState.volume + 0.1);
        videoPlayer.volume = AppState.volume;
        updateVolumeDisplay();
    });
    
    volumeDownBtn.addEventListener('click', () => {
        AppState.volume = Math.max(0, AppState.volume - 0.1);
        videoPlayer.volume = AppState.volume;
        updateVolumeDisplay();
    });
    
    // Eventos del reproductor
    videoPlayer.addEventListener('play', updatePlayerControls);
    videoPlayer.addEventListener('pause', updatePlayerControls);
    videoPlayer.addEventListener('volumechange', () => {
        AppState.volume = videoPlayer.volume;
        updateVolumeDisplay();
    });
    
    // Eventos HLS
    videoPlayer.addEventListener('error', (e) => {
        console.error('Error del reproductor:', e);
        showError('Error al reproducir el stream');
    });
}

// Reproducir un stream
function playStream(index, type) {
    const streamList = type === 'radio' ? AppState.radioStations : AppState.tvChannels;
    
    if (index < 0 || index >= streamList.length) {
        showError('Stream no encontrado');
        return;
    }
    
    const stream = streamList[index];
    AppState.currentStream = stream;
    
    // Actualizar información del reproductor
    const playerInfo = document.getElementById('player-info');
    playerInfo.innerHTML = `
        <span class="now-playing">
            <strong>Reproduciendo:</strong> ${stream.title}
            <span class="stream-type">${type === 'radio' ? '📻' : '📺'} ${stream.source}</span>
        </span>
    `;
    
    // Mostrar reproductor
    showPlayer();
    
    // Cargar y reproducir stream
    loadStream(stream.url);
    
    // Resaltar la tarjeta seleccionada
    highlightSelectedCard(stream.id);
}

// Cargar stream en el reproductor
function loadStream(url) {
    const videoPlayer = document.getElementById('stream-player');
    const placeholder = document.getElementById('player-placeholder');
    
    // Ocultar placeholder
    placeholder.style.display = 'none';
    videoPlayer.style.display = 'block';
    
    if (Hls.isSupported() && AppState.hlsPlayer) {
        // Usar HLS.js para streams HLS
        AppState.hlsPlayer.loadSource(url);
        AppState.hlsPlayer.on(Hls.Events.MANIFEST_PARSED, function() {
            videoPlayer.play();
        });
    } else if (videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari nativo
        videoPlayer.src = url;
        videoPlayer.play();
    } else {
        // Intentar como source directo
        videoPlayer.src = url;
        videoPlayer.play();
    }
    
    // Habilitar controles
    document.getElementById('play-btn').disabled = false;
    document.getElementById('pause-btn').disabled = false;
}

// Mostrar/ocultar reproductor
function showPlayer() {
    const placeholder = document.getElementById('player-placeholder');
    const videoPlayer = document.getElementById('stream-player');
    
    if (!AppState.isPlayerVisible) {
        placeholder.style.opacity = '0.5';
        setTimeout(() => {
            placeholder.style.display = 'none';
            videoPlayer.style.display = 'block';
            AppState.isPlayerVisible = true;
        }, 300);
    }
}

// Actualizar controles del reproductor
function updatePlayerControls() {
    const videoPlayer = document.getElementById('stream-player');
    const playBtn = document.getElementById('play-btn');
    const pauseBtn = document.getElementById('pause-btn');
    
    if (videoPlayer.paused) {
        playBtn.innerHTML = '<i class="fas fa-play"></i> Reproducir';
        pauseBtn.disabled = true;
    } else {
        playBtn.innerHTML = '<i class="fas fa-play"></i> Reproduciendo';
        pauseBtn.disabled = false;
    }
}

// Actualizar display de volumen
function updateVolumeDisplay() {
    const volumeLevel = document.getElementById('volume-level');
    const percentage = Math.round(AppState.volume * 100);
    volumeLevel.textContent = `${percentage}%`;
}

// Resaltar tarjeta seleccionada
function highlightSelectedCard(streamId) {
    // Remover resaltado previo
    document.querySelectorAll('.stream-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    // Resaltar nueva selección
    const selectedCard = document.querySelector(`[data-id="${streamId}"]`);
    if (selectedCard) {
        selectedCard.classList.add('selected');
        selectedCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// Refrescar radio
async function refreshRadio() {
    const radioContent = document.getElementById('radio-content');
    radioContent.innerHTML = `
        <div class="loading">
            <i class="fas fa-spinner fa-spin"></i>
            <p>Actualizando emisoras...</p>
        </div>
    `;
    
    AppState.radioStations = [];
    await loadRadioStations();
}

// Refrescar TV
async function refreshTV() {
    const tvContent = document.getElementById('tv-content');
    tvContent.innerHTML = `
        <div class="loading">
            <i class="fas fa-spinner fa-spin"></i>
            <p>Actualizando canales...</p>
        </div>
    `;
    
    AppState.tvChannels = [];
    await loadTVChannels();
}

// Alternar panel (colapsar/expandir)
function togglePanel(panel) {
    const panelContent = document.getElementById(`${panel}-content`);
    const collapseBtn = document.querySelector(`[data-panel="${panel}"] i`);
    
    if (panelContent.style.display === 'none') {
        panelContent.style.display = 'block';
        collapseBtn.className = 'fas fa-chevron-down';
    } else {
        panelContent.style.display = 'none';
        collapseBtn.className = 'fas fa-chevron-up';
    }
}

// Mostrar error
function showError(message) {
    // Crear notificación temporal
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-notification';
    errorDiv.innerHTML = `
        <i class="fas fa-exclamation-circle"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(errorDiv);
    
    // Remover después de 3 segundos
    setTimeout(() => {
        errorDiv.remove();
    }, 3000);
}