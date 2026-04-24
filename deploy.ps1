# 1. Identify currently running Blue/Green
$running_services = docker compose ps --services
$current_app = "none"
if ($running_services -like "*app-blue*") {
    $current_app = "app-blue"
}

Write-Host "🔵 Current Active App: $current_app" -ForegroundColor Blue

# 2. Determine target for deployment
if ($current_app -eq "app-blue") {
    $new_app = "app-green"
    $new_container = "mengnyang-green"
    $old_app = "app-blue"
} else {
    $new_app = "app-blue"
    $new_container = "mengnyang-blue"
    $old_app = "app-green"
}

Write-Host "🟢 New Deployment Target: $new_app (Container: $new_container)" -ForegroundColor Green

# 3. Build and Start the new version
Write-Host "🐳 Building and starting $new_app..."
if ($new_app -eq "app-green") {
    docker compose --profile green up --build -d app-green
} else {
    docker compose up --build -d app-blue
}

# 4. Health Check (Direct container check using Python)
Write-Host "🏥 Starting Health Check for $new_container..." -ForegroundColor White
for ($i = 1; $i -le 30; $i++) {
    # Simplified Python command to avoid syntax/escaping errors
    $status = docker exec $new_container python3 -c "import urllib.request; print(urllib.request.urlopen('http://localhost:8080/health').getcode())" 2>$null
    
    if ($null -ne $status -and $status.Trim() -eq "200") {
        Write-Host "✅ $new_container Health Check Passed! (Status: $status)" -ForegroundColor Green
        break
    }
    
    Write-Host "⏳ Waiting... ($i/30) - Current Response: [$status]" 
    Start-Sleep -Seconds 2
}

if ($i -gt 30) {
    Write-Host "❌ $new_container Health Check Failed! Aborting deployment." -ForegroundColor Red
    docker logs --tail 10 $new_container
    docker compose stop $new_app
    exit 1
}

# 5. Update Nginx configuration
Write-Host "🔄 Switching traffic to $new_container..."
$nginx_config_path = ".\nginx\nginx.conf"
(Get-Content $nginx_config_path) -replace "server mengnyang-.*?`:", "server $new_container`:" | Set-Content $nginx_config_path

# 6. Reload Nginx without downtime
docker compose exec nginx nginx -s reload
Write-Host "✅ Nginx Reloaded! Traffic is now routed to $new_container." -ForegroundColor Cyan

# 7. Cleanup old version
Write-Host "🛑 Stopping previous version ($old_app)..."
Start-Sleep -Seconds 5
docker compose stop $old_app

Write-Host "🎉 Zero-downtime deployment complete! Active App: $new_app" -ForegroundColor Yellow