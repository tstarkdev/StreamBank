class StreamBank {
    constructor() {
        this.basePath = window.location.pathname.includes('/streambank') 
            ? '/streambank/' 
            : '/';
        this.playlistsPath = 'playlists/';
        this.currentPlaylist = null;
        this.playlistsData = {};
        
        this.init();
    }

    async init() {
        await this.loadPlaylistStructure();
        this.renderNavigation();
        this.setupEventListeners();
        
        // Cargar index.m3u por defecto
        await this.loadPlaylist('index.m3u');
    }

    async loadPlaylistStructure() {
        try {
            // Esta función asume que tienes un endpoint o archivo que lista la estructura
            // Si no, puedes crear un archivo JSON manualmente o usar GitHub API
            const response = await fetch(`${this.basePath}${this.playlistsPath}structure.json`);
            
            if (response.ok) {
                this.playlistsData = await response.json();
            } else {
                // Fallback: estructura por defecto
                this.playlistsData = {
                    playlists: {
                        radio: {
                            'MatchFM.m3u': 'Match FM',
                            'lacaparojafm.m3u': 'La Capa Roja FM'
                        },
                        tv: {
                            'TVabierta.m3u': 'Canales Generales',
                            'deportes.m3u': 'Deportes'
                        },
                        'index.m3u': 'Inicio'
                    }
                };
            }
        } catch (error) {
            console.error('Error loading structure:', error);
            this.playlistsData = {
                playlists: {
                    'index.m3u': 'Inicio'
                }
            };
        }
    }

    renderNavigation() {
        const nav = document.getElementById('playlist-nav');
        if (!nav) return;

        let html = '<ul>';
        
        // Navegación principal
        for (const [key, value] of Object.entries(this.playlistsData.playlists)) {
            if (key === 'radio' || key === 'tv') {
                html += `
                    <li class="folder">
                        <span class="folder-name">${key.toUpperCase()}</span>
                        <ul class="submenu">
                `;
                
                for (const [subKey, subValue] of Object.entries(value)) {
                    html += `
                        <li>
                            <a href="#" data-path="${key}/${subKey}">${subValue}</a>
                        </li>
                    `;
                }
                
                html += '</ul></li>';
            } else {
                html += `
                    <li>
                        <a href="#" data-path="${key}">${value}</a>
                    </li>
                `;
            }
        }
        
        html += '</ul>';
        nav.innerHTML = html;
    }

    async loadPlaylist(path) {
        try {
            const response = await fetch(`${this.basePath}${this.playlistsPath}${path}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const content = await response.text();
            this.currentPlaylist = this.parseM3U(content);
            this.renderPlaylist();
            this.updateCurrentPath(path);
            
        } catch (error) {
            console.error('Error loading playlist:', error);
            document.getElementById('playlist-content').innerHTML = `
                <div class="error">
                    Error al cargar la playlist: ${path}
                </div>
            `;
        }
    }

    parseM3U(content) {
        const lines = content.split('\n');
        const playlist = {
            name: '',
            items: []
        };
        
        let currentItem = null;
        
        lines.forEach(line => {
            line = line.trim();
            
            if (line.startsWith('#EXTM3U')) {
                return;
            }
            
            if (line.startsWith('#EXTINF:')) {
                const match = line.match(/#EXTINF:(-?\d+)(?:,(.*))?/);
                if (match) {
                    currentItem = {
                        duration: parseInt(match[1]),
                        title: match[2] || 'Sin título',
                        url: ''
                    };
                }
            } else if (line && !line.startsWith('#')) {
                if (currentItem) {
                    currentItem.url = line;
                    playlist.items.push(currentItem);
                    currentItem = null;
                } else {
                    playlist.items.push({
                        title: 'Stream',
                        url: line
                    });
                }
            }
        });
        
        return playlist;
    }

    renderPlaylist() {
        const container = document.getElementById('playlist-content');
        if (!container || !this.currentPlaylist) return;
        
        if (this.currentPlaylist.items.length === 0) {
            container.innerHTML = '<div class="empty">No hay streams en esta playlist</div>';
            return;
        }
        
        let html = `
            <div class="playlist-header">
                <h3>${this.currentPlaylist.name || 'Playlist'}</h3>
                <span class="count">${this.currentPlaylist.items.length} streams</span>
            </div>
            <div class="streams-list">
        `;
        
        this.currentPlaylist.items.forEach((item, index) => {
            html += `
                <div class="stream-item" data-index="${index}">
                    <div class="stream-info">
                        <div class="stream-title">${item.title}</div>
                        ${item.duration ? `<div class="stream-duration">${this.formatDuration(item.duration)}</div>` : ''}
                    </div>
                    <div class="stream-actions">
                        <button class="btn-play" onclick="streamBank.playStream(${index})">▶ Reproducir</button>
                        <button class="btn-copy" onclick="streamBank.copyStreamUrl(${index})">📋 Copiar URL</button>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;
    }

    playStream(index) {
        const item = this.currentPlaylist.items[index];
        if (!item) return;
        
        // Aquí implementarías tu reproductor
        // Ejemplo con video.js o player propio
        const player = document.getElementById('video-player');
        if (player) {
            player.src = item.url;
            player.play();
            
            // Mostrar información del stream actual
            document.getElementById('current-stream').innerHTML = `
                <strong>Reproduciendo:</strong> ${item.title}
            `;
        }
        
        console.log('Playing:', item);
    }

    copyStreamUrl(index) {
        const item = this.currentPlaylist.items[index];
        if (!item) return;
        
        navigator.clipboard.writeText(item.url)
            .then(() => {
                alert('URL copiada al portapapeles');
            })
            .catch(err => {
                console.error('Error copying:', err);
            });
    }

    formatDuration(seconds) {
        if (seconds < 0) return 'Live';
        
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    updateCurrentPath(path) {
        document.getElementById('current-path').textContent = 
            `Playlist actual: ${path}`;
        
        // Actualizar título de la página
        const pageTitle = this.getPlaylistName(path);
        document.title = `StreamBank - ${pageTitle}`;
    }

    getPlaylistName(path) {
        const parts = path.split('/');
        const filename = parts[parts.length - 1];
        
        // Buscar el nombre en la estructura
        if (this.playlistsData.playlists) {
            if (parts.length === 1) {
                return this.playlistsData.playlists[filename] || filename;
            } else if (parts.length === 2) {
                const folder = parts[0];
                const file = parts[1];
                if (this.playlistsData.playlists[folder] && 
                    this.playlistsData.playlists[folder][file]) {
                    return this.playlistsData.playlists[folder][file];
                }
            }
        }
        
        return filename.replace('.m3u', '').replace(/_/g, ' ');
    }

    setupEventListeners() {
        // Navegación
        document.addEventListener('click', (e) => {
            if (e.target.matches('#playlist-nav a')) {
                e.preventDefault();
                const path = e.target.dataset.path;
                this.loadPlaylist(path);
            }
            
            // Toggle folders
            if (e.target.matches('.folder-name')) {
                e.target.parentElement.classList.toggle('open');
            }
        });
        
        // Búsqueda
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterStreams(e.target.value);
            });
        }
    }

    filterStreams(searchTerm) {
        if (!this.currentPlaylist || !searchTerm.trim()) {
            // Mostrar todos si no hay búsqueda
            document.querySelectorAll('.stream-item').forEach(item => {
                item.style.display = '';
            });
            return;
        }
        
        const term = searchTerm.toLowerCase();
        document.querySelectorAll('.stream-item').forEach(item => {
            const title = item.querySelector('.stream-title').textContent.toLowerCase();
            item.style.display = title.includes(term) ? '' : 'none';
        });
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.streamBank = new StreamBank();
});