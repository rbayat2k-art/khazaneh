param(
  [ValidateSet('start','stop','status')][string]$Action='start',
  [string]$Root='C:\Users\reza\Desktop\پروژه‌ها\انتشار موقت khazaneh\private\permanent-staging'
)
& node (Join-Path $PSScriptRoot 'manage.mjs') $Action $Root
if($LASTEXITCODE -ne 0){throw 'Staging command failed. Production was not targeted.'}
