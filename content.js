(() => {
  const CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';
  const TOKEN_QUERY = `query($login: String!) {
    streamPlaybackAccessToken(channelName: $login, params: {platform: "web", playerBackend: "mediaplayer", playerType: "site"}) {
      value
      signature
    }
  }`;
  const NON_CHANNEL_PATHS = new Set([
    'directory', 'downloads', 'drops', 'inventory', 'moderator', 'search',
    'settings', 'subscriptions', 'videos', 'wallet'
  ]);
  const TICK_MS = 250;
  const AD_POLL_MS = 2000;
  const RETRY_DELAY_MS = 5000;
  const QUALITY_KEY = 'tam-quality';
  const VOLUME_KEY = 'tam-volume';
  const CONTROLS_HIDE_MS = 2500;
  const PAUSE_KEYS = new Set(['Space', 'KeyK']);
  const INTERACTIVE_SELECTOR = 'a, button, input, select, textarea, [role="button"], [role="textbox"]';
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const ICONS = {
    play: 'M8 5v14l11-7z',
    pause: 'M6 19h4V5H6v14zm8-14v14h4V5h-4z',
    volume: 'M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z',
    muted: 'M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z',
    clip: 'M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z',
    settings: 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z',
    theatre: 'M19 7H5c-1.1 0-2 .9-2 2v6c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zm0 8H5V9h14v6z',
    fullscreen: 'M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z'
  };
  const CLIP_WAIT_MS = 3000;
  const CLIP_SETTLE_MS = 1000;
  const CLIP_HOLD_MS = 2000;

  let session = null;
  let unavailableLogin = null;
  let retryAt = 0;

  function currentLogin() {
    const parts = location.pathname.split('/').filter(Boolean);
    if (parts.length !== 1 || NON_CHANNEL_PATHS.has(parts[0])) return null;
    return parts[0].toLowerCase();
  }

  async function fetchMasterUrl(login) {
    const res = await fetch('https://gql.twitch.tv/gql', {
      method: 'POST',
      headers: { 'Client-ID': CLIENT_ID, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: TOKEN_QUERY, variables: { login } })
    });
    const body = await res.json();
    const token = body.data && body.data.streamPlaybackAccessToken;
    if (!token) return null;

    const params = new URLSearchParams({
      allow_source: 'true',
      fast_bread: 'true',
      p: String(Math.floor(Math.random() * 1e7)),
      player_backend: 'mediaplayer',
      playlist_include_framerate: 'true',
      sig: token.signature,
      token: token.value
    });
    return `https://usher.ttvnw.net/api/channel/hls/${login}.m3u8?${params}`;
  }

  // Devuelve null si el canal no se puede ver sin sesión: offline o solo suscriptores.
  async function fetchFirstVariant(masterUrl) {
    const res = await fetch(masterUrl);
    if (!res.ok) return null;
    const text = await res.text();
    return text.split('\n').find((line) => line.startsWith('http')) || null;
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Si el stream arranca con anuncio, la playlist no trae ningún segmento reproducible.
  async function waitForContent(current, variantUrl) {
    while (!current.stopped) {
      const res = await fetch(variantUrl);
      if (res.ok && TwitchPlaylist.hasContent(await res.text())) return;
      current.status.textContent = 'Waiting for the ad to finish…';
      await sleep(AD_POLL_MS);
    }
  }

  function createLoaderClass() {
    const filters = new Map();

    return class FilteringLoader extends Hls.DefaultConfig.loader {
      load(context, config, callbacks) {
        if (context.type !== 'level') {
          super.load(context, config, callbacks);
          return;
        }

        if (!filters.has(context.url)) filters.set(context.url, TwitchPlaylist.createFilter());
        const filter = filters.get(context.url);
        super.load(context, config, {
          ...callbacks,
          onSuccess: (response, stats, loaderContext, details) => {
            response.data = filter(response.data);
            callbacks.onSuccess(response, stats, loaderContext, details);
          }
        });
      }
    };
  }

  function qualityLabel(level) {
    const fps = Math.round(Number(level.attrs['FRAME-RATE'])) || 0;
    return fps >= 50 ? `${level.height}p${fps}` : `${level.height}p`;
  }

  function setIcon(button, path) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    const shape = document.createElementNS(SVG_NS, 'path');
    shape.setAttribute('d', path);
    svg.append(shape);
    button.replaceChildren(svg);
  }

  // data-tooltip y no title: el tooltip nativo del navegador no admite estilos.
  function setTooltip(button, title) {
    button.dataset.tooltip = title;
    button.setAttribute('aria-label', title);
  }

  function createButton(icon, title) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tam-button';
    if (title) setTooltip(button, title);
    setIcon(button, icon);
    return button;
  }

  // La preferencia se guarda por etiqueta: los índices cambian entre canales.
  function createQualityMenu(hls) {
    // hls.js ordena de menor a mayor; el menú se muestra de mayor a menor.
    const options = [{ label: 'Auto', index: -1 }];
    for (let i = hls.levels.length - 1; i >= 0; i -= 1) {
      options.push({ label: qualityLabel(hls.levels[i]), index: i });
    }

    const menu = document.createElement('div');
    menu.className = 'tam-menu';
    menu.hidden = true;

    const select = (item) => {
      menu.querySelectorAll('.tam-menu-item').forEach((other) => {
        other.classList.toggle('tam-selected', other === item);
      });
    };

    const saved = localStorage.getItem(QUALITY_KEY);
    options.forEach(({ label, index }) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'tam-menu-item';
      item.textContent = label;
      item.addEventListener('click', () => {
        hls.currentLevel = index;
        if (index === -1) localStorage.removeItem(QUALITY_KEY);
        else localStorage.setItem(QUALITY_KEY, label);
        select(item);
        menu.hidden = true;
      });
      menu.append(item);
    });

    const savedOption = options.find(({ label }) => label === saved) || options[0];
    if (savedOption.index !== -1) hls.loadLevel = savedOption.index;
    select(menu.children[options.indexOf(savedOption)]);

    const settings = createButton(ICONS.settings, 'Quality');
    settings.addEventListener('click', () => { menu.hidden = !menu.hidden; });

    const element = document.createElement('div');
    element.className = 'tam-settings';
    element.append(menu, settings);

    return {
      element,
      close() {
        const wasOpen = !menu.hidden;
        menu.hidden = true;
        return wasOpen;
      }
    };
  }

  function waitForPlaying(video) {
    return new Promise((resolve) => {
      const timeout = setTimeout(resolve, CLIP_WAIT_MS);
      video.addEventListener('playing', () => {
        clearTimeout(timeout);
        setTimeout(resolve, CLIP_SETTLE_MS);
      }, { once: true });
    });
  }

  // Usa el botón del reproductor de Twitch o, si no está en el DOM, su atajo de teclado.
  function triggerNative(player, target, key) {
    const button = player.querySelector(`[data-a-target="${target}"]`);
    if (button) {
      button.click();
      return;
    }
    player.dispatchEvent(new KeyboardEvent('keydown', {
      key,
      code: `Key${key.toUpperCase()}`,
      keyCode: key.toUpperCase().charCodeAt(0),
      altKey: true,
      bubbles: true
    }));
  }

  // El reproductor de Twitch crea el clip desde su propia posición, así que hay que
  // reanudarlo para que vuelva al directo. Debe ocurrir pocos segundos tras el clic:
  // pasado ese margen, Chrome bloquearía la ventana que abre Twitch.
  async function createClip(current, button) {
    const native = [...current.player.querySelectorAll('video')].find((video) => video !== current.video);
    if (!native) return;

    current.clipping = true;
    button.disabled = true;

    native.play().catch(() => {});
    await waitForPlaying(native);
    if (!current.stopped) triggerNative(current.player, 'player-clip-button', 'x');
    await sleep(CLIP_HOLD_MS);

    current.clipping = false;
    button.disabled = false;
  }

  function createVolumeSlider(video) {
    const volume = document.createElement('input');
    volume.type = 'range';
    volume.className = 'tam-volume';
    volume.min = '0';
    volume.max = '1';
    volume.step = '0.01';

    const saved = localStorage.getItem(VOLUME_KEY);
    if (saved !== null) video.volume = Number(saved);
    volume.value = String(video.volume);

    volume.addEventListener('input', () => {
      video.volume = Number(volume.value);
      video.muted = video.volume === 0;
      localStorage.setItem(VOLUME_KEY, volume.value);
    });
    return volume;
  }

  function addControls(current, hls) {
    const { video, player } = current;

    const quality = createQualityMenu(hls);

    const play = createButton(ICONS.pause, 'Pause (space/k)');
    const indicator = document.createElement('div');
    indicator.className = 'tam-indicator';
    // Reiniciar la animación exige forzar un reflow entre quitar y poner la clase.
    const flashIndicator = (icon) => {
      setIcon(indicator, icon);
      indicator.classList.remove('tam-flash');
      void indicator.offsetWidth;
      indicator.classList.add('tam-flash');
    };

    const togglePlay = () => {
      if (!video.paused) {
        video.pause();
        flashIndicator(ICONS.pause);
        return;
      }
      flashIndicator(ICONS.play);
      // Al reanudar se salta al último segmento de la playlist, no al punto donde se pausó.
      const details = hls.latestLevelDetails;
      const lastFragment = details && details.fragments[details.fragments.length - 1];
      if (lastFragment && lastFragment.start > video.currentTime) {
        video.currentTime = lastFragment.start;
      }
      video.play().catch(() => {});
    };
    play.addEventListener('click', togglePlay);
    video.addEventListener('click', () => {
      if (!quality.close() && video.paused) togglePlay();
    });

    // Fase de captura: si no, el atajo de Twitch actuaría sobre su reproductor pausado.
    const onKeyDown = (event) => {
      if (!PAUSE_KEYS.has(event.code) || event.ctrlKey || event.altKey || event.metaKey) return;
      const { target } = event;
      const isOutsideControl = !controls.contains(target)
        && (target.isContentEditable || target.closest(INTERACTIVE_SELECTOR));
      if (isOutsideControl) return;

      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) togglePlay();
    };
    document.addEventListener('keydown', onKeyDown, true);
    current.onKeyDown = onKeyDown;
    video.addEventListener('play', () => {
      setIcon(play, ICONS.pause);
      setTooltip(play, 'Pause (space/k)');
      video.classList.remove('tam-paused');
    });
    video.addEventListener('pause', () => {
      setIcon(play, ICONS.play);
      setTooltip(play, 'Resume (space/k)');
      video.classList.add('tam-paused');
    });

    const mute = createButton(ICONS.volume);
    const volume = createVolumeSlider(video);
    const syncVolume = () => {
      setIcon(mute, video.muted || video.volume === 0 ? ICONS.muted : ICONS.volume);
      volume.value = String(video.muted ? 0 : video.volume);
      // El navegador no pinta el tramo relleno en un slider con estilo propio.
      volume.style.setProperty('--tam-volume-fill', `${volume.value * 100}%`);
    };
    mute.addEventListener('click', () => { video.muted = !video.muted; });
    video.addEventListener('volumechange', syncVolume);
    syncVolume();

    const volumeGroup = document.createElement('div');
    volumeGroup.className = 'tam-volume-group';
    volumeGroup.append(mute, volume);

    const clip = createButton(ICONS.clip, 'Create clip');
    clip.classList.add('tam-clip');
    clip.addEventListener('click', () => createClip(current, clip));

    const theatre = createButton(ICONS.theatre, 'Theatre mode');
    theatre.addEventListener('click', () => {
      triggerNative(player, 'player-theatre-mode-button', 't');
    });

    const fullscreen = createButton(ICONS.fullscreen, 'Fullscreen');
    fullscreen.addEventListener('click', () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else player.requestFullscreen();
    });

    const controls = document.createElement('div');
    controls.className = 'tam-controls';
    controls.append(play, volumeGroup, clip, quality.element, theatre, fullscreen);

    // Por temporizador y no con :hover: en pantalla completa el ratón nunca sale del video.
    const hideControls = () => {
      clearTimeout(current.hideTimer);
      controls.classList.remove('tam-active');
    };
    const showControls = () => {
      controls.classList.add('tam-active');
      clearTimeout(current.hideTimer);
      current.hideTimer = setTimeout(hideControls, CONTROLS_HIDE_MS);
    };
    // Pasar del video a la barra también dispara mouseleave, y ahí no hay que ocultarla.
    const onMouseLeave = (event) => {
      if (event.relatedTarget !== video && !controls.contains(event.relatedTarget)) hideControls();
    };
    video.addEventListener('mousemove', showControls);
    controls.addEventListener('mousemove', showControls);
    video.addEventListener('mouseleave', onMouseLeave);
    controls.addEventListener('mouseleave', onMouseLeave);

    current.controls = controls;
    current.indicator = indicator;
    player.append(indicator, controls);
  }

  function startPlayback(current, masterUrl) {
    const hls = new Hls({ enableWorker: false, pLoader: createLoaderClass() });
    current.hls = hls;

    hls.on(Hls.Events.ERROR, (event, data) => {
      if (!data.fatal || current.stopped) return;
      retryAt = Date.now() + RETRY_DELAY_MS;
      stopSession();
    });
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      // Hasta el primer fotograma: el manifest llega antes que el video.
      current.video.addEventListener('playing', () => current.status.remove(), { once: true });
      addControls(current, hls);
      current.video.play().catch(() => {
        // Chrome bloquea el autoplay con sonido; se activa desde los controles del video.
        current.video.muted = true;
        current.video.play().catch(() => {});
      });
    });

    hls.loadSource(masterUrl);
    hls.attachMedia(current.video);
  }

  async function run(current) {
    try {
      const masterUrl = await fetchMasterUrl(current.login);
      const variantUrl = masterUrl && await fetchFirstVariant(masterUrl);
      if (current.stopped) return;

      if (!variantUrl) {
        unavailableLogin = current.login;
        stopSession();
        return;
      }

      await waitForContent(current, variantUrl);
      if (!current.stopped) startPlayback(current, masterUrl);
    } catch {
      if (current.stopped) return;
      retryAt = Date.now() + RETRY_DELAY_MS;
      stopSession();
    }
  }

  function startSession(login, player) {
    const video = document.createElement('video');
    video.className = 'tam-video';
    video.autoplay = true;

    const status = document.createElement('div');
    status.className = 'tam-status';
    status.textContent = 'Loading stream…';

    player.classList.add('tam-player');
    player.append(video, status);

    session = { login, player, video, status, hls: null, stopped: false, muted: new Set() };
    run(session);
  }

  function stopSession() {
    const current = session;
    session = null;
    current.stopped = true;
    if (current.hls) current.hls.destroy();
    current.video.remove();
    current.status.remove();
    clearTimeout(current.hideTimer);
    if (current.onKeyDown) document.removeEventListener('keydown', current.onKeyDown, true);
    if (current.controls) current.controls.remove();
    if (current.indicator) current.indicator.remove();
    current.player.classList.remove('tam-player');

    current.muted.forEach((video) => {
      video.muted = false;
      video.play().catch(() => {});
    });
  }

  // Twitch intenta reanudar su reproductor, así que hay que pausarlo en cada ciclo.
  function suppressNativePlayer() {
    session.player.querySelectorAll('video').forEach((video) => {
      if (video === session.video) return;
      if (!video.muted) {
        video.muted = true;
        session.muted.add(video);
      }
      if (!video.paused && !session.clipping) video.pause();
    });
  }

  function tick() {
    const login = currentLogin();
    const player = document.querySelector('.video-player');

    if (session && (session.login !== login || session.player !== player || !session.video.isConnected)) {
      stopSession();
    }
    if (login !== unavailableLogin) unavailableLogin = null;
    if (!login || !player || login === unavailableLogin) return;

    if (!session && Date.now() >= retryAt) startSession(login, player);
    if (session) suppressNativePlayer();
  }

  setInterval(tick, TICK_MS);
})();
