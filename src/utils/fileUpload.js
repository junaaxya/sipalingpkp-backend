const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { generateId } = require('../config/nanoid');

// Allowed MIME types for images
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
];

// Maximum file size (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes

// Upload directory structure: uploads/housing/{entity_type}/{entity_id}/
const UPLOAD_BASE_DIR = path.join(process.cwd(), 'uploads', 'housing');
const STORAGE_DRIVER = (process.env.STORAGE_DRIVER || 'local').toLowerCase();
const S3_BUCKET = process.env.STORAGE_S3_BUCKET || process.env.S3_BUCKET || '';
const S3_ENDPOINT = process.env.STORAGE_S3_ENDPOINT || process.env.S3_ENDPOINT || '';
const S3_REGION = process.env.STORAGE_S3_REGION || process.env.S3_REGION || 'us-east-1';
const S3_ACCESS_KEY = process.env.STORAGE_S3_ACCESS_KEY || process.env.S3_ACCESS_KEY || '';
const S3_SECRET_KEY = process.env.STORAGE_S3_SECRET_KEY || process.env.S3_SECRET_KEY || '';
const S3_PUBLIC_URL = process.env.STORAGE_S3_PUBLIC_URL || process.env.S3_PUBLIC_URL || '';
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

const normalizeStorageKey = (value) =>
  String(value || '').replace(/\\/g, '/').replace(/^\/+/, '');

/**
 * Validate file
 * @param {Object} file - File object with mimetype and size
 * @returns {Object} - { valid: boolean, error?: string }
 */
function validateFile(file) {
  if (!file) {
    return { valid: false, error: 'File is required' };
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    };
  }

  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return {
      valid: false,
      error: `File type ${file.mimetype} is not allowed. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`,
    };
  }

  return { valid: true };
}

/**
 * Generate file name
 * @param {string} entityType - Entity type (house_data, water_access, etc)
 * @param {string} entityId - Entity ID
 * @param {string} mimeType - MIME type
 * @returns {string} - Generated file name
 */
function generateFileName(entityType, entityId, mimeType) {
  const timestamp = Date.now();
  const extension = mimeType.split('/')[1]; // e.g., 'jpeg', 'png'
  const uniqueId = generateId();
  return `${entityType}_${entityId}_${timestamp}_${uniqueId}.${extension}`;
}

/**
 * Get file path for entity
 * @param {string} entityType - Entity type
 * @param {string} entityId - Entity ID
 * @returns {string} - Directory path
 */
function getEntityUploadPath(entityType, entityId) {
  return path.join(UPLOAD_BASE_DIR, entityType, entityId);
}

/**
 * Save uploaded file
 * @param {Object} file - File object (from multer or similar)
 * @param {string} entityType - Entity type (house_data, water_access, etc)
 * @param {string} entityId - Entity ID
 * @returns {Promise<Object>} - { filePath, relativePath, mimeType, fileSize }
 */
async function saveFile(file, entityType, entityId) {
  // Validate file
  const validation = validateFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Generate file name
  const fileName = generateFileName(entityType, entityId, file.mimetype);
  const relativePath = path.posix.join('housing', entityType, entityId, fileName);

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

  // Get upload directory
  const uploadDir = getEntityUploadPath(entityType, entityId);

  // Create directory if it doesn't exist
  await fsp.mkdir(uploadDir, { recursive: true });

  const filePath = path.join(uploadDir, fileName);

  // Save file
  await fsp.writeFile(filePath, file.buffer);

  return {
    filePath,
    relativePath,
    mimeType: file.mimetype,
    fileSize: file.size,
  };
}

/**
 * Delete file
 * @param {string} relativePath - Relative path from uploads directory
 * @returns {Promise<void>}
 */
async function deleteFile(relativePath) {
  if (isS3Driver()) {
    const { DeleteObjectCommand } = loadS3Module();
    const client = getS3Client();
    const key = normalizeStorageKey(relativePath);
    if (!key) return;
    await client.send(new DeleteObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    }));
    return;
  }

  try {
    const fullPath = path.join(process.cwd(), 'uploads', relativePath);
    await fsp.unlink(fullPath);
  } catch (error) {
    // File might not exist, ignore error
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

/**
 * Delete all files for an entity
 * @param {string} entityType - Entity type
 * @param {string} entityId - Entity ID
 * @returns {Promise<void>}
 */
async function deleteEntityFiles(entityType, entityId) {
  if (isS3Driver()) {
    const {
      ListObjectsV2Command,
      DeleteObjectsCommand,
    } = loadS3Module();
    const client = getS3Client();
    const prefix = path.posix.join('housing', entityType, entityId, '/');
    let continuationToken;
    do {
      const listResponse = await client.send(new ListObjectsV2Command({
        Bucket: S3_BUCKET,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }));
      const objects = (listResponse.Contents || [])
        .map((item) => ({ Key: item.Key }))
        .filter((item) => item.Key);
      if (objects.length) {
        await client.send(new DeleteObjectsCommand({
          Bucket: S3_BUCKET,
          Delete: { Objects: objects, Quiet: true },
        }));
      }
      continuationToken = listResponse.IsTruncated
        ? listResponse.NextContinuationToken
        : undefined;
    } while (continuationToken);
    return;
  }

  try {
    const uploadDir = getEntityUploadPath(entityType, entityId);
    await fsp.rm(uploadDir, { recursive: true, force: true });
  } catch (error) {
    // Directory might not exist, ignore error
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

/**
 * Get public URL for file
 * @param {string} relativePath - Relative path from uploads directory
 * @returns {string} - Public URL
 */
function getPublicUrl(relativePath) {
  const key = normalizeStorageKey(relativePath);
  if (!key) return '';

  if (isS3Driver()) {
    const publicBase = (S3_PUBLIC_URL || '').replace(/\/$/, '');
    if (publicBase && S3_BUCKET) {
      return `${publicBase}/${S3_BUCKET}/${key}`;
    }
    return `/api/files/${key}`;
  }

  const baseUrl = process.env.FILE_BASE_URL || '/api/files';
  return `${baseUrl.replace(/\/$/, '')}/${key}`;
}

/**
 * Get file stream for storage driver
 * @param {string} relativePath
 * @returns {Promise<{stream: any, contentType?: string, contentLength?: number, cacheControl?: string}>}
 */
async function getFileStream(relativePath) {
  const key = normalizeStorageKey(relativePath);
  if (!key) return null;

  if (isS3Driver()) {
    const { GetObjectCommand } = loadS3Module();
    const client = getS3Client();
    const response = await client.send(new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    }));
    return {
      stream: response.Body,
      contentType: response.ContentType,
      contentLength: response.ContentLength,
      cacheControl: response.CacheControl,
    };
  }

  return {
    stream: fs.createReadStream(path.join(process.cwd(), 'uploads', key)),
  };
}

module.exports = {
  validateFile,
  saveFile,
  deleteFile,
  deleteEntityFiles,
  getPublicUrl,
  getFileStream,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
};
