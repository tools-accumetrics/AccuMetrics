/**
 * AccuMetrics Analytics Pixel - Multi-tenant con Eventos Personalizados
 * Versión: 2.0.0
 * 
 * Características:
 * - Auto-tracking de pageviews
 * - Eventos personalizados
 * - Tracking de e-commerce (purchase)
 * - Integración con dataLayer
 * - GDPR compliant
 * 
 * Uso básico:
 * 1. Insertar antes del cierre de </body>
 * 2. Configurar endpoint y trackingCode
 * 3. Usar API pública para eventos custom
 */

(function() {
  'use strict';

  // ============================================
  // CONFIGURACIÓN
  // ============================================
  const CONFIG = {
    endpoint: 'https://accumetrics.vercel.app/api/track', // ← CAMBIAR por tu dominio Vercel
    trackingCode: 'c803f7bce0ad46a7896967d7647eafb1', // ← IMPORTANTE: Código único del proyecto
    cookieName: '_analytics_uid',
    sessionCookieName: '_analytics_sid',
    cookieExpireDays: 730, // 2 años
    sessionTimeoutMinutes: 30,
    respectDNT: true, // Respetar Do Not Track
    debugMode: false // true para ver logs en consola
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
    // Renovar cookie de sesión (30 min de inactividad)
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
    // Añadir tracking_code
    eventData.tracking_code = CONFIG.trackingCode;
    
    // Respetar Do Not Track si está configurado
    if (CONFIG.respectDNT && isDNTEnabled()) {
      log('Tracking disabled by Do Not Track');
      return;
    }

    log('Sending event:', eventData.event_type, eventData.event_name || '');

    // Usar sendBeacon si está disponible (más confiable)
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(eventData)], { type: 'application/json' });
      const sent = navigator.sendBeacon(CONFIG.endpoint, blob);
      log('Event sent via sendBeacon:', sent);
    } else {
      // Fallback a fetch
      fetch(CONFIG.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tracking-Code': CONFIG.trackingCode
        },
        body: JSON.stringify(eventData),
        keepalive: true
      }).then(function() {
        log('Event sent via fetch');
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
    eventData.custom_params = {};
    
    log('Tracking pageview:', eventData.page_url);
    sendEvent(eventData);
  }

  // ============================================
  // TRACKING DE EVENTOS PERSONALIZADOS
  // ============================================
  
  /**
   * Trackea un evento personalizado
   * @param {string} eventName - Nombre del evento (ej: 'button_click', 'form_submit', 'funnel_step_1')
   * @param {object} params - Parámetros adicionales del evento (opcional)
   */
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
  
  /**
   * Trackea un evento de compra/purchase
   * @param {object} purchaseData - Datos del pedido
   * @param {string} purchaseData.transaction_id - ID único del pedido
   * @param {number} purchaseData.value - Valor total del pedido
   * @param {string} purchaseData.currency - Código de moneda (ej: 'EUR', 'USD')
   * @param {array} purchaseData.items - Array de productos comprados
   * @param {string} purchaseData.items[].id - ID del producto
   * @param {string} purchaseData.items[].name - Nombre del producto
   * @param {number} purchaseData.items[].quantity - Cantidad
   * @param {number} purchaseData.items[].price - Precio unitario
   */
  function trackPurchase(purchaseData) {
    if (!purchaseData || typeof purchaseData !== 'object') {
      console.error('[AccuMetrics] trackPurchase: purchaseData debe ser un objeto');
      return;
    }

    // Validar campos obligatorios
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
    
    // Datos de e-commerce en formato estructurado
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

    // Agregar campos adicionales si existen
    if (purchaseData.tax) eventData.ecommerce_data.tax = purchaseData.tax;
    if (purchaseData.shipping) eventData.ecommerce_data.shipping = purchaseData.shipping;
    if (purchaseData.coupon) eventData.ecommerce_data.coupon = purchaseData.coupon;
    
    log('Tracking purchase:', eventData.ecommerce_data);
    sendEvent(eventData);
  }

  // ============================================
  // INTEGRACIÓN CON DATALAYER
  // ============================================
  
  /**
   * Escucha eventos del dataLayer (si existe)
   * Compatible con Google Tag Manager y dataLayers personalizados
   */
  function initDataLayerListener() {
    // Verificar si existe dataLayer
    if (!window.dataLayer) {
      log('dataLayer no encontrado, listener no inicializado');
      return;
    }

    log('dataLayer encontrado, inicializando listener');

    // Guardar push original
    const originalPush = window.dataLayer.push;

    // Override del push para interceptar eventos
    window.dataLayer.push = function() {
      // Llamar al push original
      const result = originalPush.apply(this, arguments);

      // Procesar cada argumento (pueden ser múltiples)
      for (let i = 0; i < arguments.length; i++) {
        const data = arguments[i];
        
        if (data && typeof data === 'object' && data.event) {
          log('dataLayer event detected:', data.event);

          // Si es un evento de purchase
          if (data.event === 'purchase' && data.ecommerce) {
            const ecomm = data.ecommerce;
            trackPurchase({
              transaction_id: ecomm.transaction_id,
              value: ecomm.value || ecomm.revenue,
              currency: ecomm.currency,
              items: ecomm.items || [],
              tax: ecomm.tax,
              shipping: ecomm.shipping
            });
          }
          // Cualquier otro evento custom
          else if (data.event !== 'gtm.js' && data.event !== 'gtm.dom' && data.event !== 'gtm.load') {
            // Crear copia sin el campo 'event' para custom_params
            const params = Object.assign({}, data);
            delete params.event;
            
            trackEvent(data.event, params);
          }
        }
      }

      return result;
    };

    log('dataLayer listener activo');
  }

  // ============================================
  // INICIALIZACIÓN
  // ============================================
  
  function init() {
    log('Initializing AccuMetrics Pixel v2.0.0');
    log('Tracking Code:', CONFIG.trackingCode);
    log('Endpoint:', CONFIG.endpoint);

    // Esperar a que el DOM esté listo para pageview
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', trackPageview);
    } else {
      trackPageview();
    }

    // Inicializar listener de dataLayer
    initDataLayerListener();

    // Track pageviews en SPA (single page apps)
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
    // Tracking methods
    trackPageview: trackPageview,
    trackEvent: trackEvent,
    trackPurchase: trackPurchase,
    
    // Utility methods
    getUserId: getUserId,
    getSessionId: getSessionId,
    
    // Configuration
    config: CONFIG,
    
    // Version
    version: '2.0.0'
  };

  // Alias corto (opcional)
  window.am = window.AccuMetrics;

  // ============================================
  // INICIAR
  // ============================================
  
  init();

})();
