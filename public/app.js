// app.js - StreamBank con soporte para file:// y HTTP

// ===== CONFIGURACIÓN =====
const IS_LOCAL_FILE = window.location.protocol === 'file:';
const IS_GITHUB_PAGES = window.location.origin.includes('github.io');

console.log(`🌐 Modo: ${IS_LOCAL_FILE ? 'LOCAL (file://)' : IS_GITHUB_PAGES ? 'GITHUB PAGES' : 'HTTP SERVER'}`);

// Configuración de playlists MANUAL para desarrollo
// Define aquí tus archivos M3U reales
const MANUAL_PLAYLIST_CONFIG = {
    radio: [
        { 
            name: "Match FM", 
            path: "playlists/radio/MatchFM.m3u",
            // Contenido hardcodeado para desarrollo
            fallbackContent: `#EXTM3U
#EXTINF:-1 tvg-id="MatchFM.MX" tvg-logo="https://i.iheart.com/v3/re/new_assets/6294edb231e1c81edc5d1df" tvg-name="Match 99.3 FM" group-title="Radio",Match 99.3 FM CDMX
https://16603.live.streamtheworld.com/XHPOPFMAAC/HLS/playlist.m3u8`
        },
        { 
            name: "La Capa Roja", 
            path: "playlists/radio/LaCapaRoja.m3u",
            fallbackContent: `#EXTM3U
#EXTINF:-1 tvg-logo="https://example.com/logo.png" tvg-name="La Capa Roja" group-title="Radio",La Capa Roja FM
https://example.com/stream.m3u8`
        }
    ],
    tv: [
        { 
            name: "TV Abierta", 
            path: "playlists/tv/TVabierta.m3u",
            fallbackContent: `#EXTM3U
#EXTINF:-1 tvg-logo="https://example.com/tv1.png" tvg-name="Canal 1" group-title="TV",Canal de Televisión 1
https://example.com/tv1.m3u8`
        },
        { 
            name: "Deportes", 
            path: "playlists/tv/Deportes.m3u",
            fallbackContent: `#EXTM3U
#EXTINF:-1 tvg-logo="https://example.com/sports.png" tvg-name="Deportes" group-title="TV",Canal Deportivo
https://example.com/sports.m3u8`
        }
    ]
};

// ===== CLASE SIMPLIFICADA =====
class StreamBankLocal {
    constructor() {
        this.player = new StreamPlayer();
        this.initUI();
        this.loadManualPlaylists();
    }
    
    initUI() {
        // Botones de colapso
        document.querySelectorAll('.collapse-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const panel = e.target.closest('.panel');
                panel.classList.toggle('collapsed');
                const icon = btn.querySelector('i');
                icon.className = panel.classList.contains('collapsed') 
                    ? 'fas fa-chevron-up' 
                    : 'fas fa-chevron-down';
            });
        });
        
        // Botones de actualización
        document.getElementById('refresh-radio')?.addEventListener('click', () => {
            this.refreshPanel('radio');
        });
        
        document.getElementById('refresh-tv')?.addEventListener('click', () => {
            this.refreshPanel('tv');
        });
    }
    
    async loadManualPlaylists() {
        console.log('📁 Cargando playlists manuales...');
        
        // Mostrar loading
        this.showLoading('radio', 'Cargando emisoras...');
        this.showLoading('tv', 'Cargando canales de TV...');
        
        // Cargar playlists manualmente
        await this.loadPlaylistType('radio');
        await this.loadPlaylistType('tv');
    }
    
    async loadPlaylistType(type) {
        const panelContent = document.getElementById(`${type}-content`);
        const playlists = MANUAL_PLAYLIST_CONFIG[type];
        let allChannels = [];
        
        for (const playlist of playlists) {
            try {
                const channels = await this.loadPlaylistContent(playlist);
                allChannels = [...allChannels, ...channels];
            } catch (error) {
                console.warn(`Error con ${playlist.name}:`, error);
            }
        }
        
        if (allChannels.length > 0) {
            this.renderChannels(type, allChannels);
        } else {
            panelContent.innerHTML = `
                <div class="no-channels">
                    <i class="fas fa-music"></i>
                    <p>No hay canales disponibles</p>
                    ${IS_LOCAL_FILE ? '<small>Usando datos de ejemplo para desarrollo</small>' : ''}
                </div>
            `;
        }
    }
    
    async loadPlaylistContent(playlist) {
        // Intentar cargar del servidor
        if (!IS_LOCAL_FILE) {
            try {
                const response = await fetch(playlist.path);
                const text = await response.text();
                return this.parseM3U(text, playlist.name);
            } catch (error) {
                console.warn(`No se pudo cargar ${playlist.path}, usando fallback`);
            }
        }
        
        // Usar contenido de fallback (siempre disponible)
        return this.parseM3U(playlist.fallbackContent, playlist.name);
    }
    
    parseM3U(content, playlistName) {
        const channels = [];
        const lines = content.split('\n');
        let currentChannel = null;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (line.startsWith('#EXTINF:')) {
                currentChannel = this.parseExtInf(line, playlistName);
            } 
            else if (line && !line.startsWith('#') && currentChannel && line.includes('://')) {
                currentChannel.url = line;
                if (currentChannel.name && currentChannel.url) {
                    channels.push(currentChannel);
                }
                currentChannel = null;
            }
        }
        
        return channels;
    }
    
    parseExtInf(line, playlistName) {
        const channel = {
            name: '',
            logo: '',
            group: playlistName,
            url: ''
        };
        
        // Logo
        const logoMatch = line.match(/tvg-logo="([^"]*)"/i);
        if (logoMatch) channel.logo = logoMatch[1];
        
        // Nombre
        const nameMatch = line.match(/tvg-name="([^"]*)"/i);
        if (nameMatch) {
            channel.name = nameMatch[1];
        } else {
            const lastComma = line.lastIndexOf(',');
            if (lastComma !== -1) {
                channel.name = line.substring(lastComma + 1).trim();
            }
        }
        
        if (!channel.name) channel.name = `Canal ${playlistName}`;
        return channel;
    }
    
    renderChannels(type, channels) {
        const panelContent = document.getElementById(`${type}-content`);
        
        let html = `
            <div class="channels-header">
                <span class="channels-count">${channels.length} canales</span>
                <span class="channels-type">${type === 'radio' ? '🎵 Radio' : '📺 TV'}</span>
            </div>
            <div class="channel-list">
        `;
        
        channels.forEach(channel => {
            const initials = channel.name.substring(0, 2).toUpperCase();
            
            html += `
                <div class="channel-item" 
                     data-url="${channel.url}"
                     data-name="${channel.name}"
                     data-logo="${channel.logo}"
                     data-group="${channel.group}">
                    
                    <div class="channel-logo">
                        ${channel.logo ? 
                            `<img src="${channel.logo}" alt="${channel.name}" class="channel-logo-img" onerror="this.parentElement.innerHTML='<div class=\"channel-logo-fallback\">${initials}</div>'">` :
                            `<div class="channel-logo-fallback">${initials}</div>`
                        }
                    </div>
                    
                    <div class="channel-info">
                        <div class="channel-name">${channel.name}</div>
                        <div class="channel-group">${channel.group}</div>
                    </div>
                    
                    <div class="play-icon">
                        <i class="fas fa-play-circle"></i>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        panelContent.innerHTML = html;
        
        // Event listeners
        panelContent.querySelectorAll('.channel-item').forEach(item => {
            item.addEventListener('click', () => {
                document.querySelectorAll('.channel-item').forEach(ch => ch.classList.remove('active'));
                item.classList.add('active');
                
                const url = item.getAttribute('data-url');
                const name = item.getAttribute('data-name');
                const logo = item.getAttribute('data-logo');
                const group = item.getAttribute('data-group');
                
                this.player.loadStream(url, name, logo, group);
            });
        });
    }
    
    showLoading(type, message) {
        const panelContent = document.getElementById(`${type}-content`);
        panelContent.innerHTML = `
            <div class="loading">
                <i class="fas fa-spinner fa-spin"></i>
                <p>${message}</p>
                ${IS_LOCAL_FILE ? '<small>Modo desarrollo local activado</small>' : ''}
            </div>
        `;
    }
    
    refreshPanel(type) {
        const panelContent = document.getElementById(`${type}-content`);
        const refreshBtn = document.getElementById(`refresh-${type}`);
        
        if (refreshBtn) {
            const icon = refreshBtn.querySelector('i');
            icon.className = 'fas fa-spinner fa-spin';
            
            setTimeout(() => {
                icon.className = 'fas fa-sync-alt';
                this.loadPlaylistType(type);
            }, 800);
        }
    }
}

// ===== INICIALIZACIÓN =====
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 StreamBank iniciando...');
    
    // Mostrar advertencia si estamos en file://
    if (IS_LOCAL_FILE) {
        const warning = document.createElement('div');
        warning.className = 'dev-warning';
        warning.innerHTML = `
            <strong>⚠️ MODO DESARROLLO LOCAL</strong>
            <p>Estás en file:// - Usando datos de ejemplo</p>
            <p>Para carga real, usa: <code>python -m http.server</code></p>
        `;
        document.body.prepend(warning);
        
        // Estilo para la advertencia
        const style = document.createElement('style');
        style.textContent = `
            .dev-warning {
                background: #ff9800;
                color: #000;
                padding: 10px 15px;
                text-align: center;
                border-bottom: 2px solid #f57c00;
                font-size: 0.9rem;
            }
            .dev-warning code {
                background: rgba(0,0,0,0.2);
                padding: 2px 5px;
                border-radius: 3px;
            }
        `;
        document.head.appendChild(style);
    }
    
    try {
        window.app = new StreamBankLocal();
        console.log('✅ Aplicación lista');
    } catch (error) {
        console.error('💥 Error:', error);
    }
});

// ===== STREAM PLAYER (igual que antes) =====
class StreamPlayer {
    constructor() {
        this.video = document.getElementById('stream-player');
        this.hls = null;
        this.video.volume = 0.5;
        this.initControls();
    }
    
    initControls() {
        // ... (mantén el mismo código del reproductor)
    }
    
    loadStream(url, name, logo, group) {
        console.log('▶️ Reproduciendo:', name);
        // ... (mantén el mismo código)
    }
}
