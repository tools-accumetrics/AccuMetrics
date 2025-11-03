from http.server import BaseHTTPRequestHandler
import json
import os

class handler(BaseHTTPRequestHandler):
    def _set_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
    
    def do_OPTIONS(self):
        self.send_response(200)
        self._set_cors_headers()
        self.end_headers()
    
    def do_GET(self):
        result = {"status": "testing", "steps": []}
        
        try:
            # Test 1: Variables de entorno
            SUPABASE_URL = os.environ.get('SUPABASE_URL')
            SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_KEY')
            
            result["steps"].append({
                "step": 1,
                "name": "Environment Variables",
                "status": "OK",
                "data": {
                    "SUPABASE_URL": SUPABASE_URL[:40] + "..." if SUPABASE_URL else None,
                    "SUPABASE_KEY_exists": bool(SUPABASE_KEY),
                    "SUPABASE_KEY_length": len(SUPABASE_KEY) if SUPABASE_KEY else 0
                }
            })
            
            # Test 2: Importar supabase
            from supabase import create_client
            result["steps"].append({
                "step": 2,
                "name": "Import supabase",
                "status": "OK"
            })
            
            # Test 3: Crear cliente básico
            try:
                client = create_client(SUPABASE_URL, SUPABASE_KEY)
                result["steps"].append({
                    "step": 3,
                    "name": "Create Supabase client",
                    "status": "OK"
                })
            except TypeError as te:
                result["steps"].append({
                    "step": 3,
                    "name": "Create Supabase client",
                    "status": "ERROR",
                    "error": str(te)
                })
                # Intentar con opciones
                try:
                    from supabase.lib.client_options import ClientOptions
                    options = ClientOptions()
                    client = create_client(SUPABASE_URL, SUPABASE_KEY, options)
                    result["steps"].append({
                        "step": 3.1,
                        "name": "Create client with ClientOptions",
                        "status": "OK"
                    })
                except Exception as e2:
                    result["steps"].append({
                        "step": 3.1,
                        "name": "Create client with ClientOptions",
                        "status": "ERROR",
                        "error": str(e2)
                    })
                    raise
            
            # Test 4: Query simple
            response = client.table('projects').select('tracking_code').limit(1).execute()
            result["steps"].append({
                "step": 4,
                "name": "Simple query",
                "status": "OK",
                "data": f"Found {len(response.data)} rows"
            })
            
            # Test 5: Query específica
            response2 = client.table('projects').select('*').eq('tracking_code', 'ad7c528c7bb4734efb065d555a90e724').execute()
            result["steps"].append({
                "step": 5,
                "name": "Specific tracking_code query",
                "status": "OK",
                "data": {
                    "found": len(response2.data) > 0,
                    "count": len(response2.data)
                }
            })
            
            if response2.data:
                result["project_found"] = {
                    "project_id": response2.data[0].get('project_id'),
                    "project_name": response2.data[0].get('project_name'),
                    "is_active": response2.data[0].get('is_active')
                }
            
            result["final_status"] = "SUCCESS"
            
        except Exception as e:
            result["final_status"] = "ERROR"
            result["error"] = {
                "message": str(e),
                "type": type(e).__name__
            }
            import traceback
            result["traceback"] = traceback.format_exc().split('\n')
        
        self.send_response(200)
        self._set_cors_headers()
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(result, indent=2).encode())
