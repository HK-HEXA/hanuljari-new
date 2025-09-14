param(
  [Parameter(Mandatory=$true)] [string] $Owner,
  [Parameter(Mandatory=$true)] [string] $Repo,
  [string] $Token = $env:GITHUB_TOKEN,
  [string] $Branch = 'main',
  [string] $Root = '.'
)

$ErrorActionPreference = 'Stop'

if (-not $Token -or [string]::IsNullOrWhiteSpace($Token)) {
  $sec = Read-Host -Prompt 'Enter GitHub Token (input hidden)' -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
  try { $Token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

$commonHeaders = @{ Authorization = "token $Token"; 'User-Agent' = 'hanuljari-uploader'; 'Accept' = 'application/vnd.github+json' }

function Get-RelativePath([string] $Base, [string] $Path) {
  $baseFull = [System.IO.Path]::GetFullPath($Base)
  $pathFull = [System.IO.Path]::GetFullPath($Path)
  return $pathFull.Substring($baseFull.Length).TrimStart([System.IO.Path]::DirectorySeparatorChar)
}

function Get-FileSha($owner,$repo,$path,$branch){
  $uri = "https://api.github.com/repos/$owner/$repo/contents/$path?ref=$branch"
  try {
    $r = Invoke-RestMethod -Method GET -Uri $uri -Headers $commonHeaders
    return $r.sha
  } catch { return $null }
}

function Ensure-Branch($owner,$repo,$branch){
  try {
    Invoke-RestMethod -Method GET -Uri "https://api.github.com/repos/$owner/$repo/git/refs/heads/$branch" -Headers $commonHeaders | Out-Null
    return
  } catch {
    $repoInfo = Invoke-RestMethod -Method GET -Uri "https://api.github.com/repos/$owner/$repo" -Headers $commonHeaders
    $default = $repoInfo.default_branch
    $isEmpty = ($repoInfo.size -eq 0)
    if ($isEmpty) {
      # For empty repos, let the first PUT create the initial commit on the default branch
      Write-Host "Repository is empty; will create initial commit via Contents API on branch '$Branch' (default: '$default')." -ForegroundColor Yellow
      return
    }
    try {
      $ref = Invoke-RestMethod -Method GET -Uri "https://api.github.com/repos/$owner/$repo/git/refs/heads/$default" -Headers $commonHeaders
      $sha = $ref.object.sha
      $body = @{ ref = "refs/heads/$branch"; sha = $sha } | ConvertTo-Json
      Invoke-RestMethod -Method POST -Uri "https://api.github.com/repos/$owner/$repo/git/refs" -Headers $commonHeaders -ContentType 'application/json' -Body $body | Out-Null
    } catch {
      Write-Warning "Unable to create branch '$branch'. Will attempt upload directly. $_"
    }
  }
}

Write-Host "Preparing upload to $Owner/$Repo (branch: $Branch) from $Root" -ForegroundColor Cyan
Ensure-Branch -owner $Owner -repo $Repo -branch $Branch

$exclude = @('.git', 'node_modules', 'dist', '.vite', '.vscode', '.DS_Store', 'Thumbs.db')
$rootFull = [System.IO.Path]::GetFullPath($Root)
$files = Get-ChildItem -Path $rootFull -Recurse -File | Where-Object {
  $rel = Get-RelativePath -Base $rootFull -Path $_.FullName
  -not ($exclude | ForEach-Object { $rel -like ("$_*") })
}

foreach ($f in $files) {
  $rel = Get-RelativePath -Base $rootFull -Path $f.FullName
  $content = [System.Convert]::ToBase64String([System.IO.File]::ReadAllBytes($f.FullName))
  $sha = Get-FileSha -owner $Owner -repo $Repo -path $rel -branch $Branch
  $isUpdate = [string]::IsNullOrEmpty($sha) -eq $false
  $message = if ($isUpdate) { "chore: update $rel" } else { "feat: add $rel" }
  $body = @{ message = $message; content = $content; branch = $Branch }
  if ($isUpdate) { $body.sha = $sha }
  $json = $body | ConvertTo-Json
  $uri = "https://api.github.com/repos/$Owner/$Repo/contents/$rel"
  Write-Host "Uploading $rel" -ForegroundColor Green
  Invoke-RestMethod -Method PUT -Uri $uri -Headers $commonHeaders -ContentType 'application/json' -Body $json | Out-Null
}

Write-Host "Upload complete." -ForegroundColor Green
