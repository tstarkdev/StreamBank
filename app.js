// Configuración
const CONFIG = {
    basePath: window.location.pathname.includes('/streambank') ? '/streambank/' : '/',
    playlistsJson: 'playlists.json',
    cacheKey: 'streambank_data',
    defaultSettings: {
        autoRefresh: true,
        refreshInterval: 300000,
        maxRetries: 3,
        defaultVolume: 0.5,
        enableCache: true,
        cacheTime: 3600000
    }
};

// Estado de la aplicación
const AppState = {
    config: null,
    radioStations: [],
    tvChannels: [],
    currentStream: null,
    hlsPlayer: null,
    volume: 0.5,
    isPlayerVisible: false,
    settings: CONFIG.defaultSettings,
    retryCount: 0
};

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    try {
        console.log('🚀 Iniciando StreamBank...');
        
        // Cargar configuración
        await loadConfig();
        
        // Configurar todo
        setupPlayer();
        setupEventListeners();
        
        // Cargar streams desde JSON
        await loadStreamsFromConfig();
        
        // Aplicar configuraciones
        applySettings();
        
        console.log('✅ StreamBank inicializado correctamente');
        
    } catch (error) {
        console.error('❌ Error inicializando la app:', error);
        showError('Error al cargar la aplicación. Por favor, recarga la página.');
    }
}

// Cargar configuración desde JSON
async function loadConfig() {
    try {
        // Verificar caché primero
        const cached = getCachedData('config');
        if (cached) {
            console.log('📦 Usando datos en caché');
            AppState.config = cached;
            if (cached.settings) {
                AppState.settings = { ...CONFIG.defaultSettings, ...cached.settings };
            }
            return;
        }
        
        // Cargar desde el archivo JSON
        const response = await fetch(`${CONFIG.basePath}${CONFIG.playlistsJson}?t=${Date.now()}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        AppState.config = await response.json();
        
        // Combinar configuraciones
        if (AppState.config.settings) {
            AppState.settings = { ...CONFIG.defaultSettings, ...AppState.config.settings };
        }
        
        // Actualizar caché si está habilitado
        if (AppState.settings.enableCache) {
            cacheData('config', AppState.config);
        }
        
        console.log('📄 Configuración cargada desde JSON');
        
    } catch (error) {
        console.error('Error cargando configuración:', error);
        throw error;
    }
}

// Sistema de caché mejorado
function getCachedData(key) {
    if (!AppState.settings.enableCache) return null;
    
    try {
        const fullKey = `${CONFIG.cacheKey}_${key}`;
        const cached = localStorage.getItem(fullKey);
        if (!cached) return null;
        
        const data = JSON.parse(cached);
        const now = Date.now();
        
        // Verificar si el caché está expirado
        if (now - data.timestamp > AppState.settings.cacheTime) {
            localStorage.removeItem(fullKey);
            return null;
        }
        
        return data.value;
    } catch (error) {
        return null;
    }
}

function cacheData(key, value) {
    if (!AppState.settings.enableCache) return;
    
    try {
        const fullKey = `${CONFIG.cacheKey}_${key}`;
        const cacheData = {
            value: value,
            timestamp: Date.now()
        };
        localStorage.setItem(fullKey, JSON.stringify(cacheData));
    } catch (error) {
        console.warn('⚠️ No se pudo guardar en caché:', error);
    }
}

// Cargar streams desde la configuración
async function loadStreamsFromConfig() {
    try {
        if (!AppState.config?.categories) {
            throw new Error('Configuración no válida');
        }
        
        // Actualizar títulos de los paneles
        updatePanelTitles();
        
        // Mostrar estados de carga
        showLoadingStates();
        
        // Procesar categorías
        if (AppState.config.categories.radio) {
            await processCategory('radio');
        }
        
        if (AppState.config.categories.tv) {
            await processCategory('tv');
        }
        
        // Ocultar estados de carga
        hideLoadingStates();
        
        console.log(`📊 Cargados: ${AppState.radioStations.length} radios, ${AppState.tvChannels.length} TVs`);
        
    } catch (error) {
        console.error('Error cargando streams:', error);
        showError('Error al cargar los streams');
        hideLoadingStates();
    }
}

// Actualizar títulos de los paneles
function updatePanelTitles() {
    if (!AppState.config) return;
    
    const radioPanel = document.querySelector('.radio-panel .panel-title');
    const tvPanel = document.querySelector('.tv-panel .panel-title');
    
    if (radioPanel && AppState.config.categories.radio) {
        radioPanel.textContent = AppState.config.categories.radio.name;
    }
    
    if (tvPanel && AppState.config.categories.tv) {
        tvPanel.textContent = AppState.config.categories.tv.name;
    }
}

// Mostrar estados de carga
function showLoadingStates() {
    const loaders = document.querySelectorAll('.loading');
    loaders.forEach(loader => {
        loader.style.display = 'flex';
    });
}

// Ocultar estados de carga
function hideLoadingStates() {
    const loaders = document.querySelectorAll('.loading');
    loaders.forEach(loader => {
        loader.style.display = 'none';
    });
}

// Procesar una categoría
async function processCategory(category) {
    const categoryData = AppState.config.categories[category];
    
    // Obtener streams de la categoría
    const streams = categoryData.streams || [];
    
    // Validar y formatear streams
    const formattedStreams = streams.map(stream => ({
        ...stream,
        id: stream.id || `stream_${category}_${Date.now()}_${Math.random()}`,
        type: category,
        isLive: true,
        lastUpdated: new Date().toISOString()
    }));
    
    // Asignar a la categoría correspondiente
    if (category === 'radio') {
        AppState.radioStations = formattedStreams;
        renderStreams('radio', formattedStreams, categoryData);
    } else if (category === 'tv') {
        AppState.tvChannels = formattedStreams;
        renderStreams('tv', formattedStreams, categoryData);
    }
}

// Renderizar streams en un panel
function renderStreams(category, streams, categoryData) {
    const container = document.getElementById(`${category}-content`);
    
    if (!container) {
        console.error(`Contenedor ${category}-content no encontrado`);
        return;
    }
    
    if (streams.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-${category === 'radio' ? 'radio' : 'tv'}"></i>
                <p>No hay ${category === 'radio' ? 'emisoras' : 'canales'} disponibles</p>
                <button class="retry-btn" onclick="retryLoad('${category}')">
                    <i class="fas fa-redo"></i> Reintentar
                </button>
            </div>
        `;
        return;
    }
    
    let html = '<div class="streams-grid">';
    
    streams.forEach((stream, index) => {
        const color = categoryData.color || (category === 'radio' ? '#2ecc71' : '#e74c3c');
        const icon = categoryData.icon || (category === 'radio' ? 'fas fa-radio' : 'fas fa-tv');
        
        html += `
            <div class="stream-card ${category}-card" 
                 data-id="${stream.id}"
                 style="border-left-color: ${color}">
                <div class="card-header">
                    <div class="stream-logo">
                        ${stream.logo ? 
                            `<img src="${stream.logo}" alt="${stream.name}" onerror="this.src='https://via.placeholder.com/40/3498db/ffffff?text=${stream.name.charAt(0)}'">` :
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
                    
                    <div class="stream-actions">
                        <button class="play-btn" data-index="${index}" data-type="${category}">
                            <i class="fas fa-play"></i> ${category === 'radio' ? 'Escuchar' : 'Ver'}
                        </button>
                        ${stream.backupUrls && stream.backupUrls.length > 0 ? 
                            `<button class="backup-btn" title="Usar fuente alternativa" onclick="useBackupSource('${stream.id}')">
                                <i class="fas fa-exchange-alt"></i>
                            </button>` : ''
                        }
                    </div>
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
        'MX': '🇲🇽',
        'US': '🇺🇸',
        'ES': '🇪🇸',
        'AR': '🇦🇷',
        'CO': '🇨🇴',
        'PE': '🇵🇪',
        'CL': '🇨🇱'
    };
    return flags[countryCode] || '🌐';
}

// Configurar reproductor HLS
function setupPlayer() {
    const videoPlayer = document.getElementById('stream-player');
    
    if (!videoPlayer) {
        console.error('Reproductor de video no encontrado');
        return;
    }
    
    // Configurar volumen inicial
    videoPlayer.volume = AppState.volume = AppState.settings.defaultVolume;
    updateVolumeDisplay();
    
    if (Hls.isSupported()) {
        AppState.hlsPlayer = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 90,
            maxBufferLength: 30,
            maxMaxBufferLength: 60,
            maxBufferSize: 60 * 1000 * 1000
        });
        
        AppState.hlsPlayer.attachMedia(videoPlayer);
        
        AppState.hlsPlayer.on(Hls.Events.MANIFEST_PARSED, () => {
            console.log('✅ Stream listo para reproducir');
            AppState.retryCount = 0;
        });
        
        AppState.hlsPlayer.on(Hls.Events.ERROR, (event, data) => {
            console.error('❌ Error HLS:', data);
            if (data.fatal) {
                handleStreamError(data.type);
            }
        });
        
    } else if (videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
        console.log('🍎 Usando soporte nativo HLS (Safari)');
    } else {
        console.warn('⚠️ HLS no soportado en este navegador');
    }
}

// Manejar errores de stream
function handleStreamError(errorType) {
    if (AppState.retryCount >= AppState.settings.maxRetries) {
        showError('No se pudo conectar al stream después de varios intentos');
        return;
    }
    
    AppState.retryCount++;
    
    switch(errorType) {
        case Hls.ErrorTypes.NETWORK_ERROR:
            console.log(`🔄 Reintentando conexión (${AppState.retryCount}/${AppState.settings.maxRetries})`);
            setTimeout(() => {
                if (AppState.hlsPlayer) {
                    AppState.hlsPlayer.startLoad();
                }
            }, 1000 * AppState.retryCount);
            break;
            
        case Hls.ErrorTypes.MEDIA_ERROR:
            console.log('🔄 Recuperando error de media');
            if (AppState.hlsPlayer) {
                AppState.hlsPlayer.recoverMediaError();
            }
            break;
            
        default:
            console.error('❌ Error fatal, no se puede recuperar');
            showError('Error en el stream. Intenta con otro canal.');
            if (AppState.hlsPlayer) {
                AppState.hlsPlayer.destroy();
            }
            break;
    }
}

// Configurar event listeners
function setupEventListeners() {
    // Delegación de eventos para los botones de play
    document.addEventListener('click', (e) => {
        const playBtn = e.target.closest('.play-btn');
        if (playBtn) {
            const index = parseInt(playBtn.dataset.index);
            const type = playBtn.dataset.type;
            playStream(index, type);
            return;
        }
        
        // Botones de refrescar
        if (e.target.closest('#refresh-radio')) {
            refreshCategory('radio');
            return;
        }
        
        if (e.target.closest('#refresh-tv')) {
            refreshCategory('tv');
            return;
        }
        
        // Botones de colapsar
        const collapseBtn = e.target.closest('.collapse-btn');
        if (collapseBtn) {
            const panel = collapseBtn.dataset.panel;
            togglePanel(panel);
            return;
        }
    });
    
    // Controles del reproductor
    const playBtn = document.getElementById('play-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const volumeUpBtn = document.getElementById('volume-up');
    const volumeDownBtn = document.getElementById('volume-down');
    const videoPlayer = document.getElementById('stream-player');
    
    if (playBtn) playBtn.addEventListener('click', handlePlay);
    if (pauseBtn) pauseBtn.addEventListener('click', handlePause);
    if (volumeUpBtn) volumeUpBtn.addEventListener('click', volumeUp);
    if (volumeDownBtn) volumeDownBtn.addEventListener('click', volumeDown);
    
    if (videoPlayer) {
        videoPlayer.addEventListener('play', updatePlayerControls);
        videoPlayer.addEventListener('pause', updatePlayerControls);
        videoPlayer.addEventListener('volumechange', updateVolumeFromPlayer);
        videoPlayer.addEventListener('error', handlePlayerError);
    }
    
    // Refresco automático si está habilitado
    if (AppState.settings.autoRefresh) {
        setInterval(() => {
            refreshAll();
        }, AppState.settings.refreshInterval);
    }
}

// Controladores de eventos del reproductor
function handlePlay() {
    const videoPlayer = document.getElementById('stream-player');
    if (videoPlayer && videoPlayer.paused && AppState.currentStream) {
        videoPlayer.play().catch(e => {
            console.error('Error al reproducir:', e);
            showError('Error al reproducir el stream');
        });
    }
}

function handlePause() {
    const videoPlayer = document.getElementById('stream-player');
    if (videoPlayer && !videoPlayer.paused) {
        videoPlayer.pause();
    }
}

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

function updateVolumeFromPlayer() {
    const videoPlayer = document.getElementById('stream-player');
    if (videoPlayer) {
        AppState.volume = videoPlayer.volume;
        updateVolumeDisplay();
    }
}

function handlePlayerError(e) {
    console.error('Error del reproductor:', e);
    
    // Si hay backup URLs, intentar con la primera
    if (AppState.currentStream?.backupUrls?.length > 0) {
        showError('Error en la fuente principal. Intentando con alternativa...');
        setTimeout(() => {
            useBackupSource(AppState.currentStream.id, 0);
        }, 1000);
    } else {
        showError('Error al reproducir el stream');
    }
}

// Reproducir un stream
function playStream(index, type) {
    const streams = type === 'radio' ? AppState.radioStations : AppState.tvChannels;
    
    if (index < 0 || index >= streams.length) {
        showError('Stream no disponible');
        return;
    }
    
    const stream = streams[index];
    AppState.currentStream = stream;
    AppState.retryCount = 0;
    
    // Actualizar UI
    updatePlayerInfo(stream);
    showPlayer();
    loadStream(stream.url);
    highlightSelectedCard(stream.id);
    
    // Guardar historial
    saveToHistory(stream);
}

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
                    ${stream.country ? `<span>• ${getCountryFlag(stream.country)}</span>` : ''}
                </div>
            </div>
        `;
    }
}

// Mostrar reproductor
function showPlayer() {
    const placeholder = document.getElementById('player-placeholder');
    const videoPlayer = document.getElementById('stream-player');
    
    if (placeholder && videoPlayer && !AppState.isPlayerVisible) {
        placeholder.style.opacity = '0.5';
        setTimeout(() => {
            placeholder.style.display = 'none';
            videoPlayer.style.display = 'block';
            AppState.isPlayerVisible = true;
        }, 300);
    }
}

// Cargar stream en el reproductor
function loadStream(url) {
    const videoPlayer = document.getElementById('stream-player');
    
    if (!videoPlayer) return;
    
    console.log(`▶️ Cargando stream: ${url}`);
    
    // Detener reproducción actual
    videoPlayer.pause();
    videoPlayer.src = '';
    
    if (Hls.isSupported() && AppState.hlsPlayer) {
        AppState.hlsPlayer.loadSource(url);
        AppState.hlsPlayer.once(Hls.Events.MANIFEST_PARSED, () => {
            videoPlayer.play().catch(e => {
                console.error('Error autoplay:', e);
            });
        });
    } else if (videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
        videoPlayer.src = url;
        videoPlayer.play().catch(e => {
            console.error('Error autoplay Safari:', e);
        });
    } else {
        videoPlayer.src = url;
        videoPlayer.play().catch(e => {
            console.error('Error autoplay:', e);
        });
    }
    
    // Habilitar controles
    ['play-btn', 'pause-btn'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.disabled = false;
    });
}

// Usar fuente de respaldo
window.useBackupSource = function(streamId, backupIndex = 0) {
    const stream = [...AppState.radioStations, ...AppState.tvChannels].find(s => s.id === streamId);
    
    if (!stream || !stream.backupUrls || backupIndex >= stream.backupUrls.length) {
        showError('No hay fuentes alternativas disponibles');
        return;
    }
    
    const backupUrl = stream.backupUrls[backupIndex];
    console.log(`🔄 Usando fuente alternativa ${backupIndex + 1}`);
    
    showError(`Probando fuente alternativa ${backupIndex + 1}...`);
    
    // Actualizar URL temporalmente
    const originalUrl = stream.url;
    stream.url = backupUrl;
    
    loadStream(backupUrl);
    
    // Verificar si funciona después de 5 segundos
    setTimeout(() => {
        const videoPlayer = document.getElementById('stream-player');
        if (videoPlayer.error || videoPlayer.paused) {
            // Intentar con la siguiente fuente alternativa
            if (backupIndex + 1 < stream.backupUrls.length) {
                useBackupSource(streamId, backupIndex + 1);
            } else {
                // Volver a la original si ninguna funciona
                stream.url = originalUrl;
                showError('Ninguna fuente alternativa funciona');
            }
        }
    }, 5000);
};

// Actualizar controles del reproductor
function updatePlayerControls() {
    const videoPlayer = document.getElementById('stream-player');
    const playBtn = document.getElementById('play-btn');
    
    if (videoPlayer && playBtn) {
        if (videoPlayer.paused) {
            playBtn.innerHTML = '<i class="fas fa-play"></i> Reproducir';
        } else {
            playBtn.innerHTML = '<i class="fas fa-play"></i> Reproduciendo';
        }
    }
}

// Actualizar display de volumen
function updateVolumeDisplay() {
    const volumeLevel = document.getElementById('volume-level');
    if (volumeLevel) {
        const percentage = Math.round(AppState.volume * 100);
        volumeLevel.textContent = `${percentage}%`;
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

// Guardar en historial
function saveToHistory(stream) {
    try {
        const history = JSON.parse(localStorage.getItem('streambank_history') || '[]');
        
        // Evitar duplicados
        const existingIndex = history.findIndex(item => item.id === stream.id);
        if (existingIndex !== -1) {
            history.splice(existingIndex, 1);
        }
        
        // Agregar al inicio
        history.unshift({
            id: stream.id,
            name: stream.name,
            type: stream.type,
            timestamp: new Date().toISOString(),
            url: stream.url
        });
        
        // Mantener solo los últimos 50
        if (history.length > 50) {
            history.pop();
        }
        
        localStorage.setItem('streambank_history', JSON.stringify(history));
    } catch (error) {
        console.warn('No se pudo guardar en historial:', error);
    }
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
    }
    
    setTimeout(() => {
        processCategory(category);
    }, 500);
}

// Refrescar todo
function refreshAll() {
    console.log('🔄 Refrescando streams...');
    loadStreamsFromConfig();
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

// Aplicar configuraciones
function applySettings() {
    // Aplicar volumen
    const videoPlayer = document.getElementById('stream-player');
    if (videoPlayer) {
        videoPlayer.volume = AppState.volume;
    }
}

// Mostrar error
function showError(message) {
    // Remover notificaciones anteriores
    document.querySelectorAll('.error-notification').forEach(el => el.remove());
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-notification';
    errorDiv.innerHTML = `
        <i class="fas fa-exclamation-triangle"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
        errorDiv.style.opacity = '0';
        setTimeout(() => errorDiv.remove(), 300);
    }, 3000);
}

// Función global para reintentar
window.retryLoad = function(category) {
    refreshCategory(category);
};

// Función global para forzar recarga
window.refreshStreamBank = function() {
    localStorage.removeItem(`${CONFIG.cacheKey}_config`);
    location.reload();
};

// Función global para debug
window.debugStreamBank = function() {
    console.log('=== StreamBank Debug ===');
    console.log('Config:', AppState.config);
    console.log('Radio Stations:', AppState.radioStations);
    console.log('TV Channels:', AppState.tvChannels);
    console.log('Current Stream:', AppState.currentStream);
    console.log('Settings:', AppState.settings);
    console.log('=======================');
};

// Función global para obtener estadísticas
window.getStats = function() {
    return {
        totalRadio: AppState.radioStations.length,
        totalTV: AppState.tvChannels.length,
        currentStream: AppState.currentStream?.name,
        volume: Math.round(AppState.volume * 100),
        cacheEnabled: AppState.settings.enableCache,
        version: AppState.config?.version || '1.0'
    };
};