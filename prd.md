# Product Requirements Document (PRD)
*Project:* Cherry Coffee POS & Stock Management

## 1. Problem Statement
Menghitung setoran ceri kopi dari petani atau karyawan, mencatat upah mereka, melacak ketersediaan stok, dan menghitung profit bersih harian setelah dikurangi biaya operasional sangat merepotkan jika dilakukan terpisah. Seringkali, pemilik bisnis kesulitan mengetahui secara real-time berapa sisa stok ceri yang bisa dijual hari ini, berapa persisnya upah yang harus dibayarkan ke karyawan (misal: Pak Yanto), dan berapa profit bersih sebenarnya di akhir hari (closing).

## 2. Target User
Pemilik bisnis pengolahan pasca-panen kopi, roastery, atau pengepul ceri kopi. 
•⁠  ⁠*Profil:* Sibuk mengurus operasional harian kedai atau prosesori, membutuhkan data yang cepat dan akurat untuk mengambil keputusan.
•⁠  ⁠*Tingkat literasi teknologi:* Sedang. Mereka terbiasa menggunakan smartphone atau laptop untuk membuka web browser, namun tidak menginginkan sistem kasir komersial yang terlalu kompleks, lambat, atau memiliki fitur berlebih yang tidak terpakai.

## 3. Current Workaround
Saat ini pencatatan dilakukan secara manual menggunakan buku tulis, atau menggunakan aplikasi spreadsheet (Excel/Google Sheets). 
•⁠  ⁠*Kelemahan:* Menggunakan buku rawan hilang dan sulit direkap. Menggunakan spreadsheet mengharuskan user menginput rumus berulang kali, rawan salah ketik (human error) yang berakibat fatal pada perhitungan upah atau profit, dan UI/UX-nya tidak dirancang untuk kecepatan transaksi layaknya sistem kasir (POS).

## 4. Proposed Solution
Sebuah aplikasi web satu halaman (Single Page Application) yang berfungsi sebagai pencatat stok otomatis, kalkulator upah, sekaligus POS kasir sederhana. Aplikasi ini akan otomatis memproses alur kerja: ketika ada setoran masuk, stok langsung bertambah dan sistem otomatis menghitung beban upah per kg. Saat terjadi penjualan, omzet otomatis tercatat, dan di akhir hari user langsung disajikan angka profit bersih setelah dikurangi seluruh beban biaya operasional.

## 5. Core Features (MVP)
Fitur-fitur esensial yang harus ada agar aplikasi bisa langsung digunakan:
•⁠  ⁠*Master Config:* Form input untuk mengatur harga jual ceri per kg dan menetapkan tarif upah karyawan per kg (contoh: Rp 3.500/kg).
•⁠  ⁠*Inbound Module (Setoran Karyawan):* Input nama karyawan dan jumlah kg setoran. Sistem otomatis menambahkan stok ceri dan mencatat rekap utang upah ke karyawan tersebut.
•⁠  ⁠*Outbound Module (POS/Penjualan):* Sistem kasir sederhana untuk menginput jumlah kg ceri yang terjual, otomatis mengurangi stok, dan menghitung total harga berdasarkan Master Config.
•⁠  ⁠*Operational Cost Tracker:* Form input cepat untuk mencatat pengeluaran operasional harian (misal: bensin, makan siang, dll).
•⁠  ⁠*Daily Closing Dashboard:* Layar rekapitulasi harian yang menampilkan sisa stok, daftar upah yang harus dibayar per nama karyawan, dan kalkulasi *Profit Bersih* ( (Harga Jual - Upah) x Kg Terjual - Biaya Operasional ).

## 6. Out of Scope (Fase Selanjutnya)
Fitur yang sengaja tidak dimasukkan di versi pertama ini agar development lebih cepat:
•⁠  ⁠Sistem autentikasi/login (Admin vs Kasir).
•⁠  ⁠Integrasi database online atau sinkronisasi antar perangkat secara real-time.
•⁠  ⁠Cetak struk fisik dengan thermal printer atau integrasi barcode scanner.
•⁠  ⁠Manajemen profil karyawan (database karyawan tetap).
•⁠  ⁠Laporan rekapitulasi bulanan atau grafik analitik jangka panjang.

## 7. Constraints
•⁠  ⁠*Batasan Teknis:* Pengembangan menggunakan stack yang sangat sederhana (HTML, Tailwind CSS, Vanilla JavaScript). Data akan disimpan menggunakan ⁠ LocalStorage ⁠ pada browser pengguna.
•⁠  ⁠*Timeline & Deployment:* Karena sifatnya MVP dan client-side, aplikasi ini harus ringan, cepat selesai, dan mudah di-deploy menggunakan layanan hosting statis tanpa memerlukan konfigurasi server/backend.