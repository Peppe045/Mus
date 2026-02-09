const API_BASE = 'https://api.monochrome.tf';

let currentTrackInfo = null; // Variabile per memorizzare le info del brano corrente

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
                         <button onclick="playTrack(${track.id})">Play</button>
                         <button onclick="downloadFlac(event, ${track.id})">Scarica FLAC</button>`;
        container.appendChild(div);
    });
}

async function playTrack(trackId) {
    // 1. Ottieni i dettagli del brano
    const info = await fetch(`${API_BASE}/info/?id=${trackId}`).then(r => r.json());
    currentTrackInfo = info.data; // Memorizza le info

    // 2. Ottieni il manifesto di streaming
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

// Funzione per scaricare il FLAC con il nome corretto
async function downloadFlac(event, trackId) {
    event.stopPropagation();
    event.preventDefault();
    
    try {
        // Ottieni le info del brano
        const info = await fetch(`${API_BASE}/info/?id=${trackId}`).then(r => r.json());
        const trackInfo = info.data;
        
        // Ottieni il manifesto FLAC
        const trackData = await fetch(`${API_BASE}/track/?id=${trackId}&quality=LOSSLESS`).then(r => r.json());
        const manifestData = trackData.data;
        
        if (manifestData.manifestMimeType === 'application/vnd.tidal.bts') {
            const jsonStr = atob(manifestData.manifest);
            const manifest = JSON.parse(jsonStr);
            const audioUrl = manifest.urls[0];
            
            // Crea il nome del file
            const fileName = `${trackInfo.artist.name} - ${trackInfo.title}.flac`
                .replace(/[<>:"/\\|?*]/g, '_') // Rimuovi caratteri non validi per i file
                .replace(/\s+/g, ' '); // Sostituisci spazi multipli
            
            // Scarica il file tramite fetch
            const response = await fetch(audioUrl);
            if (!response.ok) {
                throw new Error(`Errore nella rete: ${response.status}`);
            }
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            
            // Crea il link di download
            const downloadLink = document.getElementById('flacDownloadLink');
            downloadLink.href = blobUrl;
            downloadLink.download = fileName;
            downloadLink.click();
            
            // Rilascia l'URL del blob dopo il click
            setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
            
            console.log(`Download avviato: ${fileName}`);
        } else {
            alert('Questo brano non è disponibile in formato FLAC diretto.');
        }
    } catch (error) {
        console.error('Errore nel download:', error);
        alert('Errore nel download del file.');
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