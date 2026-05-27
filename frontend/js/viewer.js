(function () {
  function valueOrNull(value) {
    return value === undefined || value === null ? null : value;
  }

  async function createSession({ roomId, userId }) {
    const response = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room_id: roomId, viewer_user_id: userId })
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
    return response.json();
  }

  function endSession(sessionId) {
    if (!sessionId) {
      return;
    }
    fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'PATCH',
      keepalive: true
    }).catch((error) => console.warn('Failed to end session', error));
  }

  function bindRemoteVideo(trtc, setStatus) {
    const remoteView = document.getElementById('remote-video');
    remoteView.classList.remove('hidden');

    trtc.on(TRTC.EVENT.REMOTE_VIDEO_AVAILABLE, ({ userId: remoteUserId, streamType }) => {
      if (setStatus) {
        setStatus(`Remote video available: ${remoteUserId}`);
      }
      trtc.startRemoteVideo({ userId: remoteUserId, streamType, view: remoteView })
        .then(() => {
          if (setStatus) {
            setStatus(`Watching ${remoteUserId}`);
          }
        })
        .catch((error) => {
          console.error('startRemoteVideo failed', error);
          if (setStatus) {
            setStatus(`Remote video failed: ${JSON.stringify(error)}`);
          }
        });
    });
  }

  async function startViewer({ trtc, roomId, userId, updateStats, setStatus }) {
    let sessionId = '';
    let samples = 0;

    const session = await createSession({ roomId, userId });
    sessionId = session.session_id;
    document.getElementById('session-id').textContent = sessionId;
    setStatus(`Session created: ${sessionId}`);

    trtc.on(TRTC.EVENT.STATISTICS, (event) => {
      const remoteStatistics = event.remoteStatistics || [];
      if (remoteStatistics.length === 0 && setStatus) {
        setStatus('Stats received, no remote stats yet');
      }
      remoteStatistics.forEach((remote) => {
        const point2PointDelay = Number(remote.point2PointDelay || 0);
        samples += 1;
        const record = {
          timestamp: new Date().toISOString(),
          session_id: sessionId,
          remote_user_id: remote.userId || 'unknown',
          point2point_delay_ms: point2PointDelay,
          jitter_buffer_delay_ms: valueOrNull(remote.jitterBufferDelay),
          rtt_ms: valueOrNull(event.rtt),
          up_loss_pct: valueOrNull(event.upLoss),
          down_loss_pct: valueOrNull(event.downLoss),
          video_packet_loss_pct: valueOrNull(remote.videoPacketLoss),
          audio_packet_loss_pct: valueOrNull(remote.audioPacketLoss),
          video_bitrate_kbps: valueOrNull(remote.videoBitrate),
          video_framerate: valueOrNull(remote.frameRate),
          video_resolution: remote.width && remote.height ? `${remote.width}x${remote.height}` : null
        };

        fetch('/api/logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(record)
        })
          .then((response) => {
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }
          })
          .catch((error) => {
            console.warn('Stats log failed', error);
            if (setStatus) {
              setStatus(`Stats log failed: ${error.message || error}`);
            }
          });

        updateStats(record, samples);
        if (point2PointDelay <= 0 && setStatus) {
          setStatus(`Logged stats for ${record.remote_user_id}, point2PointDelay=0`);
        }
      });
    });

    window.addEventListener('pagehide', () => endSession(sessionId), { once: true });
    setStatus('Waiting for anchor stream...');

    return async function stopViewer() {
      endSession(sessionId);
    };
  }

  window.ViewerMode = { bindRemoteVideo, startViewer };
})();
