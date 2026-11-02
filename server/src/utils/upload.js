const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

const hasCloudinary = () =>
  !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

const uploadDir = path.join(__dirname, '..', '..', 'uploads');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
});

const storeLocal = (file) => {
  fs.mkdirSync(uploadDir, { recursive: true });
  const ext = path.extname(file.originalname).replace(/[^.\w]/g, '');
  const filename = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
  fs.writeFileSync(path.join(uploadDir, filename), file.buffer);
  return { name: file.originalname, url: `/uploads/${filename}`, size: file.size, mimeType: file.mimetype };
};

/**
 * Stores a multer memory file in Cloudinary when it is configured, otherwise on local disk.
 * If Cloudinary rejects the upload (for example a wrong cloud name), the file is saved locally
 * and the reason is logged, so a misconfigured account never blocks the user.
 */
const storeFile = async (file, folder = 'taskflow') => {
  if (hasCloudinary()) {
    try {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });
      const result = await new Promise((resolve, reject) => {
        cloudinary.uploader
          .upload_stream({ folder, resource_type: 'auto' }, (err, r) => (err ? reject(err) : resolve(r)))
          .end(file.buffer);
      });
      return { name: file.originalname, url: result.secure_url, size: file.size, mimeType: file.mimetype };
    } catch (err) {
      console.error(`Cloudinary upload failed (${err.message}). Saved locally instead. Check CLOUDINARY_* in server/.env`);
    }
  }
  return storeLocal(file);
};

module.exports = { upload, storeFile, uploadDir };
