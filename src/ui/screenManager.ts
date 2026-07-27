import { gsap } from 'gsap';

export function setupScreens() {
  const dashboardScreen = document.getElementById('dashboard-screen');
  const toolScreen = document.getElementById('tool-screen');
  const shadowBoxScreen = document.getElementById('shadowbox-screen');
  
  const btnOpenClicker = document.getElementById('btn-open-clicker');
  const btnOpenShadowBox = document.getElementById('btn-open-shadowbox');

  // Animation vào Dashboard khi mới load trang
  if (dashboardScreen) {
    gsap.from('.dashboard-header', { y: -20, opacity: 0, duration: 0.6, ease: 'power2.out' });
    gsap.from('.tool-card', { y: 30, opacity: 0, duration: 0.6, stagger: 0.15, ease: 'power2.out', delay: 0.2 });
  }

  // Hàm chuyển cảnh
  function openScreen(targetScreen: HTMLElement | null) {
    if (!dashboardScreen) {
      console.error("🚨 LỖI: Không tìm thấy <section id='dashboard-screen'> trong index.html");
      return;
    }
    if (!targetScreen) {
      console.error("🚨 LỖI: Không tìm thấy màn hình đích trong index.html! Hãy chắc chắn bạn đã paste đoạn <section id='shadowbox-screen'>...</section> vào file HTML.");
      return;
    }

    const tl = gsap.timeline();
    
    tl.to(dashboardScreen, {
      opacity: 0, y: -20, duration: 0.35, ease: 'power2.in',
      onComplete: () => {
        dashboardScreen.style.display = 'none';
        targetScreen.style.display = 'block';
      }
    }).to(targetScreen, {
      opacity: 1, y: 0, duration: 0.45, ease: 'power2.out',
      onComplete: () => window.dispatchEvent(new Event('resize'))
    });
  }

  // Lắng nghe sự kiện click
  if (btnOpenClicker) {
    btnOpenClicker.addEventListener('click', () => openScreen(toolScreen));
  } else {
    console.error("🚨 LỖI: Không tìm thấy nút có id='btn-open-clicker'");
  }

  if (btnOpenShadowBox) {
    btnOpenShadowBox.addEventListener('click', () => openScreen(shadowBoxScreen));
  } else {
    console.error("🚨 LỖI: Không tìm thấy nút có id='btn-open-shadowbox'");
  }

  // Trả về các đối tượng để các Tool sử dụng
  return {
    toolScreen,
    shadowBoxScreen,
    backToDashboard: (currentScreen: HTMLElement) => {
      if (!dashboardScreen || !currentScreen) return;
      const tl = gsap.timeline();
      tl.to(currentScreen, {
        opacity: 0, duration: 0.3, ease: 'power2.in',
        onComplete: () => {
          currentScreen.style.display = 'none';
          dashboardScreen.style.display = 'flex';
        }
      }).to(dashboardScreen, {
        opacity: 1, y: 0, duration: 0.4, ease: 'power2.out'
      });
    }
  };
}