const { sequelize } = require('../models');

async function resetDatabase() {
  try {
    console.log('⏳ Menghubungkan ke database...');
    await sequelize.authenticate();
    
    console.log('⚠️  Sedang menghapus dan membuat ulang semua tabel (RESET TOTAL)...');
    
    // force: true akan menjalankan DROP TABLE IF EXISTS kemudian CREATE TABLE untuk semua model
    await sequelize.sync({ force: true });
    
    console.log('✅ Database berhasil dikosongkan secara total!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Gagal mereset database:', error);
    process.exit(1);
  }
}

resetDatabase();