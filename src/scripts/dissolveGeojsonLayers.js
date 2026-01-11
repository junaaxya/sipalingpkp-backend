const fs = require('fs');
const path = require('path');
const turf = require('@turf/turf');

const TARGET_LAYERS = [
  {
    category: 'bencana',
    filename: 'krb_banjir_tinggi',
    label: 'Rawan Bencana Banjir Tingkat Tinggi',
    propertyKey: 'KRB03_',
  },
  {
    category: 'bencana',
    filename: 'krb_cuaca_ekstrem_tinggi',
    label: 'Rawan Bencana Cuaca Ekstrem Tingkat Tinggi',
    propertyKey: 'KRB03_',
  },
  {
    category: 'bencana',
    filename: 'krb_kebakaran_hutan_tinggi',
    label: 'Rawan Bencana Kebakaran Hutan dan Lahan Tingkat Tinggi',
    propertyKey: 'KRB03_',
  },
  {
    category: 'tata_ruang',
    filename: 'rtrw_hutan_produksi',
    label: 'Hutan Produksi',
    propertyKey: 'Pola_Ruang',
  },
];

const BASE_DIR = path.join(process.cwd(), 'data_peta_profesional');

const ensureBackup = (filePath) => {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${filePath}.bak_dissolve_${stamp}`;
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(filePath, backupPath);
  }
};

const isPolygonLike = (feature) => {
  const type = feature?.geometry?.type;
  return type === 'Polygon' || type === 'MultiPolygon';
};

const dissolveAll = (features) => {
  const prepared = features.map((feature) => ({
    ...feature,
    properties: {
      ...(feature.properties || {}),
      __group: 'all',
    },
  }));

  const collection = turf.featureCollection(prepared);
  const dissolved = turf.dissolve(collection, { propertyName: '__group' });
  if (!dissolved?.features?.length) {
    return null;
  }

  return dissolved.features;
};

const combineFallback = (features) => {
  try {
    const combined = turf.combine(turf.featureCollection(features));
    return combined?.features?.length ? combined.features : null;
  } catch (error) {
    return null;
  }
};

const processFile = ({ category, filename, label, propertyKey }) => {
  const filePath = path.join(BASE_DIR, category, `${filename}.geojson`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`GeoJSON not found: ${filePath}`);
  }

  ensureBackup(filePath);

  const raw = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);
  const originalFeatures = Array.isArray(data?.features) ? data.features : [];
  const polygonFeatures = originalFeatures.filter(isPolygonLike);

  if (!polygonFeatures.length) {
    return { filePath, before: originalFeatures.length, after: 0 };
  }

  let outputFeatures = null;
  try {
    outputFeatures = dissolveAll(polygonFeatures);
  } catch (error) {
    outputFeatures = null;
  }

  if (!outputFeatures) {
    outputFeatures = combineFallback(polygonFeatures);
  }

  if (!outputFeatures) {
    throw new Error(`Failed to dissolve features for ${filePath}`);
  }

  if (outputFeatures.length > 1) {
    const combined = combineFallback(outputFeatures);
    if (combined?.length) {
      outputFeatures = combined;
    }
  }

  outputFeatures.forEach((feature) => {
    feature.properties = {
      ...(propertyKey ? { [propertyKey]: label } : {}),
    };
  });

  const nextData = {
    ...data,
    features: outputFeatures,
  };

  fs.writeFileSync(filePath, JSON.stringify(nextData));

  return {
    filePath,
    before: polygonFeatures.length,
    after: outputFeatures.length,
  };
};

const run = () => {
  const results = [];
  TARGET_LAYERS.forEach((layer) => {
    results.push(processFile(layer));
  });
  return results;
};

const results = run();
results.forEach((result) => {
  console.log(
    `${result.filePath} -> features ${result.before} => ${result.after}`
  );
});
