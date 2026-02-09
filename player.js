const API_BASE = 'https://api.monochrome.tf';

async function search() {
    const query = document.getElementById('searchBox').value;
    const response = await fetch(`${API_BASE}/search/?s=${encodeURIComponent(query)}`);
    const data = await response.json();
    displayResults(data.data.items);
}

function displayResults(tracks) {
    const container = document.getElementById('results');
    container.innerHTML = '';
    tracks.forEach(track => {
        const div = document.createElement('div');
        div.innerHTML = `<strong>${track.title}</strong> - ${track.artist.name}
                         <button onclick="playTrack(${track.id})">Play</button>`;
        container.appendChild(div);
    });
}

async function playTrack(trackId) {
    // 1. Ottieni i dettagli del brano (opzionale, per metadati)
    const info = await fetch(`${API_BASE}/info/?id=${trackId}`).then(r => r.json());

    // 2. Ottieni il manifesto di streaming
    //    Nota: puoi forzare 'LOSSLESS' (FLAC) o 'HI_RES_LOSSLESS' (DASH)
    const trackData = await fetch(`${API_BASE}/track/?id=${trackId}&quality=LOSSLESS`).then(r => r.json());
    const manifestData = trackData.data;

    // 3. Decodifica e gestisci il manifesto in base al tipo
    if (manifestData.manifestMimeType === 'application/vnd.tidal.bts') {
        // Caso A: FLAC diretto (JSON base64)
        await playSimpleFlac(manifestData.manifest);
    } else if (manifestData.manifestMimeType === 'application/dash+xml') {
        // Caso B: Stream DASH (MPD base64)
        await playDashStream(manifestData.manifest);
    } else {
        console.error('Formato manifesto non supportato:', manifestData.manifestMimeType);
    }
}

// CASO A: Riproduzione FLAC diretto (via elemento <audio>)
async function playSimpleFlac(base64Manifest) {
    const jsonStr = atob(base64Manifest); // Decodifica base64
    const manifest = JSON.parse(jsonStr);
    const audioUrl = manifest.urls[0]; // URL FLAC diretto

    const player = document.getElementById('simpleAudioPlayer');
    player.src = audioUrl;
    player.style.display = 'block';
    document.getElementById('dashVideoContainer').style.display = 'none';
    await player.play();
}

// CASO B: Riproduzione stream DASH/Hi-Res (via Shaka Player)
async function playDashStream(base64Manifest) {
    const mpdStr = atob(base64Manifest); // Decodifica base64
    const manifestUrl = URL.createObjectURL(new Blob([mpdStr], {type: 'application/dash+xml'}));

    const video = document.getElementById('dashVideoPlayer');
    const container = document.getElementById('dashVideoContainer');
    container.style.display = 'block';
    document.getElementById('simpleAudioPlayer').style.display = 'none';

    // Configura Shaka Player
    const player = new shaka.Player(video);
    player.configure({
        streaming: {
            bufferingGoal: 30
        }
    });

    try {
        await player.load(manifestUrl);
    } catch (error) {
        console.error('Errore nel caricamento dello stream DASH:', error);
    }
    URL.revokeObjectURL(manifestUrl); // Pulizia
}