import './style.css';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function showStartupError(error: unknown) {
  const message = errorMessage(error);
  console.error('[Clicker Generator] startup error', error);
  document.body.innerHTML = `<main style="display:grid;place-items:center;min-height:100vh;padding:24px;background:#eef2f7;color:#1c2738;font:14px system-ui,sans-serif"><section style="max-width:720px;padding:24px;border:1px solid #d5deea;border-radius:14px;background:#f8fafd;box-shadow:0 12px 30px rgba(37,58,91,.12)"><h1 style="margin:0 0 10px;font-size:20px">Không thể khởi động trình tạo</h1><p style="margin:0 0 8px;color:#68768b">${message.replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char] ?? char)}</p><p style="margin:0;color:#68768b">Mở Developer Console để xem chi tiết lỗi.</p></section></main>`;
}

function reportRuntimeError(error: unknown) {
  const message = errorMessage(error);
  console.error('[Clicker Generator] runtime error', error);
  const status = document.getElementById('organizerStatus');
  if (status) {
    status.textContent = `Lỗi runtime: ${message}`;
    status.setAttribute('data-runtime-error', 'true');
    return;
  }
  if (document.getElementById('flex-organizer')) return;
  showStartupError(error);
}

window.addEventListener('error', (event) => {
  if (event.error) reportRuntimeError(event.error);
});
window.addEventListener('unhandledrejection', (event) => reportRuntimeError(event.reason));

const flexKeychain = new URLSearchParams(window.location.search).get('page') === 'flex-keychain'
  || window.location.hash === '#flex-keychain';
const flexOrganizer = new URLSearchParams(window.location.search).get('page') === 'flex-organizer'
  || window.location.hash === '#flex-organizer';

if (flexOrganizer) {
  void import('./features/flexOrganizer/controller')
    .then(({ bootstrapFlexOrganizer }) => bootstrapFlexOrganizer())
    .catch(showStartupError);
} else if (flexKeychain) {
  void import('./features/flexKeychain/controller')
    .then(({ bootstrapFlexKeychain }) => bootstrapFlexKeychain())
    .catch(showStartupError);
} else {
  void import('./app/controller')
    .then(({ bootstrapApp }) => bootstrapApp())
    .catch(showStartupError);
}
