# Servidor local de la demo Frio Austral (sin Python). Soporta Range para videos.
param([int]$Puerto=8765)
$raiz=Split-Path -Parent $MyInvocation.MyCommand.Path
$mime=@{'.html'='text/html; charset=utf-8';'.css'='text/css';'.js'='text/javascript';'.json'='application/json';'.webp'='image/webp';'.avif'='image/avif';'.jpg'='image/jpeg';'.jpeg'='image/jpeg';'.png'='image/png';'.svg'='image/svg+xml';'.ico'='image/x-icon';'.mp4'='video/mp4';'.webm'='video/webm';'.vtt'='text/vtt';'.woff2'='font/woff2';'.pdf'='application/pdf'}
$l=$null
for($p=$Puerto;$p -lt $Puerto+20;$p++){ try{ $l=New-Object System.Net.HttpListener; $l.Prefixes.Add("http://localhost:$p/"); $l.Start(); $Puerto=$p; break }catch{ $l=$null } }
if(-not $l){ Write-Host 'No se pudo abrir un puerto.'; Read-Host 'Enter para salir'; exit 1 }
$url="http://localhost:$Puerto/"
Write-Host "Demo Frio Austral en $url - cierra esta ventana para apagarla."
Start-Process $url
while($l.IsListening){
  try{
    $c=$l.GetContext(); $q=$c.Request; $r=$c.Response
    $rel=[Uri]::UnescapeDataString($q.Url.AbsolutePath).TrimStart('/'); if($rel -eq ''){ $rel='index.html' }
    $f=[IO.Path]::GetFullPath((Join-Path $raiz $rel))
    if(-not $f.StartsWith($raiz) -or -not (Test-Path $f -PathType Leaf)){ $r.StatusCode=404; $r.Close(); continue }
    $ext=[IO.Path]::GetExtension($f).ToLower(); $r.ContentType= if($mime[$ext]){$mime[$ext]}else{'application/octet-stream'}
    $r.AddHeader('Accept-Ranges','bytes')
    $fs=[IO.File]::OpenRead($f); $len=$fs.Length; $a=0; $b=$len-1
    $rg=$q.Headers['Range']
    if($rg -and $rg -match 'bytes=(\d*)-(\d*)'){
      if($matches[1]){ $a=[int64]$matches[1] }; if($matches[2]){ $b=[Math]::Min([int64]$matches[2],$len-1) }
      $r.StatusCode=206; $r.AddHeader('Content-Range',"bytes $a-$b/$len")
    }
    $n=$b-$a+1; $r.ContentLength64=$n; $fs.Seek($a,'Begin')|Out-Null
    $buf=New-Object byte[] 65536
    try{ while($n -gt 0){ $k=$fs.Read($buf,0,[Math]::Min($buf.Length,$n)); if($k -le 0){break}; $r.OutputStream.Write($buf,0,$k); $n-=$k } }catch{}
    $fs.Close(); try{$r.Close()}catch{}
  }catch{}
}
