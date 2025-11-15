(() => {
  const fileInput = document.getElementById('file');
  const fileListEl = document.getElementById('file-list');
  const header = document.querySelector('.header');
  const trashIcon = document.getElementById('trashIcon');
  const outputEl = document.getElementById('play-output');
  const loadMoreBtn = document.getElementById('load-more-btn');

  let allPlays = [];
  let currentIndex = 0;
  const ITEMS_PER_PAGE = 50;

  const API_URL = "http://127.0.0.1:8888";

  const updateFileList = (files) => {
    fileListEl.textContent = !files || !files.length ? 'Not selected file' : `${files.length} file${files.length > 1 ? 's' : ''}`;
  };

  function redirectToLogin() {
    localStorage.removeItem('spotifyAccessToken');
    localStorage.removeItem('spotifyRefreshToken');
    window.location.href = '/spotistats-preview/login.html';
  }

  async function refreshAccessToken() {
    const refreshToken = localStorage.getItem('spotifyRefreshToken');
    if (!refreshToken) {
      redirectToLogin();
      return null;
    }
    try {
      const res = await fetch(`${API_URL}/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refreshToken })
      });
      if (!res.ok) throw new Error('Could not refresh token');
      const { accessToken } = await res.json();
      localStorage.setItem('spotifyAccessToken', accessToken);
      return accessToken;
    } catch (e) {
      redirectToLogin();
      return null;
    }
  }

  async function secureFetch(url, options = {}) {
    let accessToken = localStorage.getItem('spotifyAccessToken');
    if (!accessToken) {
      redirectToLogin();
      return null;
    }
    options.headers = { ...options.headers, 'Authorization': `Bearer ${accessToken}` };
    let response = await fetch(url, options);
    if (response.status === 401) {
      const newAccessToken = await refreshAccessToken();
      if (!newAccessToken) return null;
      options.headers['Authorization'] = `Bearer ${newAccessToken}`;
      response = await fetch(url, options);
    }
    return response;
  }

  async function getAlbumArt(trackName, artistName) {
    try {
      const res = await secureFetch(
        `${API_URL}/search-track?trackName=${encodeURIComponent(trackName)}&artistName=${encodeURIComponent(artistName)}`
      );
      if (!res) return '/spotistats-preview/images/spotistats-logo.png';
      if (!res.ok) throw new Error(`API search failed ${res.status}`);
      const data = await res.json();
      return data.imageUrl || '/spotistats-preview/images/spotistats-logo.png';
    } catch (e) {
      console.error(`Failed to fetch album art for ${trackName}:`, e);
      return '/spotistats-preview/images/spotistats-logo.png';
    }
  }

  async function displayMorePlays() {
    loadMoreBtn.disabled = true;
    loadMoreBtn.textContent = 'Chargement...';

    const playsToDisplay = allPlays.slice(currentIndex, currentIndex + ITEMS_PER_PAGE);

    if (playsToDisplay.length === 0) {
      loadMoreBtn.textContent = 'Fin des résultats';
      return;
    }

    for (const play of playsToDisplay) {
      const imageUrl = await getAlbumArt(play.trackName, play.artistName);
      const playedAt = new Date(play.endTime);
      const time = playedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const date = playedAt.toLocaleDateString();

      const cardHTML = `
        <div class="card-item">
          <img src="${imageUrl}" alt="Album art" />
          <div class="card-text">
            <strong>${play.trackName}</strong>
            <small>${play.artistName}</small>
            <small>Écouté à ${time} le ${date}</small>
          </div>
        </div>
      `;
      outputEl.insertAdjacentHTML('beforeend', cardHTML);
    }

    currentIndex += ITEMS_PER_PAGE;

    if (currentIndex >= allPlays.length) {
      loadMoreBtn.textContent = 'Fin des résultats';
    } else {
      loadMoreBtn.textContent = `Afficher ${ITEMS_PER_PAGE} de plus`;
      loadMoreBtn.disabled = false;
    }
  }

  fileInput.addEventListener('change', async () => {
    updateFileList(fileInput.files);
    const file = fileInput.files[0];
    if (!file || !file.name.toLowerCase().endsWith('.zip')) return;

    outputEl.innerHTML = '<p>Traitement du fichier ZIP...</p>';

    allPlays = [];
    currentIndex = 0;
    loadMoreBtn.style.display = 'none';
    loadMoreBtn.disabled = false;
    loadMoreBtn.textContent = `Afficher ${ITEMS_PER_PAGE} de plus`;

    try {
      const zip = await JSZip.loadAsync(file);
      const historyFiles = Object.keys(zip.files).filter(name => name.includes('StreamingHistory') && name.endsWith('.json'));

      for (const fileName of historyFiles) {
        const content = await zip.files[fileName].async('string');
        allPlays = allPlays.concat(JSON.parse(content));
      }
    } catch (error) {
      console.error('JSZip Error:', error);
      outputEl.innerHTML = '<p class="error">Erreur lors de la lecture du ZIP.</p>';
      return;
    }

    if (!allPlays.length) {
      outputEl.innerHTML = '<p class="error">Aucune écoute trouvée.</p>';
      return;
    }

    outputEl.innerHTML = '';
    loadMoreBtn.style.display = 'block';

    displayMorePlays();
  });

  loadMoreBtn.addEventListener('click', displayMorePlays);

  header.addEventListener('click', () => fileInput.click());

  trashIcon.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    fileInput.value = '';
    updateFileList([]);
    outputEl.innerHTML = '';

    loadMoreBtn.style.display = 'none';
    allPlays = [];
    currentIndex = 0;
  });
})();