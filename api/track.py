"""
Analytics Pixel - Vercel Serverless Function (Multi-tenant)
Versión: 2.0.0 - Con soporte para eventos personalizados y e-commerce
Usa REST API de Supabase directamente sin SDK
"""

from http.server import BaseHTTPRequestHandler
import json
import os
import re
from datetime import datetime
from user_agents import parse
import requests

# Configuración de Supabase
SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_KEY')

# Headers para Supabase REST API
def get_supabase_headers():
    return {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
    }

# Lista de User-Agents de bots conocidos
BOT_PATTERNS = [
    r'bot', r'crawler', r'spider', r'scraper', r'slurp', r'baidu',
    r'bing', r'yandex', r'duckduck', r'teoma', r'ia_archiver',
    r'googlebot', r'bingbot', r'slurp', r'duckduckbot', r'baiduspider',
    r'yandexbot', r'facebookexternalhit', r'twitterbot', r'rogerbot',
    r'linkedinbot', r'embedly', r'quora link preview', r'showyoubot',
    r'outbrain', r'pinterest', r'developers.google.com/+/web/snippet'
]

def is_bot(user_agent: str) -> bool:
    """Detecta si el User-Agent pertenece a un bot"""
    ua_lower = user_agent.lower()
    for pattern in BOT_PATTERNS:
        if re.search(pattern, ua_lower):
            return True
    return False

def anonymize_ip(ip: str) -> str:
    """Anonimiza una dirección IP (GDPR compliant)"""
    if not ip or ip == 'unknown':
        return 'unknown'
    
    if ':' in ip:  # IPv6
        parts = ip.split(':')
        return ':'.join(parts[:4]) + ':0:0:0:0'
    else:  # IPv4
        parts = ip.split('.')
        if len(parts) == 4:
            return '.'.join(parts[:3]) + '.0'
    return 'unknown'

def parse_user_agent(ua_string: str) -> dict:
    """Parsea el User-Agent y extrae información"""
    user_agent = parse(ua_string)
    return {
        'browser': user_agent.browser.family,
        'browser_version': user_agent.browser.version_string,
        'os': user_agent.os.family,
        'os_version': user_agent.os.version_string,
        'device': user_agent.device.family,
        'is_mobile': user_agent.is_mobile,
        'is_tablet': user_agent.is_tablet,
        'is_pc': user_agent.is_pc,
        'is_bot': user_agent.is_bot
    }

def get_client_ip(headers: dict) -> str:
    """Obtiene la IP real del cliente considerando proxies de Vercel"""
    forwarded = headers.get('x-forwarded-for', '')
    if forwarded:
        return forwarded.split(',')[0].strip()
    
    real_ip = headers.get('x-real-ip', '')
    if real_ip:
        return real_ip
    
    return 'unknown'

def get_project_info(tracking_code: str) -> dict:
    """Obtiene información del proyecto desde el tracking_code usando REST API"""
    try:
        print(f"[DEBUG] Fetching project for tracking_code: {tracking_code}")
        
        url = f"{SUPABASE_URL}/rest/v1/projects"
        params = {
            'tracking_code': f'eq.{tracking_code}',
            'select': 'project_id,client_id,is_active,allowed_domains'
        }
        
        response = requests.get(url, headers=get_supabase_headers(), params=params, timeout=10)
        
        print(f"[DEBUG] Response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if data and len(data) > 0 and data[0].get('is_active'):
                print(f"[DEBUG] Project found: {data[0]['project_id']}")
                return data[0]
        
        print(f"[DEBUG] Project not found or inactive")
        return None
        
    except Exception as e:
        print(f"[ERROR] Error getting project info: {str(e)}")
        return None

def check_client_limit(client_id: str) -> bool:
    """Verifica si el cliente ha excedido su límite de eventos"""
    try:
        # Por ahora, siempre retorna True (sin límite)
        # TODO: Implementar lógica de límites si es necesario
        return True
    except Exception as e:
        print(f"[ERROR] Error checking client limit: {str(e)}")
        return True

def verify_domain(origin: str, allowed_domains: list) -> bool:
    """Verifica si el origen está en la lista de dominios permitidos"""
    if not allowed_domains:
        return True
    
    from urllib.parse import urlparse
    origin_domain = urlparse(origin).netloc if origin else ''
    
    for domain in allowed_domains:
        if domain == '*' or domain in origin_domain or origin_domain in domain:
            return True
    
    return False

def validate_ecommerce_data(ecommerce_data: dict) -> tuple:
    """
    Valida los datos de e-commerce
    Retorna (is_valid, error_message)
    """
    if not ecommerce_data:
        return True, None
    
    # Validar campos obligatorios para purchase
    if not ecommerce_data.get('transaction_id'):
        return False, "ecommerce_data.transaction_id is required"
    
    if 'value' not in ecommerce_data:
        return False, "ecommerce_data.value is required"
    
    try:
        value = float(ecommerce_data['value'])
        if value < 0:
            return False, "ecommerce_data.value must be >= 0"
    except (ValueError, TypeError):
        return False, "ecommerce_data.value must be a number"
    
    # Validar items si existe
    if 'items' in ecommerce_data:
        if not isinstance(ecommerce_data['items'], list):
            return False, "ecommerce_data.items must be an array"
        
        for idx, item in enumerate(ecommerce_data['items']):
            if not isinstance(item, dict):
                return False, f"ecommerce_data.items[{idx}] must be an object"
            
            # Validar campos del item
            if 'price' in item:
                try:
                    float(item['price'])
                except (ValueError, TypeError):
                    return False, f"ecommerce_data.items[{idx}].price must be a number"
            
            if 'quantity' in item:
                try:
                    int(item['quantity'])
                except (ValueError, TypeError):
                    return False, f"ecommerce_data.items[{idx}].quantity must be an integer"
    
    return True, None

def insert_event(event_data: dict) -> bool:
    """Inserta evento en Supabase usando REST API"""
    try:
        print(f"[DEBUG] Inserting event: {event_data['event_id']}")
        
        url = f"{SUPABASE_URL}/rest/v1/events_raw"
        
        response = requests.post(
            url, 
            headers=get_supabase_headers(), 
            json=event_data,
            timeout=10
        )
        
        print(f"[DEBUG] Insert response status: {response.status_code}")
        
        if response.status_code in [200, 201]:
            print(f"[DEBUG] Event inserted successfully")
            return True
        else:
            print(f"[ERROR] Insert failed: {response.text}")
            return False
            
    except Exception as e:
        print(f"[ERROR] Error inserting event: {str(e)}")
        return False

class handler(BaseHTTPRequestHandler):
    """Handler principal para Vercel Serverless Function"""
    
    def _set_cors_headers(self):
        """Establece headers CORS"""
        origin = self.headers.get('Origin', '*')
        
        # Permitir 'null' para testing desde file://
        if origin == 'null' or not origin:
            self.send_header('Access-Control-Allow-Origin', '*')
        else:
            # Para dominios reales, enviar el origen específico y permitir credenciales
            self.send_header('Access-Control-Allow-Origin', origin)
            self.send_header('Access-Control-Allow-Credentials', 'true')
        
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS, GET')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-Tracking-Code')
        self.send_header('Access-Control-Max-Age', '86400')
    
    def do_OPTIONS(self):
        """Maneja preflight CORS requests"""
        print("[INFO] OPTIONS request received")
        self.send_response(200)
        self._set_cors_headers()
        self.end_headers()
    
    def do_GET(self):
        """Maneja GET requests - solo para testing"""
        print("[INFO] GET request received")
        self.send_response(200)
        self._set_cors_headers()
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        response = {
            "status": "ok",
            "message": "AccuMetrics API v2.0.0 - Custom Events & E-commerce",
            "endpoint": "/api/track",
            "methods": ["POST", "OPTIONS"],
            "features": [
                "pageview tracking",
                "custom events",
                "e-commerce (purchase)",
                "dataLayer integration"
            ]
        }
        self.wfile.write(json.dumps(response).encode('utf-8'))
    
    def do_POST(self):
        """Procesa evento de tracking"""
        print("[INFO] POST request received")
        try:
            # Obtener tracking_code del header o del body
            tracking_code = self.headers.get('X-Tracking-Code')
            
            # Leer body
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            event_data = json.loads(body.decode('utf-8'))
            
            # Si no está en el header, buscar en el body
            if not tracking_code:
                tracking_code = event_data.get('tracking_code')
            
            if not tracking_code:
                self.send_error_response(400, "Missing tracking_code")
                return
            
            print(f"[INFO] Tracking code: {tracking_code}")
            
            # Obtener información del proyecto
            project_info = get_project_info(tracking_code)
            
            if not project_info:
                self.send_error_response(401, "Invalid tracking_code or inactive project")
                return
            
            project_id = project_info['project_id']
            client_id = project_info['client_id']
            allowed_domains = project_info.get('allowed_domains', [])
            
            print(f"[INFO] Project ID: {project_id}, Client ID: {client_id}")
            
            # Verificar origen si hay restricciones de dominio
            origin = self.headers.get('Origin', '')
            if allowed_domains and not verify_domain(origin, allowed_domains):
                self.send_error_response(403, "Domain not allowed")
                return
            
            # Verificar límite de eventos del cliente
            if not check_client_limit(client_id):
                self.send_error_response(429, "Monthly event limit exceeded")
                return
            
            # Validar campos obligatorios
            required_fields = ['event_id', 'timestamp', 'user_id', 'session_id', 
                             'event_type', 'page_url', 'user_agent']
            
            for field in required_fields:
                if field not in event_data:
                    self.send_error_response(400, f"Missing required field: {field}")
                    return
            
            # Validar event_type
            valid_event_types = ['pageview', 'event']
            if event_data['event_type'] not in valid_event_types:
                self.send_error_response(400, f"Invalid event_type. Must be one of: {valid_event_types}")
                return
            
            # Si es un evento custom, validar event_name
            if event_data['event_type'] == 'event':
                if not event_data.get('event_name'):
                    self.send_error_response(400, "event_name is required for event_type='event'")
                    return
                
                print(f"[INFO] Custom event: {event_data['event_name']}")
            
            # Validar datos de e-commerce si existen
            ecommerce_data = event_data.get('ecommerce_data')
            if ecommerce_data:
                is_valid, error_msg = validate_ecommerce_data(ecommerce_data)
                if not is_valid:
                    self.send_error_response(400, f"Invalid ecommerce_data: {error_msg}")
                    return
                print(f"[INFO] E-commerce event: {ecommerce_data.get('transaction_id')}")
            
            # Obtener IP del cliente
            headers_dict = dict(self.headers)
            client_ip = get_client_ip(headers_dict)
            anonymized_ip = anonymize_ip(client_ip)
            
            # Parsear User-Agent
            ua_data = parse_user_agent(event_data['user_agent'])
            
            # Detectar bot
            is_bot_detected = is_bot(event_data['user_agent']) or ua_data.get('is_bot', False)
            
            # Construir registro enriquecido
            enriched_data = {
                'event_id': event_data['event_id'],
                'project_id': project_id,
                'client_id': client_id,
                'timestamp': event_data['timestamp'],
                'user_id': event_data['user_id'],
                'session_id': event_data['session_id'],
                'event_type': event_data['event_type'],
                'event_name': event_data.get('event_name'),  # Nuevo campo
                'page_url': event_data['page_url'],
                'page_title': event_data.get('page_title', ''),
                'referrer': event_data.get('referrer', ''),
                'user_agent': event_data['user_agent'],
                'ip_address': anonymized_ip,
                'device_type': event_data.get('device_type') or ua_data.get('device', 'unknown'),
                'browser': event_data.get('browser') or ua_data.get('browser', 'unknown'),
                'browser_version': ua_data.get('browser_version', ''),
                'os': event_data.get('os') or ua_data.get('os', 'unknown'),
                'os_version': ua_data.get('os_version', ''),
                'is_mobile': ua_data.get('is_mobile', False),
                'is_tablet': ua_data.get('is_tablet', False),
                'is_bot': is_bot_detected,
                'screen_resolution': event_data.get('screen_resolution'),
                'viewport_size': event_data.get('viewport_size'),
                'language': event_data.get('language'),
                'timezone': event_data.get('timezone'),
                'custom_params': event_data.get('custom_params', {}),
                'ecommerce_data': ecommerce_data,  # Nuevo campo
                'processed_at': datetime.utcnow().isoformat()
            }
            
            # Insertar en Supabase
            success = insert_event(enriched_data)
            
            if not success:
                self.send_error_response(500, "Failed to insert event")
                return
            
            print(f"[INFO] Event processed successfully")
            
            # Responder con éxito
            self.send_response(204)
            self._set_cors_headers()
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Expires', '0')
            self.end_headers()
            
        except json.JSONDecodeError:
            print("[ERROR] JSON decode error")
            self.send_error_response(400, "Invalid JSON")
        except Exception as e:
            print(f"[ERROR] Exception: {str(e)}")
            import traceback
            print(f"[ERROR] Traceback: {traceback.format_exc()}")
            self.send_error_response(500, f"Internal server error")
    
    def send_error_response(self, code: int, message: str):
        """Envía respuesta de error"""
        print(f"[ERROR] {code} - {message}")
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self._set_cors_headers()
        self.end_headers()
        self.wfile.write(json.dumps({"error": message}).encode('utf-8'))
