(() => {
    'use strict';

    const audio = document.getElementById('audio-player');
    const trackList = document.getElementById('track-list');
    const emptyState = document.getElementById('empty-state');
    const trackCount = document.getElementById('track-count');
    const loadContainer = document.getElementById('load-container');
    const loadBtn = document.getElementById('load-btn');
    const searchInput = document.getElementById('search-input');

    const playBtn = document.getElementById('play-btn');
    const playIcon = document.getElementById('play-icon');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');

    const progressBar = document.getElementById('progress-bar');
    const progressFill = document.getElementById('progress-fill');
    const timeCurrent = document.getElementById('time-current');
    const timeTotal = document.getElementById('time-total');

    const playerName = document.getElementById('player-name');
    const playerArtist = document.getElementById('player-artist');
    const playerArtImg = document.getElementById('player-art-img');
    const playerArtPlaceholder = document.getElementById('player-art-placeholder');

    const npTitle = document.getElementById('np-title');
    const npArtist = document.getElementById('np-artist');
    const npAlbum = document.getElementById('np-album');
    const npArtImg = document.getElementById('np-art-img');
    const npArtPlaceholder = document.getElementById('np-art-placeholder');
    const npArt = document.getElementById('np-art');
    const nowPlaying = document.getElementById('now-playing');
    const idleMsg = document.getElementById('idle-msg');

    const volumeSlider = document.getElementById('volume-slider');
    const volumeIcon = document.getElementById('volume-icon');

    const canvas = document.getElementById('visualizer');
    const ctx = canvas.getContext('2d');

    let tracks = [];
    let filteredTracks = [];
    let currentIndex = -1;
    let isPlaying = false;

    let audioCtx = null;
    let analyser = null;
    let source = null;
    let dataArray = null;
    let animationId = null;

    // ── ICON PATHS ──
    const ICON_PLAY = 'M8 5v14l11-7z';
    const ICON_PAUSE = 'M6 19h4V5H6v14zm8-14v14h4V5h-4z';
    const ICON_VOL_LOW = 'M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z';
    const ICON_VOL_MID = 'M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z';
    const ICON_VOL_HIGH = 'M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zm2.5 0c0 2.81-1.61 5.24-4 6.41v-12.8c2.39 1.17 4 3.6 4 6.39z';
    const ICON_VOL_MUTE = 'M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z';

    // ── INITIALIZE ──
    function init() {
        loadBtn.addEventListener('click', handleFileLoad);
        searchInput.addEventListener('input', handleSearch);
        playBtn.addEventListener('click', togglePlay);
        prevBtn.addEventListener('click', playPrev);
        nextBtn.addEventListener('click', playNext);
        progressBar.addEventListener('click', seekTo);
        volumeSlider.addEventListener('input', handleVolume);

        audio.addEventListener('timeupdate', updateProgress);
        audio.addEventListener('ended', playNext);
        audio.addEventListener('loadedmetadata', updateDuration);

        volumeIcon.addEventListener('click', toggleMute);

        audio.volume = 0.7;
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        document.addEventListener('keydown', handleKeyboard);
    }

    // ── FILE LOADING ──
    function handleFileLoad() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const data = JSON.parse(ev.target.result);
                    loadTracks(data);
                } catch (err) {
                    console.error('Invalid JSON:', err);
                }
            };
            reader.readAsText(file);
        });
        input.click();
    }

    // Also try fetching tracks.json from root on load
    async function tryAutoLoad() {
        try {
            const res = await fetch('/tracks.json');
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data) && data.length > 0) {
                    loadTracks(data);
                }
            }
        } catch (e) {
            // silent — show load button instead
            loadContainer.style.display = '';
        }
    }

    function loadTracks(data) {
        tracks = data.map((t, i) => ({
            name: t.name || t.track || 'Unknown',
            artist: t.artist || t.artist_name || 'Unknown',
            album: t.album || t.album_name || '',
            date: t.date || t.scrobble_date || '',
            albumArt: t.albumArt || t.album_art || t.image || '',
            preview: t.preview || t.preview_url || '',
            url: t.url || t.lastfmUrl || t.lastfm_url || '',
            _index: i
        }));

        filteredTracks = [...tracks];
        emptyState.style.display = 'none';
        loadContainer.style.display = 'none';
        trackCount.textContent = `${tracks.length} tracks loaded`;
        renderTrackList();
    }

    // ── TRACK LIST RENDERING ──
    function renderTrackList() {
        const existing = trackList.querySelectorAll('.track-item');
        existing.forEach(el => el.remove());

        if (filteredTracks.length === 0) {
            emptyState.style.display = 'flex';
            emptyState.querySelector('h3').textContent = 'no matches';
            emptyState.querySelector('p').textContent = 'try a different search';
            return;
        }

        emptyState.style.display = 'none';

        const fragment = document.createDocumentFragment();
        filteredTracks.forEach((track, i) => {
            const el = document.createElement('div');
            el.className = 'track-item' + (track._index === currentIndex ? ' active' : '');
            el.dataset.index = track._index;

            const artHtml = track.albumArt
                ? `<img class="track-art" src="${escapeAttr(track.albumArt)}" alt="" loading="lazy" onerror="this.outerHTML='<div class=\\'track-art-placeholder\\'>&diams;</div>'">`
                : `<div class="track-art-placeholder">&diams;</div>`;

            el.innerHTML = `
                ${artHtml}
                <div class="track-info">
                    <div class="track-name">${escapeHtml(track.name)}</div>
                    <div class="track-artist">${escapeHtml(track.artist)}</div>
                </div>
                <div class="track-duration">${track.album ? escapeHtml(truncate(track.album, 20)) : ''}</div>
            `;

            el.addEventListener('click', () => playTrack(track._index));
            fragment.appendChild(el);
        });

        trackList.appendChild(fragment);
    }

    // ── PLAYBACK ──
    function playTrack(index) {
        if (index < 0 || index >= tracks.length) return;
        currentIndex = index;
        const track = tracks[index];

        // Update UI
        updateNowPlaying(track);
        updatePlayerBar(track);
        renderTrackList();

        // Scroll active into view
        const activeEl = trackList.querySelector('.track-item.active');
        if (activeEl) activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        if (track.preview) {
            audio.src = track.preview;
            audio.play().then(() => {
                isPlaying = true;
                updatePlayButton();
                initVisualizer();
            }).catch(err => {
                console.warn('Playback failed:', err);
            });
        } else {
            // No preview — just show the track info
            idleMsg.style.display = 'none';
            nowPlaying.style.display = '';
        }
    }

    function togglePlay() {
        if (currentIndex === -1 && tracks.length > 0) {
            playTrack(0);
            return;
        }
        if (isPlaying) {
            audio.pause();
            isPlaying = false;
        } else {
            audio.play().then(() => {
                isPlaying = true;
                initVisualizer();
            }).catch(() => {});
        }
        updatePlayButton();
    }

    function playNext() {
        if (tracks.length === 0) return;
        const next = currentIndex + 1;
        if (next < tracks.length) {
            playTrack(next);
        } else {
            playTrack(0);
        }
    }

    function playPrev() {
        if (tracks.length === 0) return;
        if (audio.currentTime > 3) {
            audio.currentTime = 0;
            return;
        }
        const prev = currentIndex - 1;
        playTrack(prev >= 0 ? prev : tracks.length - 1);
    }

    // ── UI UPDATES ──
    function updateNowPlaying(track) {
        idleMsg.style.display = 'none';
        nowPlaying.style.display = '';

        npTitle.textContent = track.name;
        npArtist.textContent = track.artist;
        npAlbum.textContent = track.album || '';

        if (track.albumArt) {
            npArtImg.src = track.albumArt;
            npArtImg.alt = track.name;
            npArtImg.style.display = '';
            npArtPlaceholder.style.display = 'none';
        } else {
            npArtImg.style.display = 'none';
            npArtPlaceholder.style.display = '';
        }
    }

    function updatePlayerBar(track) {
        playerName.textContent = track.name;
        playerArtist.textContent = track.artist;

        if (track.albumArt) {
            playerArtImg.src = track.albumArt;
            playerArtImg.style.display = '';
            playerArtPlaceholder.style.display = 'none';
        } else {
            playerArtImg.style.display = 'none';
            playerArtPlaceholder.style.display = '';
        }
    }

    function updatePlayButton() {
        playIcon.innerHTML = `<path d="${isPlaying ? ICON_PAUSE : ICON_PLAY}"/>`;
        if (isPlaying) {
            npArt.classList.add('playing');
        } else {
            npArt.classList.remove('playing');
        }
    }

    function updateProgress() {
        if (!audio.duration) return;
        const pct = (audio.currentTime / audio.duration) * 100;
        progressFill.style.width = pct + '%';
        timeCurrent.textContent = formatTime(audio.currentTime);
    }

    function updateDuration() {
        if (audio.duration && isFinite(audio.duration)) {
            timeTotal.textContent = formatTime(audio.duration);
        }
    }

    function seekTo(e) {
        if (!audio.duration) return;
        const rect = progressBar.getBoundingClientRect();
        const pct = (e.clientX - rect.left) / rect.width;
        audio.currentTime = pct * audio.duration;
    }

    function handleVolume() {
        audio.volume = volumeSlider.value / 100;
        updateVolumeIcon();
    }

    let lastVolume = 0.7;
    function toggleMute() {
        if (audio.volume > 0) {
            lastVolume = audio.volume;
            audio.volume = 0;
            volumeSlider.value = 0;
        } else {
            audio.volume = lastVolume;
            volumeSlider.value = lastVolume * 100;
        }
        updateVolumeIcon();
    }

    function updateVolumeIcon() {
        const v = audio.volume;
        let path;
        if (v === 0) path = ICON_VOL_MUTE;
        else if (v < 0.33) path = ICON_VOL_LOW;
        else if (v < 0.66) path = ICON_VOL_MID;
        else path = ICON_VOL_HIGH;
        volumeIcon.querySelector('path').setAttribute('d', path);
    }

    // ── SEARCH / FILTER ──
    function handleSearch() {
        const q = searchInput.value.toLowerCase().trim();
        if (!q) {
            filteredTracks = [...tracks];
        } else {
            filteredTracks = tracks.filter(t =>
                t.name.toLowerCase().includes(q) ||
                t.artist.toLowerCase().includes(q) ||
                t.album.toLowerCase().includes(q)
            );
        }
        renderTrackList();
    }

    // ── KEYBOARD SHORTCUTS ──
    function handleKeyboard(e) {
        if (e.target.tagName === 'INPUT') return;
        switch (e.code) {
            case 'Space':
                e.preventDefault();
                togglePlay();
                break;
            case 'ArrowRight':
                if (e.shiftKey) playNext();
                else if (audio.duration) audio.currentTime = Math.min(audio.currentTime + 5, audio.duration);
                break;
            case 'ArrowLeft':
                if (e.shiftKey) playPrev();
                else if (audio.duration) audio.currentTime = Math.max(audio.currentTime - 5, 0);
                break;
            case 'ArrowUp':
                e.preventDefault();
                audio.volume = Math.min(audio.volume + 0.05, 1);
                volumeSlider.value = audio.volume * 100;
                updateVolumeIcon();
                break;
            case 'ArrowDown':
                e.preventDefault();
                audio.volume = Math.max(audio.volume - 0.05, 0);
                volumeSlider.value = audio.volume * 100;
                updateVolumeIcon();
                break;
        }
    }

    // ── VISUALIZER ──
    function resizeCanvas() {
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
    }

    function initVisualizer() {
        if (audioCtx) return;
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioCtx.createAnalyser();
            source = audioCtx.createMediaElementSource(audio);
            source.connect(analyser);
            analyser.connect(audioCtx.destination);
            analyser.fftSize = 256;
            const bufferLength = analyser.frequencyBinCount;
            dataArray = new Uint8Array(bufferLength);
            drawVisualizer();
        } catch (e) {
            console.warn('Web Audio API not available:', e);
            drawFallbackVisualizer();
        }
    }

    function drawVisualizer() {
        animationId = requestAnimationFrame(drawVisualizer);
        if (!analyser || !dataArray) return;

        analyser.getByteFrequencyData(dataArray);

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const bufferLength = dataArray.length;
        const barWidth = (canvas.width / bufferLength) * 2.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const barHeight = (dataArray[i] / 255) * canvas.height * 0.8;
            const alpha = 0.15 + (dataArray[i] / 255) * 0.45;

            // gradient from wine to accent
            const r = 114 + (225 - 114) * (i / bufferLength);
            const g = 47 + (173 - 47) * (i / bufferLength);
            const b = 55 + (1 - 55) * (i / bufferLength);

            ctx.fillStyle = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`;
            ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);

            // mirror — faint reflection above
            ctx.fillStyle = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha * 0.2})`;
            ctx.fillRect(x, canvas.height - barHeight - barHeight * 0.3, barWidth - 1, barHeight * 0.3);

            x += barWidth;
        }
    }

    function drawFallbackVisualizer() {
        // Static gentle bars when audio context unavailable
        const barCount = 64;
        const barWidth = canvas.width / barCount;

        function drawStatic() {
            animationId = requestAnimationFrame(drawStatic);
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            for (let i = 0; i < barCount; i++) {
                const h = 4 + Math.sin(Date.now() * 0.001 + i * 0.3) * 15;
                const alpha = 0.1 + Math.sin(Date.now() * 0.001 + i * 0.2) * 0.05;
                const r = 114 + (225 - 114) * (i / barCount);
                const g = 47 + (173 - 47) * (i / barCount);
                const b = 55 + (1 - 55) * (i / barCount);

                ctx.fillStyle = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`;
                ctx.fillRect(i * barWidth, canvas.height - h, barWidth - 1, h);
            }
        }
        drawStatic();
    }

    // ── UTILITIES ──
    function formatTime(sec) {
        if (!sec || !isFinite(sec)) return '0:00';
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return m + ':' + (s < 10 ? '0' : '') + s;
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function escapeAttr(str) {
        return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function truncate(str, len) {
        return str.length > len ? str.slice(0, len) + '...' : str;
    }

    // ── BOOT ──
    init();
    tryAutoLoad();
})();
