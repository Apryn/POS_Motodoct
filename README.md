# Motodoct - Workshop Cashier & POS System

Aplikasi kasir (Point of Sale) premium dan sistem manajemen operasional yang dirancang khusus untuk memenuhi kebutuhan bisnis bengkel sepeda motor modern. Sistem ini memadukan kemudahan transaksi kasir dengan fitur manajemen mekanik, pengelolaan stok gudang, laporan keuangan, dan rekam medis servis kendaraan.

---

## 🚀 Fitur Utama

### 1. POS (Kasir) & Sistem Pembayaran
* **Input Cepat**: Pencarian barang responsif dan dukungan pemindaian kode batang (*barcode scanner*).
* **Daftar Kompak & Antilag**: Antarmuka kasir berbasis tabel kompak dengan fitur halaman (*pagination*) untuk performa mulus saat melayani ribuan data suku cadang.
* **Keranjang Belanja Tersimpan**: Menyimpan sementara keranjang belanja aktif berdasarkan nomor plat kendaraan saat motor sedang diservis, sehingga kasir bisa melayani antrean lain.
* **Metode Pembayaran Fleksibel**: Mendukung pembayaran tunai (Cash dengan fitur kalkulator kembalian), QRIS (menampilkan kode QR dinamis), dan Transfer Bank (lengkap dengan informasi rekening dan tombol salin cepat).
* **Cek Harga Cepat (F2)**: Modul pencarian harga cepat untuk mengecek stok, lokasi rak, harga modal (khusus admin/owner), dan harga jual tanpa mengganggu transaksi yang sedang berjalan.
* **Produk Luar & Lainnya**: Kemampuan menginput transaksi barang luar atau jasa khusus yang belum terdaftar di database secara langsung saat checkout.

### 2. Manajemen Kendaraan & Rekam Medis
* **Rekam Medis Servis**: Melacak histori penggantian sparepart dan tindakan servis pelanggan berdasarkan Nomor Plat Kendaraan.
* **Deteksi Pelanggan Setia**: Menampilkan riwayat kunjungan terakhir, mekanik yang menangani, serta detail transaksi sebelumnya untuk meningkatkan kualitas pelayanan.

### 3. Skema Komisi Mekanik & Helper
* **Bagi Hasil Adil**: Perhitungan komisi jasa servis otomatis untuk Mekanik Utama dan Helper (asisten mekanik) sesuai dengan porsi pengerjaan.
* **Transparansi Kerja**: Laporan khusus rincian komisi per mekanik yang dapat dipantau langsung pada dashboard laporan keuangan untuk mempermudah penggajian.

### 4. Laporan Keuangan & Pengeluaran
* **Laporan Laba Rugi (P&L)**: Perhitungan pendapatan kotor, pengeluaran operasional, komisi mekanik, diskon, dan laba bersih secara real-time.
* **Rincian Pengeluaran Operasional**: Fitur CRUD pengeluaran bengkel (seperti sewa ruko, listrik, air, konsumsi, dll.) untuk menghitung pengeluaran bulanan secara akurat.
* **Filter Tanggal Fleksibel**: Analisis performa keuangan berdasarkan hari ini, kemarin, bulan ini, bulan lalu, atau rentang tanggal kustom.
* **Cetak Struk Thermal**: Desain struk belanjaan dan ringkasan laporan keuangan yang dioptimalkan untuk printer thermal ukuran 58mm/80mm.

### 5. Manajemen Inventaris Gudang
* **Data Suku Cadang Lengkap**: Menyimpan informasi kode barang, nama, kategori (oli, ban, gear, dll.), merk, kecocokan tipe motor, lokasi rak penyimpanan, minimal stok, harga beli, dan harga jual.
* **Notifikasi Stok Menipis/Habis**: Indikator warna dinamis (Hijau = Aman, Kuning = Menipis, Merah = Habis) pada stok barang.
* **Impor Data via Excel**: Mempermudah migrasi data stok awal atau pembelian massal dari file Excel dengan sistem pemetaan kolom otomatis, validasi error, dan pencegahan duplikasi kode barang.
* **Ekspor Laporan**: Mengekspor daftar stok gudang aktif ke dalam format Excel (`.xlsx`) dalam satu klik untuk kebutuhan audit/opname.

### 6. Keamanan & Hak Akses (RBAC)
* **Keamanan Berlapis**: Proteksi API menggunakan JSON Web Token (JWT) dengan enkripsi tinggi.
* **Role-Based Access Control (RBAC)**: Pengaturan menu dan pembatasan akses data sensitif (seperti harga beli modal, hapus transaksi, atau ubah harga massal) berdasarkan 4 peran utama:
  * **Owner**: Akses penuh ke laporan keuangan laba rugi, data user, dan pengaturan sistem.
  * **Admin**: Mengelola stok gudang, menginput pembelian, serta melayani kasir.
  * **Kasir**: Hak akses khusus untuk pelayanan transaksi penjualan kasir (POS).
  * **Gudang**: Hak akses khusus untuk mengelola stok masuk, opname, dan lokasi rak.

### 7. Integrasi Telegram & WhatsApp
* **Notifikasi Telegram**: Notifikasi real-time ke grup/channel Telegram untuk setiap transaksi masuk, pengeluaran, atau aktivitas stok opname.
* **WhatsApp Templates**: Pengaturan templat pesan tagihan dan pengingat servis yang dinamis dan terintegrasi untuk dikirimkan ke pelanggan.

### 8. Auto Backup Database
* **Backup Harian Otomatis**: Skrip sistem (*cron job*) yang otomatis mengekspor database MySQL secara berkala, mengompresnya, dan mengirimkan file backup `.sql.gz` secara langsung ke akun Telegram Anda setiap pukul 23:59 WIB.

---

## 🛠️ Spesifikasi Teknologi

### Frontend (Client-side)
* **Teknologi**: Vanilla HTML5, CSS3 (Premium UI, Glassmorphism, Responsive Mobile/Tablet), JavaScript (ES6+).
* **Library**: 
  * [Lucide Icons](https://lucide.dev/) untuk ikon premium.
  * [SheetJS (XLSX)](https://sheetjs.com/) untuk pemrosesan file Excel di sisi client.

### Backend (Server-side)
* **Runtime**: Node.js (v20.x LTS)
* **Framework**: Express.js
* **Database**: MySQL Server
* **Autentikasi**: JSON Web Tokens (JWT) & bcryptjs hashing.

---

## 📦 Panduan Instalasi Lokal

### 1. Prasyarat
* Pasang **Node.js** (versi 20 atau terbaru).
* Pasang **MySQL Server** dan pastikan service telah berjalan.

### 2. Setup Database
1. Buat database baru bernama `kasir_motodoct`:
   ```sql
   CREATE DATABASE kasir_motodoct;
   ```
2. Import skema database dari file dump yang berada di direktori backend:
   ```bash
   mysql -u root -p kasir_motodoct < backend/kasir_motodoct.sql
   ```

### 3. Setup Backend
1. Masuk ke folder backend dan instal dependensi:
   ```bash
   cd backend
   npm install
   ```
2. Salin `.env.example` menjadi `.env` lalu sesuaikan kredensial database Anda:
   ```env
   PORT=3000
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=password_anda
   DB_NAME=kasir_motodoct
   JWT_SECRET=rahasia_jwt_anda
   TELEGRAM_BOT_TOKEN=token_bot_anda
   TELEGRAM_CHAT_ID=id_chat_anda
   ```
3. Jalankan server dalam mode pengembangan:
   ```bash
   npm run dev
   ```

### 4. Akses Frontend
Buka file `frontend/pages/login.html` langsung pada peramban (*browser*) Anda, atau jalankan menggunakan server lokal (seperti extension Live Server di VS Code).

---

## 🚀 Panduan Deployment Ke VPS (Ubuntu)

Proyek ini telah dilengkapi dengan skrip otomatisasi setup dan deploy cepat untuk memudahkan pemeliharaan di server VPS:

### 1. Setup Awal VPS (Ubuntu)
1. Hubungkan domain Anda ke IP VPS (A Record).
2. Salin seluruh folder ke VPS, masuk ke direktori backend, dan jalankan script inisialisasi sebagai root:
   ```bash
   sudo bash setup-vps.sh
   ```
   *Skrip ini akan otomatis menginstal Node.js, MySQL Server, Nginx, PM2, membuka port firewall UFW, membuat file `.env` produksi, mengonfigurasi reverse proxy, serta mendaftarkan SSL Let's Encrypt (HTTPS).*

### 2. Deploy Cepat (Quick Update)
Dari komputer lokal Anda (Windows PowerShell), jalankan perintah deploy otomatis untuk mengunggah perubahan kode terbaru ke VPS tanpa mengunggah folder `node_modules`:
```powershell
./deploy.ps1
```
Pilih opsi `[1] Quick Update` untuk deploy instan dalam hitungan detik.

---

## 👥 Tim Pengembang

* **Apriyan** - Frontend Developer & System Integrator (Full Stack Execution & VPS Deployment)
* **Riski** - Database Designer (Initial SQL Schema Design)
