const fs = require('fs');
const path = require('path');
const turf = require('@turf/turf');

const TARGET_LAYERS = [
  { category: 'bencana', filename: 'krb_banjir_tinggi' },
  { category: 'bencana', filename: 'krb_cuaca_ekstrem_tinggi' },
  { category: 'bencana', filename: 'krb_kebakaran_hutan_tinggi' },
  { category: 'tata_ruang', filename: 'rtrw_hutan_produksi' },
];

const BASE_DIR = path.join(process.cwd(), 'data_peta_profesional');

const ensureBackup = (filePath) => {
  const backupPath = `${filePath}.bak`;
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(filePath, backupPath);
  }
};

const cleanFeature = (feature) => {
  if (!feature?.geometry) {
    return [];
  }

  let cleaned = feature;
  try {
    cleaned = turf.cleanCoords(feature, { mutate: false });
  } catch (error) {
    cleaned = feature;
  }

  let rewound = cleaned;
  try {
    rewound = turf.rewind(cleaned, { mutate: false, reverse: false });
  } catch (error) {
    rewound = cleaned;
  }

  const flattened = turf.flatten(rewound);
  const output = [];

  flattened.features.forEach((flatFeature) => {
    const finalFeatures = [];
    const hasKinks = (() => {
      try {
        const kinks = turf.kinks(flatFeature);
        return Boolean(kinks?.features?.length);
      } catch (error) {
        return false;
      }
    })();

    if (hasKinks) {
      try {
        const unkinked = turf.unkinkPolygon(flatFeature);
        if (unkinked?.features?.length) {
          finalFeatures.push(...unkinked.features);
        } else {
          finalFeatures.push(flatFeature);
        }
      } catch (error) {
        finalFeatures.push(flatFeature);
      }
    } else {
      finalFeatures.push(flatFeature);
    }

    finalFeatures.forEach((item) => {
      item.properties = { ...(rewound.properties || {}) };
      output.push(item);
    });
  });

  return output;
};

const processFile = ({ category, filename }) => {
  const filePath = path.join(BASE_DIR, category, `${filename}.geojson`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`GeoJSON not found: ${filePath}`);
  }

  ensureBackup(filePath);

  const raw = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);
  const features = Array.isArray(data?.features) ? data.features : [];
  const outputFeatures = [];

  features.forEach((feature) => {
    const cleaned = cleanFeature(feature);
    outputFeatures.push(...cleaned);
  });

  const cleanedData = {
    ...data,
    features: outputFeatures,
  };

  fs.writeFileSync(filePath, JSON.stringify(cleanedData));

  return {
    filePath,
    before: features.length,
    after: outputFeatures.length,
  };
};

const run = () => {
  const results = [];

  TARGET_LAYERS.forEach((layer) => {
    const result = processFile(layer);
    results.push(result);
  });

  return results;
};

const results = run();
results.forEach((result) => {
  console.log(
    `${result.filePath} -> features ${result.before} => ${result.after}`
  );
});
