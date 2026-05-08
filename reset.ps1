# reset.ps1

Write-Host "Resetting environment to default blue state..."

$nginxConfigPath = ".\nginx\nginx.conf"

$configContent = Get-Content $nginxConfigPath -Raw
$updatedConfig = $configContent -replace "(server\s+)(app-blue|app-green)(:8080;)", '$1app-blue$3'

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Resolve-Path $nginxConfigPath), $updatedConfig, $utf8NoBom)

Write-Host "nginx.conf now points to app-blue."

docker compose exec -T nginx nginx -s reload
Write-Host "Nginx reloaded."

docker compose stop app-green
Write-Host "app-green stopped."

Write-Host "Reset complete."