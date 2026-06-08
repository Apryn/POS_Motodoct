# ==============================================================================
# POWERSHELL DEPLOYMENT SCRIPT - MOTODOCT VPS
# Target IP: 187.77.156.219
# ==============================================================================

Clear-Host
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host " STARTING DEPLOYMENT PROCESS TO MOTODOCT VPS" -ForegroundColor Cyan
Write-Host " IP VPS: 187.77.156.219" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

# 1. Menu Pilihan Deployment
Write-Host ""
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host " PILIH METODE DEPLOYMENT:" -ForegroundColor Cyan
Write-Host " [1] Quick Update (SANGAT CEPAT - Rekomendasi)" -ForegroundColor Green
Write-Host "     Hanya mengunggah file kode & me-restart server PM2."
Write-Host "     (Sangat cepat karena tidak mengunggah node_modules)"
Write-Host " [2] Full Setup (Instalasi Sistem Lengkap)" -ForegroundColor Yellow
Write-Host "     Mengonfigurasi ulang database, Nginx, UFW, PM2, dll."
Write-Host "====================================================" -ForegroundColor Cyan
$pilihan = Read-Host "Masukkan pilihan Anda (1 atau 2, default: 1)"
if ($pilihan -ne "2") { $pilihan = "1" }

# 2. Menyiapkan Staging Folder Lokal (Mengabaikan node_modules)
Write-Host ""
Write-Host "Menyiapkan berkas untuk diunggah (mengabaikan node_modules)..." -ForegroundColor Yellow
$TempDir = "$PSScriptRoot\temp_deploy"
if (Test-Path $TempDir) { Remove-Item -Recurse -Force $TempDir }
New-Item -ItemType Directory -Path $TempDir | Out-Null

# Salin frontend
Copy-Item -Path "$PSScriptRoot\frontend" -Destination $TempDir -Recurse

# Salin backend tanpa node_modules & .env
New-Item -ItemType Directory -Path "$TempDir\backend" | Out-Null
Get-ChildItem -Path "$PSScriptRoot\backend" -Force | Where-Object { $_.Name -ne "node_modules" -and $_.Name -ne ".env" } | ForEach-Object {
    Copy-Item -Path $_.FullName -Destination "$TempDir\backend" -Recurse
}

# 3. Membuat folder tujuan di VPS
Write-Host ""
Write-Host "[1/3] Membuat folder tujuan di VPS..." -ForegroundColor Yellow
Write-Host "Silakan masukkan password VPS Anda jika diminta:" -ForegroundColor Gray
ssh root@187.77.156.219 "mkdir -p /var/www/motodoct"

# 4. Mengunggah folder backend dan frontend (Tanpa node_modules & .env)
Write-Host ""
Write-Host "[2/3] Mengunggah berkas aplikasi ke VPS (Proses sangat cepat!)..." -ForegroundColor Yellow
Write-Host "Silakan masukkan password VPS Anda kembali:" -ForegroundColor Gray
scp -r "$TempDir/backend" "$TempDir/frontend" root@187.77.156.219:/var/www/motodoct/

# Hapus folder staging lokal setelah selesai diunggah
if (Test-Path $TempDir) { Remove-Item -Recurse -Force $TempDir }

# 5. Menjalankan proses di VPS sesuai pilihan
Write-Host ""
if ($pilihan -eq "1") {
    Write-Host "[3/3] Menjalankan Quick Update di VPS..." -ForegroundColor Yellow
    Write-Host "Menginstal dependensi, memverifikasi konfigurasi, & me-restart PM2..." -ForegroundColor Gray
    Write-Host "Silakan masukkan password VPS Anda untuk terakhir kalinya:" -ForegroundColor Gray
    ssh root@187.77.156.219 "cd /var/www/motodoct/backend && npm install --production && if grep -q 'DB_USER=root' .env 2>/dev/null; then echo 'Memulihkan konfigurasi database produksi (.env)...' && sed -i 's/DB_USER=root/DB_USER=motodoct_user/g' .env && sed -i 's/DB_PASSWORD=/DB_PASSWORD=motodoct123/g' .env; fi && (pm2 restart motodoct-kasir || pm2 start server.js --name motodoct-kasir)"
} else {
    Write-Host "[3/3] Menjalankan Full Setup di VPS..." -ForegroundColor Yellow
    Write-Host "Menyiapkan sistem database, Nginx, UFW firewall, PM2, dll..." -ForegroundColor Gray
    Write-Host "Silakan masukkan password VPS Anda untuk terakhir kalinya:" -ForegroundColor Gray
    ssh root@187.77.156.219 "cd /var/www/motodoct/backend && chmod +x setup-vps.sh && sudo bash setup-vps.sh"
}

Write-Host ""
Write-Host "====================================================" -ForegroundColor Green
Write-Host " DEPLOYMENT SELESAI DENGAN SUKSES!                   " -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Green
Write-Host "Sistem kasir Anda sekarang sudah LIVE di:" -ForegroundColor Green
Write-Host "https://motodoct.com" -ForegroundColor Yellow
Write-Host "====================================================" -ForegroundColor Green
