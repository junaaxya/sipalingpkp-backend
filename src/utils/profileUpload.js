const fs = require('fs');
const path = require('path');
const { generateId } = require('../config/nanoid');
const { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } = require('./fileUpload');

const STORAGE_DRIVER = (process.env.STORAGE_DRIVER || 'local').toLowerCase();
const S3_BUCKET = process.env.STORAGE_S3_BUCKET || process.env.S3_BUCKET || '';
const S3_ENDPOINT = process.env.STORAGE_S3_ENDPOINT || process.env.S3_ENDPOINT || '';
const S3_REGION = process.env.STORAGE_S3_REGION || process.env.S3_REGION || 'us-east-1';
const S3_ACCESS_KEY = process.env.STORAGE_S3_ACCESS_KEY || process.env.S3_ACCESS_KEY || '';
const S3_SECRET_KEY = process.env.STORAGE_S3_SECRET_KEY || process.env.S3_SECRET_KEY || '';
const S3_FORCE_PATH_STYLE_RAW =
  process.env.STORAGE_S3_FORCE_PATH_STYLE || process.env.S3_FORCE_PATH_STYLE || '';
const S3_FORCE_PATH_STYLE = S3_FORCE_PATH_STYLE_RAW
  ? String(S3_FORCE_PATH_STYLE_RAW).toLowerCase() === 'true'
  : true;

let cachedS3Client = null;

const isS3Driver = () => STORAGE_DRIVER === 's3';

const loadS3Module = () => {
  try {
    return require('@aws-sdk/client-s3');
  } catch (error) {
    throw new Error('S3 driver requires @aws-sdk/client-s3. Please install the package.');
  }
};

const getS3Client = () => {
  if (cachedS3Client) return cachedS3Client;
  const { S3Client } = loadS3Module();
  if (!S3_ENDPOINT || !S3_ACCESS_KEY || !S3_SECRET_KEY || !S3_BUCKET) {
    throw new Error('S3 storage is missing required environment variables.');
  }
  cachedS3Client = new S3Client({
    region: S3_REGION,
    endpoint: S3_ENDPOINT,
    credentials: {
      accessKeyId: S3_ACCESS_KEY,
      secretAccessKey: S3_SECRET_KEY,
    },
    forcePathStyle: S3_FORCE_PATH_STYLE,
  });
  return cachedS3Client;
};

const PROFILE_UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'profiles');

const validateProfileFile = (file) => {
  if (!file) {
    return { valid: false, error: 'File is required' };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    };
  }

  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return {
      valid: false,
      error: `File type ${file.mimetype} is not allowed. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`,
    };
  }

  return { valid: true };
};

const saveProfileAvatar = async (file, userId) => {
  const validation = validateProfileFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const extension = file.mimetype.split('/')[1] || 'jpg';
  const fileName = `avatar_${userId}_${Date.now()}_${generateId()}.${extension}`;
  const relativePath = path.posix.join('profiles', userId, fileName);

  if (isS3Driver()) {
    const { PutObjectCommand } = loadS3Module();
    const client = getS3Client();
    await client.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: relativePath,
      Body: file.buffer,
      ContentType: file.mimetype,
      ContentLength: file.size,
    }));

    return {
      filePath: relativePath,
      relativePath,
      mimeType: file.mimetype,
      fileSize: file.size,
    };
  }

  const userDir = path.join(PROFILE_UPLOAD_DIR, userId);
  await fs.promises.mkdir(userDir, { recursive: true });

  const filePath = path.join(userDir, fileName);

  await fs.promises.writeFile(filePath, file.buffer);

  return {
    filePath,
    relativePath,
    mimeType: file.mimetype,
    fileSize: file.size,
  };
};

module.exports = {
  saveProfileAvatar,
};
