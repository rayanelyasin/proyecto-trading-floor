# Servidor estático mínimo para probar Pulso en local: http://localhost:5173
param([int]$Port = 5173)
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Pulso en http://localhost:$Port"
$types = @{ '.html'='text/html; charset=utf-8'; '.js'='text/javascript; charset=utf-8'; '.css'='text/css; charset=utf-8'; '.svg'='image/svg+xml'; '.png'='image/png'; '.json'='application/json'; '.ico'='image/x-icon'; '.mp4'='video/mp4' }
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
