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
Write-Host " [1] Quick Update (SANGAT CEPAT - 1x Password)" -ForegroundColor Green
Write-Host "     Mengunggah kode via tar stream & me-restart PM2."
Write-Host " [2] Full Setup (Instalasi Sistem Lengkap)" -ForegroundColor Yellow
Write-Host "     Mengonfigurasi ulang database, Nginx, UFW, PM2, dll."
Write-Host "====================================================" -ForegroundColor Cyan
$pilihan = Read-Host "Masukkan pilihan Anda (1 atau 2, default: 1)"
if ($pilihan -ne "2") { $pilihan = "1" }

# 2. Menyiapkan Staging Folder Lokal (Mengabaikan node_modules)
Write-Host ""
Write-Host "Menyiapkan berkas untuk diunggah..." -ForegroundColor Yellow
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

# 3. Proses Upload & Eksekusi Server (Single SSH Stream - Masukkan Password 1 Kali)
Write-Host ""
Write-Host "Mengirim berkas & memperbarui server VPS..." -ForegroundColor Yellow
Write-Host "Silakan masukkan password VPS Anda (CUKUP 1 KALI SAJA):" -ForegroundColor Cyan

if ($pilihan -eq "1") {
    $remoteCmd = "mkdir -p /var/www/motodoct && tar -xzf - -C /var/www/motodoct && cd /var/www/motodoct/backend && npm install --production && if grep -q 'DB_USER=root' .env 2>/dev/null; then echo 'Memulihkan konfigurasi database produksi (.env)...' && sed -i 's/DB_USER=root/DB_USER=motodoct_user/g' .env && sed -i 's/DB_PASSWORD=/DB_PASSWORD=motodoct123/g' .env; fi && chmod +x backup.sh && (crontab -l 2>/dev/null | grep -F '/var/www/motodoct/backend/backup.sh' >/dev/null || (crontab -l 2>/dev/null; echo '59 23 * * * /bin/bash /var/www/motodoct/backend/backup.sh > /dev/null 2>&1') | crontab -) && (pm2 restart motodoct-kasir || pm2 start server.js --name motodoct-kasir)"
} else {
    $remoteCmd = "mkdir -p /var/www/motodoct && tar -xzf - -C /var/www/motodoct && cd /var/www/motodoct/backend && chmod +x setup-vps.sh && sudo bash setup-vps.sh"
}

cmd /c "tar -czf - -C ""$TempDir"" backend frontend | ssh root@187.77.156.219 ""$remoteCmd"""

# Hapus folder staging lokal setelah selesai diunggah
if (Test-Path $TempDir) { Remove-Item -Recurse -Force $TempDir }

Write-Host ""
Write-Host "====================================================" -ForegroundColor Green
Write-Host " DEPLOYMENT SELESAI DENGAN SUKSES!                   " -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Green
Write-Host "Sistem kasir Anda sekarang sudah LIVE di:" -ForegroundColor Green
Write-Host "https://motodoct.com" -ForegroundColor Yellow
Write-Host "====================================================" -ForegroundColor Green
