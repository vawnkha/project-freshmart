const fs = require("fs");
const path = require("path");

const UPLOAD_ROOT = path.resolve(__dirname, "../../public/uploads");

function resolveLocalUploadPath(scope, url) {
  if (!/^[a-z0-9-]+$/i.test(String(scope || ""))) return null;
  if (!url || typeof url !== "string") return null;

  const prefix = `/uploads/${scope}/`;
  const normalized = url.trim().replace(/\\/g, "/");
  if (!normalized.startsWith(prefix)) return null;

  const rawName = normalized.slice(prefix.length).split(/[?#]/, 1)[0];
  let filename;
  try {
    filename = decodeURIComponent(rawName);
  } catch (_) {
    return null;
  }

  if (
    !filename ||
    filename.includes("\0") ||
    filename !== path.basename(filename) ||
    filename.includes("/") ||
    filename.includes("\\")
  ) {
    return null;
  }

  const scopeRoot = path.resolve(UPLOAD_ROOT, scope);
  const resolved = path.resolve(scopeRoot, filename);
  return path.dirname(resolved) === scopeRoot ? resolved : null;
}

async function deleteLocalUpload(scope, url) {
  const filePath = resolveLocalUploadPath(scope, url);
  if (!filePath) return false;
  try {
    await fs.promises.unlink(filePath);
    return true;
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.warn(`Cannot delete local ${scope} upload:`, error.message);
    }
    return false;
  }
}

// Files can be reused by another record or embedded in CMS/order snapshots.
// Failure to inspect references leaves the file intact; DB deletion is already
// committed, so cleanup must never turn a successful DELETE into a false error.
async function deleteUnreferencedUpload(client, scope, url) {
  if (!resolveLocalUploadPath(scope, url)) return false;
  const escaped = url
    .split(/[?#]/, 1)[0]
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(escaped, "i");
  const fieldsByCollection = {
    categories: ["image_url"],
    products: ["thumbnail", "images", "description", "shortDescription"],
    news: ["thumbnail", "content", "summary"],
    banners: ["imageUrl", "mobileImageUrl", "description"],
    users: ["avatar_url"],
    orders: [
      "items.thumbnail",
      "items.image",
      "items.image_url",
      "items.images",
    ],
  };
  try {
    for (const [collection, fields] of Object.entries(fieldsByCollection)) {
      if (
        await client
          .db()
          .collection(collection)
          .findOne(
            { $or: fields.map((field) => ({ [field]: match })) },
            { projection: { _id: 1 } },
          )
      )
        return false;
    }
    return deleteLocalUpload(scope, url);
  } catch (error) {
    console.warn("Cannot inspect upload references:", error.message);
    return false;
  }
}

module.exports = {
  deleteLocalUpload,
  deleteUnreferencedUpload,
  resolveLocalUploadPath,
};
