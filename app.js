let allReleases = [];
let countdownTimer = 60;
let countdownInterval = null;
let autoRefreshInterval = null;
let isSearchMode = false;

const STORAGE_KEY = 'predb_releases';
const LOG_KEY = 'predb_logs';

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupEventListeners();
    loadCachedData();
    fetchReleases();
    startCountdown();
    startAutoRefresh();
});

function initializeApp() {
    logToStorage('Uygulama başlatıldı');
}

function setupEventListeners() {
    document.getElementById('searchBtn').addEventListener('click', handleSearch);
    
    document.getElementById('searchInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
    });
    
    document.getElementById('clearBtn').addEventListener('click', () => {
        document.getElementById('searchInput').value = '';
        displayReleases(allReleases);
        isSearchMode = false;
    });
    
    document.getElementById('refreshBtn').addEventListener('click', () => {
        fetchReleases();
        resetCountdown();
    });
    
    document.getElementById('clearLogsBtn').addEventListener('click', clearLogs);
}

function loadCachedData() {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached) {
        try {
            const data = JSON.parse(cached);
            allReleases = data.releases || [];
            if (allReleases.length > 0) {
                displayReleases(allReleases);
                updateStats();
                document.getElementById('lastUpdate').textContent = data.lastUpdate || '-';
                logToStorage('Cache\'den veri yüklendi');
            }
        } catch (e) {
        }
    }
}

function saveToCache(releases) {
    const data = {
        releases: releases,
        lastUpdate: new Date().toLocaleString('tr-TR'),
        timestamp: Date.now()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function logToStorage(message) {
    const logs = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
    const logEntry = {
        timestamp: new Date().toLocaleString('tr-TR'),
        message: message
    };
    logs.unshift(logEntry);
    
    if (logs.length > 100) {
        logs.splice(100);
    }
    
    localStorage.setItem(LOG_KEY, JSON.stringify(logs));
}

function clearLogs() {
    if (confirm('Tüm loglar silinecek. Emin misiniz?')) {
        localStorage.removeItem(LOG_KEY);
        logToStorage('Loglar temizlendi');
        alert('Loglar başarıyla temizlendi!');
    }
}

async function fetchReleases() {
    showLoading(true);
    hideError();
    isSearchMode = false;
    document.getElementById('searchInput').value = '';
    
    logToStorage('API\'den veri çekiliyor...');
    
    try {
        const blurayData = await fetchFromAPI('BLURAY', 50);
        
        allReleases = blurayData;
        
        saveToCache(allReleases);
        displayReleases(allReleases);
        updateStats();
        
        document.getElementById('lastUpdate').textContent = new Date().toLocaleString('tr-TR');
        
        logToStorage(`${allReleases.length} release başarıyla yüklendi`);
        
    } catch (error) {
        showError('Veri çekilirken hata oluştu: ' + error.message);
        logToStorage('Hata: ' + error.message);
    } finally {
        showLoading(false);
    }
}

async function fetchFromAPI(section, limit) {
    const url = `https://api.predb.net/?section=${section}&limit=${limit}`;
    
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.status === 'error') {
        throw new Error(data.message || 'API hatası');
    }
    
    return data.data || [];
}

function displayReleases(releases) {
    const container = document.getElementById('releaseList');
    
    if (!releases || releases.length === 0) {
        container.innerHTML = '<div class="no-results" style="text-align: center; padding: 40px; color: #6c757d;">Sonuç bulunamadı.</div>';
        return;
    }
    
    container.innerHTML = releases.map(release => createReleaseCard(release)).join('');
}

function createReleaseCard(release) {
    const date = new Date(release.pretime * 1000).toLocaleString('tr-TR');
    const statusClass = release.status === 1 ? 'status-nuked' : 'status-ok';
    const statusText = release.status === 1 ? 'NUKED' : 'OK';
    
    const nfoImageUrl = `https://api.predb.net/nfoimg/${encodeURIComponent(release.release)}.png`;
    
    return `
        <div class="release-item">
            <div class="release-header">
                <div class="release-name">${escapeHtml(release.release)}</div>
                <div class="release-section">${escapeHtml(release.section)}</div>
            </div>
            <div class="release-details">
                <div class="detail-item">
                    <span class="detail-label">Tarih:</span>
                    <span>${date}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Grup:</span>
                    <span>${escapeHtml(release.group || 'N/A')}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Durum:</span>
                    <span class="${statusClass}">${statusText}</span>
                </div>
                <div class="detail-item">
                    <button class="nfo-btn" onclick="openNfoModal('${nfoImageUrl}', '${escapeHtml(release.release).replace(/'/g, "\\'")}')">NFO Göster</button>
                </div>
                ${release.reason ? `
                <div class="detail-item" style="width: 100%;">
                    <span class="detail-label">Sebep:</span>
                    <span>${escapeHtml(release.reason)}</span>
                </div>
                ` : ''}
            </div>
        </div>
    `;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function updateStats() {
    document.getElementById('totalCount').textContent = allReleases.length;
}

async function handleSearch() {
    const query = document.getElementById('searchInput').value.trim();
    
    if (!query) {
        displayReleases(allReleases);
        isSearchMode = false;
        return;
    }
    
    showLoading(true);
    hideError();
    isSearchMode = true;
    
    logToStorage(`API\'den arama yapılıyor: "${query}"`);
    
    try {
        const url = `https://api.predb.net/?q=${encodeURIComponent(query)}&section=BLURAY&limit=50`;
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.status === 'error') {
            throw new Error(data.message || 'API hatası');
        }
        
        const results = data.data || [];
        displayReleases(results);
        
        logToStorage(`Arama tamamlandı: "${query}" - ${results.length} sonuç`);
        
    } catch (error) {
        showError('Arama sırasında hata oluştu: ' + error.message);
        logToStorage('Arama hatası: ' + error.message);
    } finally {
        showLoading(false);
    }
}

function startCountdown() {
    countdownInterval = setInterval(() => {
        countdownTimer--;
        document.getElementById('countdown').textContent = countdownTimer;
        
        if (countdownTimer <= 0) {
            resetCountdown();
        }
    }, 1000);
}

function resetCountdown() {
    countdownTimer = 60;
    document.getElementById('countdown').textContent = countdownTimer;
}

function startAutoRefresh() {
    autoRefreshInterval = setInterval(() => {
        fetchReleases();
        resetCountdown();
        logToStorage('Otomatik yenileme yapıldı');
    }, 60000);
}

function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'block' : 'none';
}

function showError(message) {
    const errorDiv = document.getElementById('error');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
}

function hideError() {
    document.getElementById('error').style.display = 'none';
}

function openNfoModal(imageUrl, releaseName) {
    const modal = document.getElementById('nfoModal');
    const modalImg = document.getElementById('nfoModalImage');
    const modalTitle = document.getElementById('nfoModalTitle');
    const modalLoading = document.getElementById('nfoModalLoading');
    const modalError = document.getElementById('nfoModalError');
    
    modal.style.display = 'flex';
    modalTitle.textContent = releaseName;
    modalImg.style.display = 'none';
    modalLoading.style.display = 'block';
    modalError.style.display = 'none';
    
    const img = new Image();
    img.onload = function() {
        modalImg.src = imageUrl;
        modalImg.style.display = 'block';
        modalLoading.style.display = 'none';
    };
    img.onerror = function() {
        modalLoading.style.display = 'none';
        modalError.style.display = 'block';
    };
    img.src = imageUrl;
}

function closeNfoModal() {
    const modal = document.getElementById('nfoModal');
    modal.style.display = 'none';
}

window.addEventListener('beforeunload', () => {
    if (countdownInterval) clearInterval(countdownInterval);
    if (autoRefreshInterval) clearInterval(autoRefreshInterval);
});
