// Configuración
const CONFIG = {
    basePath: window.location.pathname.includes('/streambank') ? '/streambank/' : '/',
    playlistsJson: 'playlists.json',
    cacheKey: 'streambank_data_v2'
};

// Estado de la aplicación
const AppState = {
    config: null,
    radioStations: [],
    tvChannels: [],
    currentStream: null,
    hlsPlayer: null,
    volume: 0.5,
    isPlayerVisible: false
};

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    try {
        console.log('🎧 Iniciando StreamBank...');
        
        // Cargar configuración desde JSON
        await loadConfig();
        
        // Configurar todo
        setupPlayer();
        setupEventListeners();
        
        // Renderizar streams desde JSON
        renderStreamsFromConfig();
        
        console.log('✅ StreamBank listo!');
        
    } catch (error) {
        console.error('❌ Error inicializando:', error);
        showError('Error al cargar. Recarga la página.');
        
        // Mostrar datos de ejemplo si hay error
        showFallbackData();
    }
}

// Cargar configuración desde JSON
async function loadConfig() {
    try {
        // Intentar cargar el JSON
        const response = await fetch(`${CONFIG.basePath}${CONFIG.playlistsJson}?v=${Date.now()}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        AppState.config = await response.json();
        console.log('📄 Configuración cargada:', AppState.config);
        
    } catch (error) {
        console.error('Error cargando JSON:', error);
        throw error;
    }
}

// Renderizar streams desde la configuración JSON
function renderStreamsFromConfig() {
    try {
        if (!AppState.config?.categories) {
            throw new Error('JSON sin estructura categories');
        }
        
        // Procesar radio
        if (AppState.config.categories.radio && AppState.config.categories.radio.streams) {
            AppState.radioStations = AppState.config.categories.radio.streams;
            renderCategory('radio', AppState.radioStations, AppState.config.categories.radio);
        }
        
        // Procesar TV
        if (AppState.config.categories.tv && AppState.config.categories.tv.streams) {
            AppState.tvChannels = AppState.config.categories.tv.streams;
            renderCategory('tv', AppState.tvChannels, AppState.config.categories.tv);
        }
        
        // Ocultar loaders
        hideLoadingStates();
        
        console.log(`📊 Radio: ${AppState.radioStations.length}, TV: ${AppState.tvChannels.length}`);
        
    } catch (error) {
        console.error('Error renderizando streams:', error);
        showError('Error mostrando streams');
        hideLoadingStates();
    }
}

// Renderizar una categoría
function renderCategory(category, streams, categoryData) {
    const container = document.getElementById(`${category}-content`);
    
    if (!container) {
        console.error(`Contenedor no encontrado: ${category}-content`);
        return;
    }
    
    if (!streams || streams.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-${category === 'radio' ? 'radio' : 'tv'}"></i>
                <p>No hay ${category === 'radio' ? 'emisoras' : 'canales'}</p>
            </div>
        `;
        return;
    }
    
    const color = categoryData.color || (category === 'radio' ? '#2ecc71' : '#e74c3c');
    const icon = categoryData.icon || (category === 'radio' ? 'fas fa-radio' : 'fas fa-tv');
    const categoryName = categoryData.name || (category === 'radio' ? 'Radio' : 'TV');
    
    let html = `
        <div class="category-header">
            <h4><i class="${icon}"></i> ${categoryName}</h4>
            <span class="stream-count">${streams.length} ${category === 'radio' ? 'emisoras' : 'canales'}</span>
        </div>
        <div class="streams-grid">
    `;
    
    streams.forEach((stream, index) => {
        // Asegurar que el stream tenga un ID único
        const streamId = stream.id || `stream_${category}_${index}_${Date.now()}`;
        
        html += `
            <div class="stream-card ${category}-card" 
                 data-id="${streamId}"
                 data-index="${index}"
                 data-type="${category}"
                 style="border-left-color: ${color}">
                
                <div class="card-header">
                    <div class="stream-logo">
                        ${stream.logo ? 
                            `<img src="${stream.logo}" alt="${stream.name}" 
                                  onerror="this.onerror=null; this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIGZpbGw9IiMzNDk4REIiIHJ4PSI4Ii8+PHRleHQgeD0iMjAiIHk9IjIwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTYiIGZpbGw9IiNGRkYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj4${btoa(stream.name.charAt(0)).slice(0,10)}</dGV4dD48L3N2Zz4=';">` :
                            `<i class="${icon}"></i>`
                        }
                    </div>
                    <div class="stream-info">
                        <h4 class="stream-title" title="${stream.name}">${stream.name}</h4>
                        ${stream.genre ? `<span class="stream-genre">${stream.genre}</span>` : ''}
                    </div>
                </div>
                
                <div class="card-body">
                    ${stream.description ? `<p class="stream-description">${stream.description}</p>` : ''}
                    
                    <div class="stream-meta">
                        ${stream.quality ? `<span class="stream-quality">${stream.quality}</span>` : ''}
                        ${stream.country ? `<span class="stream-country">${getCountryFlag(stream.country)} ${stream.country}</span>` : ''}
                        ${stream.group ? `<span class="stream-group">${stream.group}</span>` : ''}
                    </div>
                    
                    <button class="play-btn" onclick="playStream(${index}, '${category}')">
                        <i class="fas fa-play"></i> ${category === 'radio' ? 'Escuchar' : 'Ver'}
                    </button>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

// Obtener bandera de país
function getCountryFlag(countryCode) {
    const flags = {
        'MX': '🇲🇽', 'US': '🇺🇸', 'ES': '🇪🇸', 'AR': '🇦🇷',
        'CO': '🇨🇴', 'PE': '🇵🇪', 'CL': '🇨🇱', 'BR': '🇧🇷'
    };
    return flags[countryCode] || '🌐';
}

// Configurar reproductor HLS
function setupPlayer() {
    const videoPlayer = document.getElementById('stream-player');
    
    if (!videoPlayer) {
        console.error('Reproductor no encontrado');
        return;
    }
    
    // Configurar volumen inicial
    videoPlayer.volume = AppState.volume;
    updateVolumeDisplay();
    
    if (Hls.isSupported()) {
        AppState.hlsPlayer = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 90
        });
        
        AppState.hlsPlayer.attachMedia(videoPlayer);
        
        AppState.hlsPlayer.on(Hls.Events.MANIFEST_PARSED, () => {
            console.log('✅ Stream listo');
        });
        
        AppState.hlsPlayer.on(Hls.Events.ERROR, (event, data) => {
            console.error('❌ Error HLS:', data);
            if (data.fatal) {
                handleStreamError();
            }
        });
        
    } else if (videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
        console.log('🍎 Safari nativo HLS');
    }
}

// Manejar error de stream
function handleStreamError() {
    showError('Error en el stream. Intenta otro canal.');
    
    // Si hay backup URLs en el stream actual, intentar la primera
    if (AppState.currentStream?.backupUrls?.length > 0) {
        setTimeout(() => {
            useBackupSource(0);
        }, 2000);
    }
}

// Configurar event listeners
function setupEventListeners() {
    // Botones de refresh
    document.getElementById('refresh-radio')?.addEventListener('click', () => refreshCategory('radio'));
    document.getElementById('refresh-tv')?.addEventListener('click', () => refreshCategory('tv'));
    
    // Botones de colapsar
    document.querySelectorAll('.collapse-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const panel = this.dataset.panel;
            togglePanel(panel);
        });
    });
    
    // Controles del reproductor
    const playBtn = document.getElementById('play-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const volumeUpBtn = document.getElementById('volume-up');
    const volumeDownBtn = document.getElementById('volume-down');
    const videoPlayer = document.getElementById('stream-player');
    
    if (playBtn) playBtn.addEventListener('click', () => videoPlayer?.play());
    if (pauseBtn) pauseBtn.addEventListener('click', () => videoPlayer?.pause());
    if (volumeUpBtn) volumeUpBtn.addEventListener('click', volumeUp);
    if (volumeDownBtn) volumeDownBtn.addEventListener('click', volumeDown);
    
    if (videoPlayer) {
        videoPlayer.addEventListener('play', updatePlayerControls);
        videoPlayer.addEventListener('pause', updatePlayerControls);
        videoPlayer.addEventListener('volumechange', updateVolumeDisplay);
    }
}

// Control de volumen
function volumeUp() {
    AppState.volume = Math.min(1, AppState.volume + 0.1);
    updateVolume();
}

function volumeDown() {
    AppState.volume = Math.max(0, AppState.volume - 0.1);
    updateVolume();
}

function updateVolume() {
    const videoPlayer = document.getElementById('stream-player');
    if (videoPlayer) {
        videoPlayer.volume = AppState.volume;
        updateVolumeDisplay();
    }
}

function updateVolumeDisplay() {
    const videoPlayer = document.getElementById('stream-player');
    const volumeLevel = document.getElementById('volume-level');
    
    if (volumeLevel && videoPlayer) {
        AppState.volume = videoPlayer.volume;
        const percentage = Math.round(AppState.volume * 100);
        volumeLevel.textContent = `${percentage}%`;
    }
}

// Reproducir stream (función global)
window.playStream = function(index, type) {
    const streams = type === 'radio' ? AppState.radioStations : AppState.tvChannels;
    
    if (index < 0 || index >= streams.length) {
        showError('Stream no disponible');
        return;
    }
    
    const stream = streams[index];
    AppState.currentStream = stream;
    
    // Actualizar UI
    updatePlayerInfo(stream);
    showPlayer();
    loadStream(stream.url);
    highlightSelectedCard(stream.id || `stream_${type}_${index}`);
    
    console.log(`▶️ Reproduciendo: ${stream.name}`);
};

// Actualizar información del reproductor
function updatePlayerInfo(stream) {
    const playerInfo = document.getElementById('player-info');
    if (playerInfo) {
        playerInfo.innerHTML = `
            <div class="now-playing-info">
                <strong>${stream.type === 'radio' ? '🎵' : '📺'} ${stream.name}</strong>
                <div class="stream-details">
                    ${stream.genre ? `<span>${stream.genre}</span>` : ''}
                    ${stream.quality ? `<span>• ${stream.quality}</span>` : ''}
                </div>
            </div>
        `;
    }
}

// Mostrar reproductor
function showPlayer() {
    const placeholder = document.getElementById('player-placeholder');
    const videoPlayer = document.getElementById('stream-player');
    
    if (placeholder && videoPlayer) {
        placeholder.style.display = 'none';
        videoPlayer.style.display = 'block';
        AppState.isPlayerVisible = true;
    }
}

// Cargar stream
function loadStream(url) {
    const videoPlayer = document.getElementById('stream-player');
    
    if (!videoPlayer) return;
    
    console.log(`📡 Cargando: ${url}`);
    
    // Limpiar fuente anterior
    videoPlayer.src = '';
    
    if (Hls.isSupported() && AppState.hlsPlayer) {
        AppState.hlsPlayer.loadSource(url);
        AppState.hlsPlayer.once(Hls.Events.MANIFEST_PARSED, () => {
            videoPlayer.play().catch(e => {
                console.error('Autoplay bloqueado:', e);
                showError('Haz clic en Reproducir para comenzar');
            });
        });
    } else if (videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
        videoPlayer.src = url;
        videoPlayer.play().catch(e => {
            console.error('Autoplay Safari bloqueado:', e);
        });
    } else {
        videoPlayer.src = url;
        videoPlayer.play().catch(e => {
            console.error('Autoplay bloqueado:', e);
        });
    }
    
    // Habilitar controles
    ['play-btn', 'pause-btn'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.disabled = false;
    });
}

// Usar fuente de respaldo
window.useBackupSource = function(backupIndex = 0) {
    if (!AppState.currentStream?.backupUrls || backupIndex >= AppState.currentStream.backupUrls.length) {
        showError('No hay fuentes alternativas');
        return;
    }
    
    const backupUrl = AppState.currentStream.backupUrls[backupIndex];
    console.log(`🔄 Probando fuente alternativa ${backupIndex + 1}`);
    
    loadStream(backupUrl);
};

// Actualizar controles del reproductor
function updatePlayerControls() {
    const videoPlayer = document.getElementById('stream-player');
    const playBtn = document.getElementById('play-btn');
    
    if (videoPlayer && playBtn) {
        playBtn.innerHTML = videoPlayer.paused ? 
            '<i class="fas fa-play"></i> Reproducir' : 
            '<i class="fas fa-play"></i> Reproduciendo';
    }
}

// Resaltar tarjeta seleccionada
function highlightSelectedCard(streamId) {
    document.querySelectorAll('.stream-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    const selectedCard = document.querySelector(`[data-id="${streamId}"]`);
    if (selectedCard) {
        selectedCard.classList.add('selected');
        selectedCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// Ocultar estados de carga
function hideLoadingStates() {
    document.querySelectorAll('.loading').forEach(el => {
        el.style.display = 'none';
    });
}

// Refrescar categoría
function refreshCategory(category) {
    const container = document.getElementById(`${category}-content`);
    if (container) {
        container.innerHTML = `
            <div class="loading">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Actualizando...</p>
            </div>
        `;
        
        setTimeout(() => {
            renderStreamsFromConfig();
        }, 500);
    }
}

// Alternar panel
function togglePanel(panel) {
    const content = document.getElementById(`${panel}-content`);
    const icon = document.querySelector(`[data-panel="${panel}"] i`);
    
    if (content && icon) {
        if (content.style.display === 'none') {
            content.style.display = 'block';
            icon.className = 'fas fa-chevron-down';
        } else {
            content.style.display = 'none';
            icon.className = 'fas fa-chevron-up';
        }
    }
}

// Mostrar datos de ejemplo si hay error
function showFallbackData() {
    console.log('⚠️ Mostrando datos de ejemplo');
    
    const fallbackConfig = {
        categories: {
            radio: {
                name: "Emisoras de Radio",
                icon: "fas fa-radio",
                color: "#2ecc71",
                streams: [
                    {
                        id: "radio_001",
                        name: "Match FM 99.3",
                        description: "Música pop en vivo desde CDMX",
                        url: "https://playerservices.streamtheworld.com/api/livestream-redirect/XHPOPFMAAC.m3u8",
                        genre: "Pop",
                        quality: "128kbps",
                        country: "MX"
                    }
                ]
            },
            tv: {
                name: "Canales de TV",
                icon: "fas fa-tv",
                color: "#e74c3c",
                streams: [
                    {
                        id: "tv_001",
                        name: "Canal 5",
                        description: "Entretenimiento familiar",
                        url: "http://104.238.205.28:8989/278329_.m3u8",
                        genre: "Entretenimiento",
                        quality: "720p",
                        country: "MX",
                        group: "TV Abierta"
                    }
                ]
            }
        }
    };
    
    AppState.config = fallbackConfig;
    renderStreamsFromConfig();
}

// Mostrar error
function showError(message) {
    // Crear notificación
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-notification';
    errorDiv.innerHTML = `
        <i class="fas fa-exclamation-circle"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(errorDiv);
    
    // Remover después de 3 segundos
    setTimeout(() => {
        errorDiv.style.opacity = '0';
        setTimeout(() => errorDiv.remove(), 300);
    }, 3000);
}

// Función global para debug
window.debugStreamBank = function() {
    console.log('=== DEBUG StreamBank ===');
    console.log('Config:', AppState.config);
    console.log('Radio:', AppState.radioStations);
    console.log('TV:', AppState.tvChannels);
    console.log('Current:', AppState.currentStream);
    console.log('========================');
};

// Función global para refrescar
window.refreshAll = function() {
    location.reload();
};