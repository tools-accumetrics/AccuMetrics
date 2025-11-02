/**
 * Analytics Pixel - Cliente JavaScript
 * Versión: 1.0.0
 * Uso: Insertar antes del cierre de </body>
 */

(function() {
  'use strict';

  // Configuración
  const CONFIG = {
    endpoint: 'https://tu-proyecto.vercel.app/api/track', // Cambiar por tu dominio Vercel
    trackingCode: 'YOUR-TRACKING-CODE-HERE', // ← IMPORTANTE: Código único del proyecto
    cookieName: '_analytics_uid',
    sessionCookieName: '_analytics_sid',
    cookieExpireDays: 730, // 2 años
    sessionTimeoutMinutes: 30,
    respectDNT: true // Respetar Do Not Track
  };

  // Utilidades para cookies
  const CookieUtil = {
    set: function(name, value, days) {
      const d = new Date();
      d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
      const expires = 'expires=' + d.toUTCString();
      document.cookie = name + '=' + value + ';' + expires + ';path=/;SameSite=Lax';
    },
    
    get: function(name) {
      const nameEQ = name + '=';
      const ca = document.cookie.split(';');
      for(let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
      }
      return null;
    }
  };

  // Generar UUID v4
  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Obtener o crear User ID
  function getUserId() {
    let userId = CookieUtil.get(CONFIG.cookieName);
    if (!userId) {
      userId = generateUUID();
      CookieUtil.set(CONFIG.cookieName, userId, CONFIG.cookieExpireDays);
    }
    return userId;
  }

  // Obtener o crear Session ID
  function getSessionId() {
    let sessionId = CookieUtil.get(CONFIG.sessionCookieName);
    if (!sessionId) {
      sessionId = generateUUID();
    }
    // Renovar cookie de sesión (30 min de inactividad)
    CookieUtil.set(CONFIG.sessionCookieName, sessionId, CONFIG.sessionTimeoutMinutes / (24 * 60));
    return sessionId;
  }

  // Detectar tipo de dispositivo
  function getDeviceType() {
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
      return 'tablet';
    }
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
      return 'mobile';
    }
    return 'desktop';
  }

  // Obtener información del navegador
  function getBrowserInfo() {
    const ua = navigator.userAgent;
    let browser = 'Unknown';
    
    if (ua.indexOf('Firefox') > -1) browser = 'Firefox';
    else if (ua.indexOf('SamsungBrowser') > -1) browser = 'Samsung';
    else if (ua.indexOf('Opera') > -1 || ua.indexOf('OPR') > -1) browser = 'Opera';
    else if (ua.indexOf('Trident') > -1) browser = 'IE';
    else if (ua.indexOf('Edge') > -1) browser = 'Edge';
    else if (ua.indexOf('Chrome') > -1) browser = 'Chrome';
    else if (ua.indexOf('Safari') > -1) browser = 'Safari';
    
    return browser;
  }

  // Obtener sistema operativo
  function getOS() {
    const ua = navigator.userAgent;
    if (ua.indexOf('Win') > -1) return 'Windows';
    if (ua.indexOf('Mac') > -1) return 'MacOS';
    if (ua.indexOf('Linux') > -1) return 'Linux';
    if (ua.indexOf('Android') > -1) return 'Android';
    if (ua.indexOf('iOS') > -1 || ua.indexOf('iPhone') > -1 || ua.indexOf('iPad') > -1) return 'iOS';
    return 'Unknown';
  }

  // Verificar Do Not Track
  function isDNTEnabled() {
    return navigator.doNotTrack === '1' || 
           window.doNotTrack === '1' || 
           navigator.msDoNotTrack === '1';
  }

  // Enviar evento al servidor
  function sendEvent(eventData) {
    // CRÍTICO: Añadir tracking_code al evento
    eventData.tracking_code = CONFIG.trackingCode;
    
    // Respetar Do Not Track si está configurado
    if (CONFIG.respectDNT && isDNTEnabled()) {
      console.log('[Analytics] Tracking deshabilitado por Do Not Track');
      return;
    }

    // Usar sendBeacon si está disponible (más confiable)
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(eventData)], { type: 'application/json' });
      navigator.sendBeacon(CONFIG.endpoint, blob);
    } else {
      // Fallback a fetch
      fetch(CONFIG.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tracking-Code': CONFIG.trackingCode // También en header
        },
        body: JSON.stringify(eventData),
        keepalive: true // Importante para eventos al cerrar página
      }).catch(function(error) {
        console.error('[Analytics] Error:', error);
      });
    }
  }

  // Recolectar datos del pageview
  function trackPageview() {
    const eventData = {
      event_id: generateUUID(),
      timestamp: new Date().toISOString(),
      user_id: getUserId(),
      session_id: getSessionId(),
      event_type: 'pageview',
      page_url: window.location.href,
      page_title: document.title || '',
      referrer: document.referrer || '',
      user_agent: navigator.userAgent,
      device_type: getDeviceType(),
      browser: getBrowserInfo(),
      os: getOS(),
      screen_resolution: screen.width + 'x' + screen.height,
      viewport_size: window.innerWidth + 'x' + window.innerHeight,
      language: navigator.language || navigator.userLanguage,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      // Datos adicionales
      custom_params: {}
    };

    sendEvent(eventData);
  }

  // Inicializar tracking
  function init() {
    // Esperar a que el DOM esté listo
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', trackPageview);
    } else {
      trackPageview();
    }

    // Track pageviews en SPA (single page apps)
    let lastUrl = location.href;
    new MutationObserver(function() {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        trackPageview();
      }
    }).observe(document, { subtree: true, childList: true });
  }

  // API pública (opcional)
  window.analyticsPixel = {
    track: trackPageview,
    getUserId: getUserId,
    getSessionId: getSessionId
  };

  // Iniciar
  init();

})();