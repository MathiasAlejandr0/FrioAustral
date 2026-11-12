# Servidor local de la demo Frío Austral (soporta Range para videos). Uso: python servidor_demo.py [puerto]
import http.server,os,re,sys,socket,webbrowser,threading
os.chdir(os.path.dirname(os.path.abspath(__file__)))
class H(http.server.SimpleHTTPRequestHandler):
    extensions_map={**http.server.SimpleHTTPRequestHandler.extensions_map,'.webp':'image/webp','.avif':'image/avif','.mp4':'video/mp4','.webm':'video/webm','.vtt':'text/vtt','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2','.json':'application/json'}
    def send_head(self):
        self._left=None
        rg=self.headers.get('Range');path=self.translate_path(self.path)
        if not rg or not os.path.isfile(path): return super().send_head()
        m=re.match(r'bytes=(\d*)-(\d*)',rg);size=os.path.getsize(path)
        if not m: return super().send_head()
        a=int(m.group(1) or 0);b=int(m.group(2)) if m.group(2) else size-1;b=min(b,size-1)
        f=open(path,'rb');f.seek(a);self.send_response(206)
        self.send_header('Content-Type',self.guess_type(path));self.send_header('Accept-Ranges','bytes')
        self.send_header('Content-Range',f'bytes {a}-{b}/{size}');self.send_header('Content-Length',str(b-a+1));self.end_headers()
        self._left=b-a+1;return f
    def copyfile(self,src,dst):
        n=self._left
        if n is None:
            try: return super().copyfile(src,dst)
            except (BrokenPipeError,ConnectionResetError,ConnectionAbortedError): return
        while n>0:
            c=src.read(min(65536,n))
            if not c:break
            try: dst.write(c)
            except (BrokenPipeError,ConnectionResetError,ConnectionAbortedError): break
            n-=len(c)
    def log_message(self,*a):pass
def libre(p):
    for q in range(p,p+20):
        s=socket.socket()
        try: s.bind(('127.0.0.1',q)); s.close(); return q
        except OSError: s.close()
    return 0
p=libre(int(sys.argv[1]) if len(sys.argv)>1 else 8765)
srv=http.server.ThreadingHTTPServer(('127.0.0.1',p),H)
url=f'http://localhost:{p}/'
print('Demo Frio Austral en',url,'- cierra esta ventana para apagarla.')
if '--no-browser' not in sys.argv: threading.Timer(1,lambda:webbrowser.open(url)).start()
srv.serve_forever()
