(function () {
  const WIDTH = 1280;
  const HEIGHT = 720;
  const FPS = 30;

  function formatUtcTime(epochMs) {
    const date = new Date(epochMs);
    const hh = String(date.getUTCHours()).padStart(2, '0');
    const mm = String(date.getUTCMinutes()).padStart(2, '0');
    const ss = String(date.getUTCSeconds()).padStart(2, '0');
    const ms = String(date.getUTCMilliseconds()).padStart(3, '0');
    return `${hh}:${mm}:${ss}.${ms}`;
  }

  async function startAnchor({ trtc, setStatus }) {
    const canvas = document.getElementById('anchor-canvas');
    const preview = document.getElementById('anchor-preview');
    const ctx = canvas.getContext('2d', { alpha: false });
    const sourceVideo = document.createElement('video');
    let frameId = 0;
    let lastDrawAt = 0;
    let ntpTimer = 0;

    setStatus('Syncing NTP...');
    try {
      await window.NTPSync.syncNTP();
    } catch (error) {
      console.warn('NTP sync failed, falling back to local clock', error);
    }
    ntpTimer = window.setInterval(() => {
      window.NTPSync.syncNTP().catch((error) => console.warn('NTP resync failed', error));
    }, 60000);

    setStatus('Opening camera...');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error(
        'Camera access (getUserMedia) is not available. ' +
        'Make sure you are accessing the page via https:// or http://localhost (not IP address), ' +
        'and that your browser supports navigator.mediaDevices.'
      );
    }
    const cameraStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        width: { ideal: WIDTH },
        height: { ideal: HEIGHT },
        frameRate: { ideal: FPS, max: FPS }
      }
    });
    sourceVideo.srcObject = cameraStream;
    sourceVideo.muted = true;
    sourceVideo.playsInline = true;
    await sourceVideo.play();

    function drawFrame(now) {
      frameId = requestAnimationFrame(drawFrame);
      if (now - lastDrawAt < 1000 / FPS) {
        return;
      }
      lastDrawAt = now;

      ctx.drawImage(sourceVideo, 0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
      ctx.fillRect(0, HEIGHT - 104, WIDTH, 104);

      const ntpTime = Math.round(window.NTPSync.getNTPTime());
      ctx.font = '700 38px Consolas, monospace';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`${formatUtcTime(ntpTime)} UTC`, 32, HEIGHT - 58);
      ctx.font = '700 30px Consolas, monospace';
      ctx.fillStyle = '#ffd447';
      ctx.fillText(String(ntpTime), 32, HEIGHT - 20);
    }

    drawFrame(performance.now());
    const canvasStream = canvas.captureStream(FPS);
    preview.srcObject = canvasStream;
    preview.classList.remove('hidden');
    await preview.play();

    setStatus('Applying low-latency cache...');
    try {
      await trtc.callExperimentalAPI(JSON.stringify({
        api: 'SetAudioCacheParams',
        params: { min_cache_time: 100, max_cache_time: 200 }
      }));
    } catch (error) {
      console.warn('SetAudioCacheParams failed; continuing without cache override', error);
    }

    setStatus('Publishing...');
    await trtc.startLocalVideo({
      option: {
        videoTrack: canvasStream.getVideoTracks()[0],
        profile: { width: WIDTH, height: HEIGHT, frameRate: FPS, bitrate: 1500 },
        mirror: false,
        fillMode: 'contain'
      }
    });
    await trtc.startLocalAudio();
    setStatus('Live');

    return async function stopAnchor() {
      cancelAnimationFrame(frameId);
      clearInterval(ntpTimer);
      cameraStream.getTracks().forEach((track) => track.stop());
      canvasStream.getTracks().forEach((track) => track.stop());
      preview.srcObject = null;
      try { await trtc.stopLocalAudio(); } catch (error) { console.warn(error); }
      try { await trtc.stopLocalVideo(); } catch (error) { console.warn(error); }
    };
  }

  window.AnchorMode = { startAnchor };
})();
