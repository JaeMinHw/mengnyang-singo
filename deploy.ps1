# deploy.ps1

# --- 스크립트 시작 ---
Write-Host "🚀 무중단 배포를 시작합니다..." -ForegroundColor Green

# 1. 현재 실행 중인 Blue/Green 확인
$running_services = docker compose ps --services --filter "status=running"
$current_app = "none"
if ($running_services -match "app-blue") {
    $current_app = "app-blue"
} elseif ($running_services -match "app-green") {
    $current_app = "app-green"
}

Write-Host "🔵 현재 활성 앱: $current_app"

# 2. 다음 배포할 버전 결정
if ($current_app -eq "app-blue") {
    $new_app = "app-green"
    $old_app = "app-blue"
} else {
    $new_app = "app-blue"
    $old_app = "app-green"
}

Write-Host "🟢 배포할 새 앱: $new_app"

# 3. 새 버전 빌드 및 실행
Write-Host "🐳 새 버전($new_app) 빌드 및 실행 시작..."
# --profile 옵션을 사용하여 green 서비스를 활성화합니다.
if ($new_app -eq "app-green") {
    docker compose --profile green up --build -d $new_app
} else {
    docker compose up --build -d $new_app
}


# 4. 새 버전 헬스 체크 (*** 여기가 수정된 부분입니다 ***)
Write-Host "🏥 $new_app 헬스 체크 중..."
$health_ok = $false # 성공 여부를 기록할 '깃발' 변수
for ($i = 1; $i -le 30; $i++) {
    try {
        $health_check_output = docker compose exec -T nginx curl -s "http://${new_app}:8080/api/health"
        if ($health_check_output -match '"status":"UP"') {
            Write-Host "✅ $new_app 헬스 체크 성공! ($health_check_output)"
            $health_ok = $true # 성공 깃발을 올립니다.
            break              # 성공했으니 즉시 루프를 탈출합니다.
        }
    } catch {}
    
    Write-Host "⏳ 대기 중... ($i/30)"
    Start-Sleep -Seconds 2
}

# 루프가 끝난 후, '깃발'의 상태를 확인합니다.
if (-not $health_ok) {
    Write-Host "❌ $new_app 헬스 체크 실패! 배포를 중단합니다." -ForegroundColor Red
    docker compose stop $new_app
    exit 1
}

# 5. Nginx 설정 변경하여 트래픽 전환 (*** 여기가 최종 수정본입니다 ***)
Write-Host "🔄 트래픽을 $new_app 으로 전환합니다..."
$nginx_config_path = ".\nginx\nginx.conf"
# 정규식을 사용해 server app-blue:8080; 또는 server app-green:8080; 부분을 찾아서 교체합니다.
(Get-Content $nginx_config_path) -replace "(server\s+)(app-blue|app-green)(:8080;)", "`$1${new_app}`$3" | Set-Content $nginx_config_path
# 6. Nginx 리로드 (중단 없음)
docker compose exec -T nginx nginx -s reload
Write-Host "✅ Nginx 리로드 완료!"

# 7. 이전 버전 컨테이너 중지
if ($old_app -ne "none") {
    Write-Host "🛑 이전 버전($old_app) 컨테이너를 중지합니다..."
    Start-Sleep -Seconds 5 # 기존 요청 처리 대기
    docker compose stop $old_app
}

Write-Host "🎉 무중단 배포 성공! 현재 활성 앱: $new_app" -ForegroundColor Green
# --- 스크립트 종료 ---