/**
 * AccuMetrics Analytics Pixel
 * Proyecto: Seguro Por Días
 * Dominio: seguropordias.com
 */
(function() {
  'use strict';
  
  const CONFIG = {
    endpoint: 'https://accumetrics.vercel.app/api/track',
    trackingCode: 'c803f7bce0ad46a7896967d7647eafb1', // ← Pegar tracking_code aquí
    cookieName: '_accumetrics_uid',
    sessionCookieName: '_accumetrics_sid',
    cookieExpireDays: 730,
    sessionTimeoutMinutes: 30,
    respectDNT: true
  };

  const CookieUtil = {
    set: function(name, value, days) {
      const d = new Date();
      d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
      document.cookie = name + '=' + value + ';expires=' + d.toUTCString() + ';path=/;SameSite=Lax;Secure';
    },
    get: function(name) {
      const nameEQ = name + '=';
      const ca = document.cookie.split(';');
      for(let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1);
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length);
      }
      return null;
    }
  };

  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function getUserId() {
    let userId = CookieUtil.get(CONFIG.cookieName);
    if (!userId) {
      userId = generateUUID();
      CookieUtil.set(CONFIG.cookieName, userId, CONFIG.cookieExpireDays);
    }
    return userId;
  }

  function getSessionId() {
    let sessionId = CookieUtil.get(CONFIG.sessionCookieName);
    if (!sessionId) sessionId = generateUUID();
    CookieUtil.set(CONFIG.sessionCookieName, sessionId, CONFIG.sessionTimeoutMinutes / (24 * 60));
    return sessionId;
  }

  function getDeviceType() {
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) return 'tablet';
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry/i.test(ua)) return 'mobile';
    return 'desktop';
  }

  function getBrowser() {
    const ua = navigator.userAgent;
    if (ua.indexOf('Firefox') > -1) return 'Firefox';
    if (ua.indexOf('SamsungBrowser') > -1) return 'Samsung';
    if (ua.indexOf('Opera') > -1 || ua.indexOf('OPR') > -1) return 'Opera';
    if (ua.indexOf('Edge') > -1) return 'Edge';
    if (ua.indexOf('Chrome') > -1) return 'Chrome';
    if (ua.indexOf('Safari') > -1) return 'Safari';
    return 'Other';
  }

  function getOS() {
    const ua = navigator.userAgent;
    if (ua.indexOf('Win') > -1) return 'Windows';
    if (ua.indexOf('Mac') > -1) return 'MacOS';
    if (ua.indexOf('Linux') > -1) return 'Linux';
    if (ua.indexOf('Android') > -1) return 'Android';
    if (ua.indexOf('iOS') > -1 || ua.indexOf('iPhone') > -1 || ua.indexOf('iPad') > -1) return 'iOS';
    return 'Other';
  }

  function sendEvent(data) {
    data.tracking_code = CONFIG.trackingCode;
    
    if (CONFIG.respectDNT && (navigator.doNotTrack === '1' || window.doNotTrack === '1')) {
      return;
    }
    
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(data)], {type: 'application/json'});
      navigator.sendBeacon(CONFIG.endpoint, blob);
    } else {
      fetch(CONFIG.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tracking-Code': CONFIG.trackingCode
        },
        body: JSON.stringify(data),
        keepalive: true
      }).catch(function(){});
    }
  }

  function trackPageview() {
    sendEvent({
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
      browser: getBrowser(),
      os: getOS(),
      screen_resolution: screen.width + 'x' + screen.height,
      viewport_size: window.innerWidth + 'x' + window.innerHeight,
      language: navigator.language || navigator.userLanguage,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      custom_params: {}
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', trackPageview);
  } else {
    trackPageview();
  }

  // API pública (opcional)
  window.AccuMetrics = {
    track: trackPageview,
    getUserId: getUserId,
    getSessionId: getSessionId
  };
})();
