import http.server,os,re,sys
class H(http.server.SimpleHTTPRequestHandler):
    def send_head(self):
        rg=self.headers.get('Range');path=self.translate_path(self.path)
        if not rg or not os.path.isfile(path): return super().send_head()
        m=re.match(r'bytes=(\d*)-(\d*)',rg);size=os.path.getsize(path)
        a=int(m.group(1) or 0);b=int(m.group(2)) if m.group(2) else size-1;b=min(b,size-1)
        f=open(path,'rb');f.seek(a);self.send_response(206)
        self.send_header('Content-Type',self.guess_type(path));self.send_header('Accept-Ranges','bytes')
        self.send_header('Content-Range',f'bytes {a}-{b}/{size}');self.send_header('Content-Length',str(b-a+1));self.end_headers()
        self._left=b-a+1;return f
    def copyfile(self,src,dst):
        n=getattr(self,'_left',None)
        if n is None: return super().copyfile(src,dst)
        while n>0:
            c=src.read(min(65536,n))
            if not c:break
            try: dst.write(c)
            except (BrokenPipeError,ConnectionResetError): break
            n-=len(c)
    def log_message(self,*a):pass
os.chdir(sys.argv[2]);http.server.ThreadingHTTPServer(('',int(sys.argv[1])),H).serve_forever()
