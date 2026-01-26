# HIMAGRO Content Management System (V2)

Dashboard monitoring Program Kerja dan Konten Media Sosial HIMAGRO. Aplikasi ini dirancang untuk mempermudah koordinasi antar divisi dalam mengelola konten media sosial, prestasi mahasiswa, dan kerjasama media partner.

## 🚀 Fitur Utama

### 1. **Content Planner**
- **Multiple Views**: List, Monthly, dan Calendar view.
- **Bulk Actions**: Pilih banyak task sekaligus untuk mengubah status atau menghapus.
- **Bulk Add**: Menambah banyak task sekaligus melalui modal khusus.
- **Relative Time**: Tampilan waktu yang informatif (misal: "3 hari yang lalu").
- **Auto Planner**: Otomatisasi pembuatan task dari data Media Partner.

### 2. **Prestasi Mahasiswa**
- Monitoring data prestasi dari Google Sheets.
- Tampilan waktu relatif untuk memudahkan pengecekan data terbaru.
- Detail informasi lengkap untuk setiap entri prestasi.

### 3. **Media Partner**
- Tracking proposal dan surat kerjasama.
- Fitur **Auto Planner** untuk mengubah pengajuan media partner menjadi task di Content Planner dengan satu klik.
- Visual indicator (badge) jika task sudah dibuat.

### 4. **PWA (Progressive Web App)**
- Dapat diinstal di HP atau Desktop.
- Loading cepat dan performa optimal.
- Dukungan offline melalui Service Worker.

---

## 🛠️ Instalasi & Konfigurasi Backend

Untuk menjalankan fitur otomatisasi dan sinkronisasi data, Anda perlu memasang kode berikut di Google Apps Script:

### 1. Persiapan Spreadsheet
Pastikan Spreadsheet Anda memiliki sheet dengan nama berikut:
- `Content Planner`
- `Form Responses 1` (untuk Prestasi)
- `Form Responses 1` (untuk Media Partner - jika di file berbeda, sesuaikan ID di CONFIG)

### 2. Deployment Kode Backend
Salin kode dari file `apps-script/Code.gs` ke editor Google Apps Script Anda, lalu:
1. Klik **Deploy** > **New Deployment**.
2. Pilih jenis **Web App**.
3. Atur "Execute as" ke **Me**.
4. Atur "Who has access" ke **Anyone**.
5. Salin URL Web App yang dihasilkan dan tempel ke `script.js` pada bagian `CONFIG.API_URL`.

### 3. Setup Triggers (Otomatisasi Prestasi)
Untuk fitur otomatisasi pembuatan task Prestasi Mahasiswa setiap tanggal 15 & 30:
1. Di editor Apps Script, jalankan fungsi `setupMonthlyTriggers()`.
2. Berikan izin (authorize) yang diminta.
3. Task akan otomatis dibuat setiap jam 9 malam pada tanggal tersebut jika ada data prestasi baru.

---

## 🎨 Desain & Estetika
- **Theme**: Emerald Premium (Dark Mode).
- **Typography**: Inter (Google Fonts).
- **Icons**: Font Awesome 6.
- **Responsive**: Mendukung tampilan Mobile, Tablet (iPad), dan Desktop dengan sempurna.

---

## 📂 Struktur Proyek
- `index.html`: Struktur utama aplikasi.
- `styles.css`: Desain sistem dan responsivitas.
- `script.js`: Logika aplikasi dan interaksi API.
- `manifest.json`: Konfigurasi PWA.
- `service-worker.js`: Manajemen cache PWA.
- `apps-script/`: Source code untuk Google Apps Script.

---

## 📝 Catatan Performa
Aplikasi telah dioptimalkan dengan:
- **Event Delegation**: Mengurangi penggunaan memori.
- **Lazy Rendering**: Mempercepat loading awal.
- **CSS Animations**: Menjamin transisi yang halus (60fps).
- **GPU-Accelerated Transforms**: Untuk animasi yang ringan.

---

**Dikembangkan oleh Antigravity untuk HIMAGRO UNSIL.**  
*Terakhir diperbarui: 27 Januari 2026*
