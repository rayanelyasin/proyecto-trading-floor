# Servidor estático mínimo para probar Pulso en local: http://localhost:5173
param([int]$Port = 5173, [switch]$OpenBrowser)
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$listener = New-Object System.Net.HttpListener
$url = "http://localhost:$Port/"
$listener.Prefixes.Add($url)
try {
  $listener.Start()
} catch {
  Write-Error "No se pudo abrir Pulso en el puerto $Port. Cierra el servidor anterior si sigue abierto. $($_.Exception.Message)"
  exit 1
}
Write-Host "Pulso en $url"
if ($OpenBrowser) { Start-Process $url }
$types = @{
  '.html'='text/html; charset=utf-8'; '.js'='text/javascript; charset=utf-8'; '.css'='text/css; charset=utf-8'
  '.svg'='image/svg+xml'; '.png'='image/png'; '.jpg'='image/jpeg'; '.webp'='image/webp'
  '.glb'='model/gltf-binary'; '.json'='application/json'; '.ico'='image/x-icon'; '.mp4'='video/mp4'
}
while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  try {
    $handled = $false
    if ($ctx.Request.HttpMethod -eq 'POST' -and $ctx.Request.Url.AbsolutePath -eq '/__save') {
      # Guardado local de archivos convertidos (solo dentro de /assets, solo en localhost)
      $dest = [IO.Path]::GetFullPath((Join-Path $root $ctx.Request.QueryString['path']))
      if ($dest.StartsWith((Join-Path $root 'assets'))) {
        New-Item -ItemType Directory -Force (Split-Path $dest) | Out-Null
        $fs = [IO.File]::Create($dest); $ctx.Request.InputStream.CopyTo($fs); $fs.Close()
        $bytes = [Text.Encoding]::UTF8.GetBytes('ok')
      } else { $ctx.Response.StatusCode = 403; $bytes = [Text.Encoding]::UTF8.GetBytes('no') }
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
      $handled = $true
    }
    if ($ctx.Request.Url.AbsolutePath -eq '/__campus') {
      # Lugares del campus que crea el dueño (se guardan en data/campus.json)
      $cf = Join-Path $root 'datacampus.json'
      $ctx.Response.Headers.Add('Cache-Control', 'no-store')
      if ($ctx.Request.HttpMethod -eq 'POST') {
        $raw = (New-Object IO.StreamReader($ctx.Request.InputStream, [Text.Encoding]::UTF8)).ReadToEnd()
        try {
          $j = $raw | ConvertFrom-Json
          if ($null -ne $j.places -and $raw.Length -lt 300000) { New-Item -ItemType Directory -Force (Split-Path $cf) | Out-Null; [IO.File]::WriteAllText($cf, $raw); $bytes = [Text.Encoding]::UTF8.GetBytes('ok') }
          else { $ctx.Response.StatusCode = 400; $bytes = [Text.Encoding]::UTF8.GetBytes('datos no validos') }
        } catch { $ctx.Response.StatusCode = 400; $bytes = [Text.Encoding]::UTF8.GetBytes('datos no validos') }
      } else {
        $ctx.Response.ContentType = 'application/json'
        $txt = if (Test-Path $cf) { [IO.File]::ReadAllText($cf) } else { '{"places":[]}' }
        $bytes = [Text.Encoding]::UTF8.GetBytes($txt)
      }
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
      $handled = $true
    }
    if (-not $handled) {
    $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
    if ($path -eq '') { $path = 'index.html' }
    $file = [IO.Path]::GetFullPath((Join-Path $root $path))
    if (-not $file.StartsWith($root) -or -not (Test-Path $file -PathType Leaf)) {
      $ctx.Response.StatusCode = 404
      $bytes = [Text.Encoding]::UTF8.GetBytes('404')
    } else {
      $ext = [IO.Path]::GetExtension($file).ToLower()
      $ctx.Response.ContentType = $(if ($types[$ext]) { $types[$ext] } else { 'application/octet-stream' })
      $ctx.Response.Headers.Add('Cache-Control', 'no-store')
      $bytes = [IO.File]::ReadAllBytes($file)
    }
    $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    }
  } catch { } finally { $ctx.Response.Close() }
}
