// File: src/scripts/fixHousingPhotosFK.js
const { sequelize } = require('../models');

async function fixHousingPhotosConstraint() {
  console.log('🔄 Memulai perbaikan tabel housing_photos...');

  try {
    // Cek koneksi dulu
    await sequelize.authenticate();
    console.log('✅ Koneksi database berhasil.');

    // Eksekusi perintah DROP FOREIGN KEY
    // Menggunakan try-catch khusus agar jika key sudah tidak ada, script tidak error
    try {
      await sequelize.query(
        'ALTER TABLE `housing_photos` DROP FOREIGN KEY `housing_photos_ibfk_1`;'
      );
      console.log('✅ BERHASIL: Foreign Key constraint `housing_photos_ibfk_1` telah dihapus.');
    } catch (error) {
      // Kode error MySQL 1091 = Can't DROP 'x'; check that column/key exists
      if (error.original && error.original.errno === 1091) {
        console.log('ℹ️  INFO: Foreign Key `housing_photos_ibfk_1` tidak ditemukan (mungkin sudah dihapus sebelumnya).');
      } else {
        throw error;
      }
    }

    // Opsional: Hapus index yang mungkin terbuat otomatis oleh foreign key tersebut
    // Biasanya namanya sama dengan nama kolom foreign key (entity_id) atau nama constraint
    try {
      // Cek index dulu atau coba drop safe
      // Index 'entity_id' atau 'housing_photos_ibfk_1' mungkin masih ada
      // Kita coba hapus constraint namanya housing_photos_ibfk_1, biasanya indexnya ngikut atau terpisah.
      // Untuk amannya, kita biarkan indexnya jika tidak mengganggu, atau coba drop jika mau bersih total.
      // Di sini kita fokus ke FK-nya saja karena itu yang bikin error insert.
    } catch (e) {
      console.log('⚠️  Warning saat menghapus index (diabaikan).');
    }

    console.log('🎉 Perbaikan selesai! Silakan coba submit form kembali.');

  } catch (error) {
    console.error('❌ GAGAL: Terjadi kesalahan saat menjalankan skrip:');
    console.error(error.message);
  } finally {
    // Tutup koneksi agar proses node berhenti
    await sequelize.close();
  }
}

fixHousingPhotosConstraint();