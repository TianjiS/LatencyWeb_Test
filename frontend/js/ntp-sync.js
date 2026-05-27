(function () {
  let ntpOffset = 0;

  async function syncNTP() {
    const t0 = Date.now();
    const response = await fetch('https://worldtimeapi.org/api/ip', { cache: 'no-store' });
    const t3 = Date.now();
    const data = await response.json();
    const serverTime = new Date(data.utc_datetime).getTime();
    ntpOffset = serverTime - (t0 + ((t3 - t0) / 2));
    return ntpOffset;
  }

  function getNTPTime() {
    return Date.now() + ntpOffset;
  }

  window.NTPSync = { syncNTP, getNTPTime };
})();
