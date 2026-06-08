#!/bin/bash

# ==============================================================================
# 🚀 AUTOMATED DEPLOYMENT SCRIPT - CASHIER MOTODOCT
# Target OS: Ubuntu 20.04 / 22.04 / 24.04 LTS
# ==============================================================================

# Warna output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}====================================================${NC}"
echo -e "${BLUE}    🚀 MEMULAI OTOMATISASI SETUP VPS MOTODOCT        ${NC}"
echo -e "${BLUE}====================================================${NC}"

# Pastikan script dijalankan sebagai root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}❌ Silakan jalankan script ini sebagai root (sudo bash setup-vps.sh)${NC}"
  exit 1
fi

# 1. Update system packages
echo -e "\n${YELLOW}[1/6] Memperbarui package system...${NC}"
apt update && apt upgrade -y
apt install -y curl git ufw nginx

# 2. Install Node.js (Version 20 LTS)
echo -e "\n${YELLOW}[2/6] Menginstal Node.js v20 LTS...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
echo -e "${GREEN}✓ Node.js v$(node -v) berhasil diinstal!${NC}"

# 3. Install & Konfigurasi MySQL
echo -e "\n${YELLOW}[3/6] Menginstal MySQL Server...${NC}"
apt install -y mysql-server
systemctl start mysql
systemctl enable mysql

# Fungsi pembantu untuk menjalankan perintah MySQL secara fleksibel (baik dengan password root lama, baru, atau socket)
mysql_run() {
  if mysql -u root -e "SELECT 1;" >/dev/null 2>&1; then
    mysql -u root -e "$1"
  elif mysql -u root -pmotodoct123 -e "SELECT 1;" >/dev/null 2>&1; then
    mysql -u root -pmotodoct123 -e "$1"
  else
    sudo mysql -e "$1"
  fi
}

# Buat database & set password root MySQL serta user khusus aplikasi
echo -e "${YELLOW}Mengonfigurasi database 'kasir_motodoct' dan pengguna khusus...${NC}"
mysql_run "CREATE DATABASE IF NOT EXISTS kasir_motodoct;"
mysql_run "CREATE USER IF NOT EXISTS 'motodoct_user'@'localhost' IDENTIFIED BY 'motodoct123';"
mysql_run "ALTER USER 'motodoct_user'@'localhost' IDENTIFIED BY 'motodoct123';"
mysql_run "GRANT ALL PRIVILEGES ON kasir_motodoct.* TO 'motodoct_user'@'localhost';"
mysql_run "FLUSH PRIVILEGES;"
echo -e "${GREEN}✓ Database & Pengguna khusus MySQL berhasil dikonfigurasi!${NC}"

# Import tabel dasar dari SQL dump jika filenya ada
if [ -f "kasir_motodoct.sql" ]; then
  echo -e "${YELLOW}Mengimpor skema database kasir_motodoct.sql...${NC}"
  mysql -u motodoct_user -pmotodoct123 kasir_motodoct < kasir_motodoct.sql
  echo -e "${GREEN}✓ Skema database berhasil diimpor!${NC}"
else
  echo -e "${RED}⚠️  File kasir_motodoct.sql tidak ditemukan di direktori saat ini. Lewati langkah impor skema (aplikasi akan membuat tabel secara otomatis saat dijalankan).${NC}"
fi

# 4. Install PM2 (Process Manager untuk Node.js)
echo -e "\n${YELLOW}[4/6] Menginstal PM2 Process Manager...${NC}"
npm install -g pm2
echo -e "${GREEN}✓ PM2 berhasil diinstal!${NC}"

# 5. Konfigurasi .env
echo -e "\n${YELLOW}[5/6] Mengonfigurasi berkas lingkungan (.env)...${NC}"
# Selalu hapus .env lokal yang terunggah agar tidak menimpa password produksi
rm -f .env
cat <<EOT > .env
PORT=3000
DB_HOST=localhost
DB_USER=motodoct_user
DB_PASSWORD=motodoct123
DB_NAME=kasir_motodoct
JWT_SECRET=rahasia_kasir_bengkel_$(openssl rand -hex 16)
TELEGRAM_BOT_TOKEN=8458013309:AAEWueJiv7HwDNLgpd2OtiGLBskJQOfyrow
TELEGRAM_CHAT_ID=5842172466
EOT
echo -e "${GREEN}✓ File .env baru berhasil dibuat dengan password MySQL terintegrasi!${NC}"

# Instal dependensi Node.js secara langsung di VPS
echo -e "\n${YELLOW}Menginstal dependensi Node.js di VPS (npm install)...${NC}"
npm install --production

# Jalankan server menggunakan PM2 (Hapus yang lama jika ada agar memuat berkas dan .env baru)
echo -e "${YELLOW}Menjalankan server Node.js dengan PM2...${NC}"
pm2 delete "motodoct-kasir" 2>/dev/null || true
pm2 start server.js --name "motodoct-kasir"
pm2 startup systemd
pm2 save
echo -e "${GREEN}✓ Server kasir berjalan stabil di background!${NC}"

# 6. Konfigurasi Nginx Reverse Proxy
echo -e "\n${YELLOW}[6/6] Mengonfigurasi Nginx Web Server...${NC}"
rm -f /etc/nginx/sites-enabled/default
cat <<EOT > /etc/nginx/sites-available/motodoct
server {
    listen 80;
    server_name motodoct.com www.motodoct.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOT

ln -sf /etc/nginx/sites-available/motodoct /etc/nginx/sites-enabled/
systemctl restart nginx
echo -e "${GREEN}✓ Nginx berhasil dikonfigurasi sebagai Reverse Proxy!${NC}"

# 7. Setup SSL Let's Encrypt menggunakan Certbot
echo -e "\n${YELLOW}Menginstal Certbot dan Mengonfigurasi SSL Let's Encrypt...${NC}"
apt install -y certbot python3-certbot-nginx

echo -e "${YELLOW}Mendaftarkan sertifikat SSL Let's Encrypt untuk motodoct.com & www.motodoct.com...${NC}"
certbot --nginx -d motodoct.com -d www.motodoct.com --non-interactive --agree-tos -m admin@motodoct.com --redirect || {
    echo -e "${RED}⚠️  Gagal mendaftarkan SSL untuk kedua domain. Mencoba hanya untuk motodoct.com...${NC}"
    certbot --nginx -d motodoct.com --non-interactive --agree-tos -m admin@motodoct.com --redirect || \
    echo -e "${RED}⚠️  Pendaftaran SSL Certbot gagal total. Pastikan DNS A Record untuk domain motodoct.com sudah diarahkan ke IP VPS Anda!${NC}"
}

# Buka firewall untuk Nginx
echo -e "${YELLOW}Membuka port firewall...${NC}"
ufw allow 'Nginx Full'
ufw allow 22
echo "y" | ufw enable

echo -e "\n${GREEN}====================================================${NC}"
echo -e "${GREEN} 🎉 SETUP SELESAI! APLIKASI SIAP DIAKSES!           ${NC}"
echo -e "${GREEN}====================================================${NC}"
echo -e "Silakan akses aplikasi Anda langsung melalui IP VPS Anda."
echo -e "Password root database MySQL Anda: ${YELLOW}motodoct123${NC}"
echo -e "Pantau status server kasir dengan perintah: ${YELLOW}pm2 status${NC}"
echo -e "${GREEN}====================================================${NC}"
