/**
 * AccuMetrics Analytics Pixel v2.0 - Multi-tenant
 * VERSIÓN ACTUALIZADA: Sin captura automática de dataLayer
 * 
 * Cambios en esta versión:
 * - event_name = 'pageview' en pageviews (no null)
 * - Listener de dataLayer DESACTIVADO
 * - Solo eventos manuales: AccuMetrics.trackEvent() y AccuMetrics.trackPurchase()
 */

(function() {
  'use strict';

  // ============================================
  // CONFIGURACIÓN
  // ============================================
  const CONFIG = {
    endpoint: 'https://accumetrics.vercel.app/api/track',
    trackingCode: 'c803f7bce0ad46a7896967d7647eafb1',
    cookieName: '_analytics_uid',
    sessionCookieName: '_analytics_sid',
    cookieExpireDays: 730,
    sessionTimeoutMinutes: 30,
    respectDNT: true,
    debugMode: false
  };

  // ============================================
  // UTILIDADES PARA COOKIES
  // ============================================
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

  // ============================================
  // UTILIDADES
  // ============================================
  
  function log() {
    if (CONFIG.debugMode && window.console) {
      console.log('[AccuMetrics]', ...arguments);
    }
  }

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
      log('New user ID created:', userId);
    }
    return userId;
  }

  function getSessionId() {
    let sessionId = CookieUtil.get(CONFIG.sessionCookieName);
    if (!sessionId) {
      sessionId = generateUUID();
      log('New session ID created:', sessionId);
    }
    CookieUtil.set(CONFIG.sessionCookieName, sessionId, CONFIG.sessionTimeoutMinutes / (24 * 60));
    return sessionId;
  }

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

  function getOS() {
    const ua = navigator.userAgent;
    if (ua.indexOf('Win') > -1) return 'Windows';
    if (ua.indexOf('Mac') > -1) return 'MacOS';
    if (ua.indexOf('Linux') > -1) return 'Linux';
    if (ua.indexOf('Android') > -1) return 'Android';
    if (ua.indexOf('iOS') > -1 || ua.indexOf('iPhone') > -1 || ua.indexOf('iPad') > -1) return 'iOS';
    return 'Unknown';
  }

  function isDNTEnabled() {
    return navigator.doNotTrack === '1' || 
           window.doNotTrack === '1' || 
           navigator.msDoNotTrack === '1';
  }

  // ============================================
  // ENVÍO DE EVENTOS
  // ============================================
  
  function sendEvent(eventData) {
    eventData.tracking_code = CONFIG.trackingCode;
    
    if (CONFIG.respectDNT && isDNTEnabled()) {
      log('Tracking disabled by Do Not Track');
      return;
    }

    log('Sending event:', eventData.event_type, eventData.event_name || '');

    if (navigator.sendBeacon && window.location.protocol !== 'file:') {
      const blob = new Blob([JSON.stringify(eventData)], { type: 'application/json' });
      const sent = navigator.sendBeacon(CONFIG.endpoint, blob);
      log('Event sent via sendBeacon:', sent);
    } else {
      fetch(CONFIG.endpoint, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
          'X-Tracking-Code': CONFIG.trackingCode
        },
        body: JSON.stringify(eventData),
        keepalive: true
      }).then(function(response) {
        if (response.ok || response.status === 204) {
          log('Event sent successfully via fetch');
        }
      }).catch(function(error) {
        console.error('[AccuMetrics] Error:', error);
      });
    }
  }

  // ============================================
  // RECOLECCIÓN DE DATOS BASE
  // ============================================
  
  function getBaseEventData() {
    return {
      event_id: generateUUID(),
      timestamp: new Date().toISOString(),
      user_id: getUserId(),
      session_id: getSessionId(),
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
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };
  }

  // ============================================
  // TRACKING DE PAGEVIEWS
  // ============================================
  
  function trackPageview() {
    const eventData = getBaseEventData();
    eventData.event_type = 'pageview';
    eventData.event_name = 'pageview';  // ACTUALIZADO: Ya no null
    eventData.custom_params = {};
    
    log('Tracking pageview:', eventData.page_url);
    sendEvent(eventData);
  }

  // ============================================
  // TRACKING DE EVENTOS PERSONALIZADOS
  // ============================================
  
  function trackEvent(eventName, params) {
    if (!eventName || typeof eventName !== 'string') {
      console.error('[AccuMetrics] trackEvent: eventName debe ser un string');
      return;
    }

    const eventData = getBaseEventData();
    eventData.event_type = 'event';
    eventData.event_name = eventName;
    eventData.custom_params = params || {};
    
    log('Tracking custom event:', eventName, params);
    sendEvent(eventData);
  }

  // ============================================
  // TRACKING DE E-COMMERCE (PURCHASE)
  // ============================================
  
  function trackPurchase(purchaseData) {
    if (!purchaseData || typeof purchaseData !== 'object') {
      console.error('[AccuMetrics] trackPurchase: purchaseData debe ser un objeto');
      return;
    }

    if (!purchaseData.transaction_id) {
      console.error('[AccuMetrics] trackPurchase: transaction_id es obligatorio');
      return;
    }

    if (typeof purchaseData.value !== 'number') {
      console.error('[AccuMetrics] trackPurchase: value debe ser un número');
      return;
    }

    if (!Array.isArray(purchaseData.items)) {
      console.error('[AccuMetrics] trackPurchase: items debe ser un array');
      return;
    }

    const eventData = getBaseEventData();
    eventData.event_type = 'event';
    eventData.event_name = 'purchase';
    eventData.custom_params = {};
    
    eventData.ecommerce_data = {
      transaction_id: purchaseData.transaction_id,
      value: purchaseData.value,
      currency: purchaseData.currency || 'EUR',
      items: purchaseData.items.map(function(item) {
        return {
          id: item.id || '',
          name: item.name || '',
          quantity: item.quantity || 1,
          price: item.price || 0
        };
      })
    };

    if (purchaseData.tax) eventData.ecommerce_data.tax = purchaseData.tax;
    if (purchaseData.shipping) eventData.ecommerce_data.shipping = purchaseData.shipping;
    if (purchaseData.coupon) eventData.ecommerce_data.coupon = purchaseData.coupon;
    
    log('Tracking purchase:', eventData.ecommerce_data);
    sendEvent(eventData);
  }

  // ============================================
  // INTEGRACIÓN CON DATALAYER - DESACTIVADO
  // ============================================
  
  function initDataLayerListener() {
    // ============================================
    // LISTENER DE DATALAYER DESACTIVADO
    // ============================================
    // El píxel NO captura eventos del dataLayer automáticamente.
    // Esto evita capturar eventos no deseados como cookie_consent_*
    // 
    // Para trackear eventos, usa la API manual:
    //   AccuMetrics.trackEvent('nombre_evento', params)
    //   AccuMetrics.trackPurchase(purchaseData)
    
    log('dataLayer listener DESACTIVADO - usar API manual');
    return;
  }

  // ============================================
  // INICIALIZACIÓN
  // ============================================
  
  function init() {
    log('Initializing AccuMetrics Pixel v2.0.1');
    log('Tracking Code:', CONFIG.trackingCode);
    log('Endpoint:', CONFIG.endpoint);

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', trackPageview);
    } else {
      trackPageview();
    }

    initDataLayerListener();

    let lastUrl = location.href;
    new MutationObserver(function() {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        log('URL changed, tracking new pageview');
        trackPageview();
      }
    }).observe(document, { subtree: true, childList: true });

    log('AccuMetrics Pixel initialized successfully');
  }

  // ============================================
  // API PÚBLICA
  // ============================================
  
  window.AccuMetrics = {
    trackPageview: trackPageview,
    trackEvent: trackEvent,
    trackPurchase: trackPurchase,
    getUserId: getUserId,
    getSessionId: getSessionId,
    config: CONFIG,
    version: '2.0.1'
  };

  window.am = window.AccuMetrics;

  // ============================================
  // INICIAR
  // ============================================
  
  init();

})();
