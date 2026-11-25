(function () {
  'use strict';
  const current = document.querySelector('meta[name="app-version"]').content;
  const button = document.getElementById('check-release');
  const status = document.getElementById('release-status');
  const link = document.getElementById('release-download');
  const parts = value => /^v?\d+\.\d+\.\d+$/.test(value) ? value.replace(/^v/, '').split('.').map(Number) : null;
  function newer(candidate, installed) {
    const a = parts(candidate), b = parts(installed); if (!a || !b) return false;
    for (let index = 0; index < 3; index++) { if (a[index] !== b[index]) return a[index] > b[index]; }
    return false;
  }
  window.IVORY37Updates = { newer };
  if (!button) return;
  button.onclick = async () => {
    button.disabled = true; link.hidden = true; status.textContent = 'Comprobando versiones publicadas…';
    try {
      const response = await fetch('https://api.github.com/repos/Ivory37goku/ivory37-control-laboral/releases/latest', { signal: AbortSignal.timeout(12000), headers: { Accept: 'application/vnd.github+json' } });
      if (!response.ok) throw new Error(response.status === 404 ? 'No hay una versión publicada disponible para comprobar.' : 'No se pudo consultar GitHub. Inténtalo más tarde.');
      const release = await response.json();
      if (!parts(release.tag_name) || release.draft || release.prerelease) throw new Error('La respuesta de versiones no es válida.');
      if (newer(release.tag_name, current)) {
        status.textContent = 'Versión ' + release.tag_name + ' disponible. Instálala sobre la actual para conservar tus datos; exporta antes una copia JSON.';
        link.href = 'https://github.com/Ivory37goku/ivory37-control-laboral/releases/tag/' + encodeURIComponent(release.tag_name); link.hidden = false;
      } else status.textContent = 'Instalada ' + current + '. No hay una versión publicada más reciente.';
    } catch (error) { status.textContent = error.message; }
    finally { button.disabled = false; }
  };
})();
