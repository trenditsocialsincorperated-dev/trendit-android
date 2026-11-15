declare global {
  interface Window {
    Tawk_API?: {
      maximize?: () => void;
      toggle?: () => void;
      showWidget?: () => void;
    };
    Tawk_LoadStart?: Date;
    __trenditTawkLoaded?: boolean;
  }
}

export function openLiveSupportChat(): void {
  if (typeof window === 'undefined') return;

  if (!window.__trenditTawkLoaded) {
    window.__trenditTawkLoaded = true;
    window.Tawk_API = window.Tawk_API || {};
    window.Tawk_LoadStart = new Date();

    const s1 = document.createElement('script');
    const s0 = document.getElementsByTagName('script')[0];
    s1.async = true;
    s1.src = 'https://embed.tawk.to/6ab54dadcf7a34343bae62dc/default';
    s1.charset = 'UTF-8';
    s1.setAttribute('crossorigin', '*');
    if (s0?.parentNode) {
      s0.parentNode.insertBefore(s1, s0);
    } else {
      document.head.appendChild(s1);
    }
  }

  if (window.Tawk_API && typeof window.Tawk_API.maximize === 'function') {
    window.Tawk_API.maximize();
    return;
  }

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    if (window.Tawk_API && typeof window.Tawk_API.maximize === 'function') {
      window.clearInterval(timer);
      window.Tawk_API.maximize();
    } else if (attempts >= 40) {
      window.clearInterval(timer);
    }
  }, 250);
}
