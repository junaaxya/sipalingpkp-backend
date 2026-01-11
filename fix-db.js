// fix-db.js
const { sequelize } = require('./src/models');

async function run() {
  try {
    const ngrokUri = 'http://localhost:8000/api/auth/oauth/google/callback';
    
    console.log(`⏳ Memperbarui database ke URL Ngrok: ${ngrokUri}...`);

    await sequelize.query(
      "UPDATE oauth_providers SET redirect_uri = :uri WHERE name = 'google'",
      {
        replacements: { uri: ngrokUri },
        type: sequelize.QueryTypes.UPDATE
      }
    );

    console.log(`✅ Berhasil! Redirect URI sekarang menggunakan Ngrok.`);
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await sequelize.close();
    process.exit();
  }
}

run();