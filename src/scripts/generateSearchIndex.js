const fs = require('fs').promises;
const path = require('path');
const { sequelize } = require('../models'); // Menggunakan koneksi database yang sudah ada

async function generateSearchIndex() {
  try {
    console.log('Menghasilkan indeks pencarian dari database...');

    const query = `
      SELECT 
        id, 
        layer_name as layer_id,
        CASE 
          WHEN layer_name = 'batas_desa' THEN properties->>'desa'
          WHEN layer_name = 'batas_kecamatan' THEN properties->>'name'
          WHEN layer_name = 'batas_kabupaten' THEN properties->>'name'
        END as name,
        CASE 
          WHEN layer_name = 'batas_desa' THEN 'KEC. ' || (properties->>'kecamatan') || ', ' || (properties->>'kab_kota')
          WHEN layer_name = 'batas_kecamatan' THEN (properties->>'name')
          ELSE 'PROVINSI BANGKA BELITUNG'
        END as parent,
        CASE 
          WHEN layer_name = 'batas_desa' THEN 'Desa'
          WHEN layer_name = 'batas_kecamatan' THEN 'Kecamatan'
          WHEN layer_name = 'batas_kabupaten' THEN 'Kabupaten'
        END as type,
        ST_Y(ST_Centroid(geom)) as lat,
        ST_X(ST_Centroid(geom)) as lng,
        CASE 
          WHEN layer_name = 'batas_desa' THEN 15
          WHEN layer_name = 'batas_kecamatan' THEN 13
          ELSE 11
        END as zoom
      FROM spatial_layers
      WHERE category = 'administrasi'
      ORDER BY type DESC, name ASC;
    `;

    const [results] = await sequelize.query(query);

    const searchIndex = results.map(row => ({
      id: row.id, // ID unik poligon dari database
      layer_id: row.layer_id, // Kategori layer (misal: batas_desa)
      name: row.name?.toUpperCase(),
      parent: row.parent?.toUpperCase(),
      type: row.type,
      coords: [parseFloat(row.lat), parseFloat(row.lng)],
      zoom: row.zoom
    }));

    const outputPath = path.join(process.cwd(), 'data_peta_profesional', 'search_index.json');
    await fs.writeFile(outputPath, JSON.stringify(searchIndex, null, 2));

    console.log(`✅ Berhasil! ${searchIndex.length} lokasi disimpan ke ${outputPath}`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Gagal menghasilkan indeks:', error);
    process.exit(1);
  }
}

generateSearchIndex();