param(
  [string]$Root = ".",
  [int]$Port = 8080
)

$ErrorActionPreference = 'Stop'

$RootFull = [System.IO.Path]::GetFullPath($Root)
if (-not (Test-Path $RootFull)) {
  Write-Error "Root path not found: $RootFull"
}

$listener = New-Object System.Net.HttpListener
$prefix = "http://localhost:$Port/"
$listener.Prefixes.Add($prefix)
$listener.Start()

Write-Host "Serving $RootFull at $prefix (Ctrl+C to stop)"

# Basic MIME map
$mimes = @{
  ".html" = "text/html; charset=utf-8"
  ".htm"  = "text/html; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".js"   = "application/javascript; charset=utf-8"
  ".mjs"  = "application/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".txt"  = "text/plain; charset=utf-8"
  ".xml"  = "application/xml; charset=utf-8"
  ".svg"  = "image/svg+xml"
  ".ico"  = "image/x-icon"
  ".png"  = "image/png"
  ".jpg"  = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".gif"  = "image/gif"
  ".webp" = "image/webp"
}

# Graceful shutdown on Ctrl+C
$script:stop = $false
$null = Register-EngineEvent PowerShell.Exiting -Action { $script:stop = $true }

while (-not $script:stop) {
  try {
    $context = $listener.GetContext()
  } catch {
    break
  }
  Start-Job -ArgumentList $context, $RootFull, $mimes -ScriptBlock {
    param($context, $RootFull, $mimes)
    $req = $context.Request
    $res = $context.Response
    try {
      $path = $req.Url.AbsolutePath
      if ($path -eq '/' -or [string]::IsNullOrWhiteSpace($path)) { $path = '/index.html' }

      $relPath = $path.TrimStart('/').Replace('/', [System.IO.Path]::DirectorySeparatorChar)
      $local = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($RootFull, $relPath))

      if (-not $local.StartsWith($RootFull)) {
        $res.StatusCode = 403
        $bytes = [System.Text.Encoding]::UTF8.GetBytes("Forbidden")
        $res.ContentType = 'text/plain; charset=utf-8'
        $res.ContentLength64 = $bytes.Length
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
        $res.OutputStream.Close()
        return
      }

      if ((Test-Path $local) -and (Get-Item $local).PSIsContainer) {
        $local = Join-Path $local 'index.html'
      }

      if (-not (Test-Path $local)) {
        $res.StatusCode = 404
        $fallback = Join-Path $RootFull '404.html'
        if (Test-Path $fallback) {
          $bytes = [System.IO.File]::ReadAllBytes($fallback)
          $res.ContentType = 'text/html; charset=utf-8'
        } else {
          $bytes = [System.Text.Encoding]::UTF8.GetBytes('Not Found')
          $res.ContentType = 'text/plain; charset=utf-8'
        }
        $res.ContentLength64 = $bytes.Length
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
        $res.OutputStream.Close()
        return
      }

      $ext = [System.IO.Path]::GetExtension($local).ToLowerInvariant()
      $mime = $mimes[$ext]
      if (-not $mime) { $mime = 'application/octet-stream' }

      $bytes = [System.IO.File]::ReadAllBytes($local)
      $res.ContentType = $mime
      $res.ContentLength64 = $bytes.Length
      $res.AddHeader('Cache-Control', 'no-cache')
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
      $res.OutputStream.Close()
    } catch {
      try {
        $res.StatusCode = 500
        $msg = $_.Exception.Message
        $bytes = [System.Text.Encoding]::UTF8.GetBytes("Server Error: $msg")
        $res.ContentType = 'text/plain; charset=utf-8'
        $res.ContentLength64 = $bytes.Length
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
        $res.OutputStream.Close()
      } catch {}
    }
  } | Out-Null
}

$listener.Stop()
$listener.Close()
