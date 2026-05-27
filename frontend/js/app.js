(function () {
  const params = new URLSearchParams(location.search);
  const joinConfig = JSON.parse(sessionStorage.getItem('trtcJoinConfig') || '{}');
  const config = {
    sdkAppId: Number(joinConfig.sdkAppId),
    userSig: joinConfig.userSig,
    role: params.get('role') || joinConfig.role,
    roomId: params.get('roomId') || joinConfig.roomId,
    userId: params.get('userId') || joinConfig.userId
  };

  const statusEl = document.getElementById('status');
  const eventLogEl = document.getElementById('event-log');
  const leaveButton = document.getElementById('leave-button');
  let trtc = null;
  let stopMode = null;
  let leaving = false;

  function setStatus(message) {
    statusEl.textContent = message;
    addLog(message);
  }

  function addLog(message) {
    const stamp = new Date().toLocaleTimeString();
    const lines = eventLogEl.textContent === 'Starting...' ? [] : eventLogEl.textContent.split('\n');
    lines.push(`${stamp} ${message}`);
    eventLogEl.textContent = lines.slice(-12).join('\n');
  }

  function updateStats(record, samples) {
    document.getElementById('p2p-delay').textContent = `${record.point2point_delay_ms} ms`;
    document.getElementById('jitter-delay').textContent = record.jitter_buffer_delay_ms === null ? 'n/a' : `${record.jitter_buffer_delay_ms} ms`;
    document.getElementById('rtt').textContent = record.rtt_ms === null ? 'n/a' : `${record.rtt_ms} ms`;
    document.getElementById('bitrate').textContent = record.video_bitrate_kbps === null ? 'n/a' : `${record.video_bitrate_kbps} kbps`;
    document.getElementById('framerate').textContent = record.video_framerate === null ? 'n/a' : `${record.video_framerate} fps`;
    document.getElementById('sample-count').textContent = String(samples);
  }

  function bindDiagnostics() {
    if (TRTC.EVENT.ERROR) {
      trtc.on(TRTC.EVENT.ERROR, (event) => {
        addLog(`SDK error: ${JSON.stringify(event)}`);
      });
    }

    trtc.on(TRTC.EVENT.KICKED_OUT, (event) => {
      const reason = event && event.reason ? event.reason : 'unknown';
      setStatus(`Kicked out: ${reason}. Check for duplicate User IDs in the same room.`);
    });

    if (TRTC.EVENT.REMOTE_USER_ENTER) {
      trtc.on(TRTC.EVENT.REMOTE_USER_ENTER, ({ userId }) => {
        setStatus(`Remote user entered: ${userId}`);
      });
    }

    if (TRTC.EVENT.REMOTE_USER_EXIT) {
      trtc.on(TRTC.EVENT.REMOTE_USER_EXIT, ({ userId }) => {
        setStatus(`Remote user exited: ${userId}`);
      });
    }

    if (TRTC.EVENT.REMOTE_VIDEO_UNAVAILABLE) {
      trtc.on(TRTC.EVENT.REMOTE_VIDEO_UNAVAILABLE, ({ userId }) => {
        setStatus(`Remote video unavailable: ${userId}`);
      });
    }

    if (TRTC.EVENT.PUBLISH_STATE_CHANGED) {
      trtc.on(TRTC.EVENT.PUBLISH_STATE_CHANGED, (event) => {
        addLog(`Publish state: ${JSON.stringify(event)}`);
      });
    }
  }

  async function leaveRoom() {
    if (leaving) {
      return;
    }
    leaving = true;
    leaveButton.disabled = true;
    setStatus('Leaving...');

    if (stopMode) {
      await stopMode();
    }
    if (trtc) {
      try { await trtc.exitRoom(); } catch (error) { console.warn(error); }
      try { trtc.destroy(); } catch (error) { console.warn(error); }
    }
    sessionStorage.removeItem('trtcJoinConfig');
    location.href = '/';
  }

  async function main() {
    document.getElementById('role').textContent = config.role || 'n/a';
    document.getElementById('room-id').textContent = config.roomId || 'n/a';
    document.getElementById('user-id').textContent = config.userId || 'n/a';
    addLog(`Config role=${config.role} room=${config.roomId} user=${config.userId}`);

    if (!window.TRTC || !config.sdkAppId || !config.userSig || !config.roomId || !config.userId || !config.role) {
      throw new Error('Missing TRTC join config. Return to the landing page and join again.');
    }

    trtc = TRTC.create();
    bindDiagnostics();
    if (config.role === 'audience') {
      window.ViewerMode.bindRemoteVideo(trtc, setStatus);
    }

    setStatus('Entering room...');
    await trtc.enterRoom({
      sdkAppId: config.sdkAppId,
      userId: config.userId,
      userSig: config.userSig,
      roomId: Number(config.roomId),
      scene: TRTC.TYPE.SCENE_LIVE,
      role: config.role === 'anchor' ? TRTC.TYPE.ROLE_ANCHOR : TRTC.TYPE.ROLE_AUDIENCE,
      autoReceiveAudio: true,
      autoReceiveVideo: false
    });
    addLog('enterRoom succeeded');

    if (config.role === 'anchor') {
      stopMode = await window.AnchorMode.startAnchor({ trtc, setStatus });
    } else {
      stopMode = await window.ViewerMode.startViewer({
        trtc,
        roomId: config.roomId,
        userId: config.userId,
        updateStats,
        setStatus
      });
    }
  }

  leaveButton.addEventListener('click', leaveRoom);
  window.addEventListener('pagehide', () => {
    if (!leaving && trtc) {
      trtc.exitRoom().catch(() => {});
    }
  });

  main().catch((error) => {
    console.error(error);
    setStatus(error.message || String(error));
  });
})();
