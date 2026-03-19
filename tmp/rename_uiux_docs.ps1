param(
  [string]$InDir = (Join-Path $PSScriptRoot 'uiux-docs'),
  [string]$OutDir = (Join-Path $PSScriptRoot 'uiux-docs-clean')
)

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$i = 1
Get-ChildItem -Path $InDir -File -Filter '*.pdf' |
  Sort-Object Name |
  ForEach-Object {
    $newName = ('uiux_{0:00}.pdf' -f $i)
    Copy-Item -Force -LiteralPath $_.FullName -Destination (Join-Path $OutDir $newName)
    $i++
  }

Write-Output ("Copied {0} UIUX docs to {1}" -f ($i - 1), $OutDir)

