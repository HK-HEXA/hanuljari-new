param(
  [Parameter(Mandatory = $true)] [string] $Repo,
  [switch] $InstallGit
)

$ErrorActionPreference = 'Stop'

function Exec($cmd) {
  Write-Host "> $cmd" -ForegroundColor Cyan
  iex $cmd
}

function Test-Git {
  try { git --version | Out-Null; return $true } catch { return $false }
}

if (-not (Test-Git)) {
  if ($InstallGit) {
    Write-Host "Git not found. Trying to install via winget..." -ForegroundColor Yellow
    try {
      winget install --id Git.Git -e --source winget --accept-source-agreements --accept-package-agreements
    } catch {
      Write-Warning "winget installation failed. Please install Git manually from https://git-scm.com/download/win"
      exit 1
    }
  } else {
    Write-Error "Git not found. Re-run with -InstallGit or install Git from https://git-scm.com/download/win"
  }
}

if (-not (Test-Path '.git')) {
  Exec 'git init'
}

# Ensure main as default branch
try { Exec 'git symbolic-ref --short HEAD' | Out-Null } catch {}
Exec 'git checkout -B main'

# Basic .gitignore if missing
if (-not (Test-Path '.gitignore')) {
  @"
node_modules/
dist/
.vite/
*.log
.vscode/
.DS_Store
Thumbs.db
"@ | Set-Content -Encoding UTF8 .gitignore
}

Exec 'git add -A'
try {
  Exec 'git commit -m "Initial import of static site"'
} catch {
  Write-Host "Nothing to commit (working tree clean)" -ForegroundColor Yellow
}

$hasRemote = $false
try {
  $r = git remote get-url origin 2>$null
  if ($LASTEXITCODE -eq 0 -and $r) { $hasRemote = $true }
} catch {}

if ($hasRemote) {
  Exec "git remote set-url origin $Repo"
} else {
  Exec "git remote add origin $Repo"
}

Exec 'git push -u origin main'
Write-Host "Done. Pushed to $Repo (branch: main)" -ForegroundColor Green
