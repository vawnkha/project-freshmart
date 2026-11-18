const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const axios = require("axios");
const sharp = require("sharp");
const { ObjectId } = require("mongodb");
const ApiError = require("../api-error");
const Repository = require("../repositories/shrimp-diagnosis.repository");
const { diagnosisConfig, MAX_BYTES, MAX_PIXELS } = require("../config/shrimp-diagnosis");
const { inferenceResult } = require("../validators/shrimp-diagnosis.validator");

class ShrimpDiagnosisService {
  constructor(client, { config = diagnosisConfig(), http = axios } = {}) {
    this.repository = new Repository(client); this.config = config; this.http = http;
  }
  filePath(key) {
    if (!/^[a-f\d-]{36}\.(jpg|png|webp)$/.test(key)) throw new Error("Invalid private storage key");
    return path.join(this.config.storageDir, key);
  }
  serialize(record) {
    const { deletedAt: _deletedAt, storageState: _storageState, image, ...rest } = record;
    const { storageKey: _key, ...publicImage } = image;
    return { ...rest, image: { ...publicImage, url: `/api/shrimp-diagnoses/${record._id}/image` } };
  }
  async validateImage(file) {
    if (!file?.buffer?.length || file.buffer.length > MAX_BYTES) throw new ApiError(400, "Ảnh rỗng hoặc vượt quá 5 MB.");
    try {
      const decoder = sharp(file.buffer, { failOn: "warning", limitInputPixels: MAX_PIXELS });
      const meta = await decoder.metadata();
      const formats = { "image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp" };
      if (!formats[file.mimetype] || formats[file.mimetype] !== meta.format || (meta.pages || 1) !== 1 || meta.width * meta.height > MAX_PIXELS) throw new Error("Invalid format or dimensions");
      // Decode every pixel: metadata/signature alone doesn't detect truncated images.
      await decoder.raw().toBuffer();
      return { extension: meta.format === "jpeg" ? "jpg" : meta.format, width: meta.width, height: meta.height };
    } catch (_) { throw new ApiError(400, "Ảnh không hợp lệ, sai định dạng, bị hỏng, là ảnh động hoặc vượt quá 20 triệu pixel."); }
  }
  async infer(file) {
    let data;
    try {
      ({ data } = await this.http.post(`${this.config.aiUrl.replace(/\/$/, "")}/predict`, file.buffer, {
        headers: { "Content-Type": file.mimetype, ...(this.config.apiKey ? { "X-AI-API-Key": this.config.apiKey } : {}) },
        timeout: this.config.timeout, maxBodyLength: MAX_BYTES, maxContentLength: 65536, proxy: false,
      }));
    } catch (error) {
      if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") throw new ApiError(504, "Phân tích ảnh quá thời gian chờ. Vui lòng thử lại.", "SHRIMP_AI_TIMEOUT");
      if (error.response?.status === 429) throw new ApiError(429, "Dịch vụ AI đang bận. Vui lòng thử lại sau.");
      throw new ApiError(503, "Dịch vụ chẩn đoán chưa sẵn sàng. Kiểm tra AI service và checkpoint.", "SHRIMP_AI_UNAVAILABLE");
    }
    const result = inferenceResult.safeParse(data);
    if (!result.success) throw new ApiError(502, "Dịch vụ AI trả kết quả không hợp lệ.", "SHRIMP_AI_INVALID_RESULT");
    return result.data;
  }
  async create(userId, file) {
    const meta = await this.validateImage(file);
    const result = await this.infer(file);
    const now = new Date(), key = `${crypto.randomUUID()}.${meta.extension}`;
    const record = {
      _id: new ObjectId(), userId: new ObjectId(String(userId)), storageState: "pending",
      image: { storageKey: key, originalName: path.basename(file.originalname || "image").slice(0, 255), mimeType: file.mimetype,
        size: file.buffer.length, width: meta.width, height: meta.height },
      ...result, capturedAt: null, createdAt: now, updatedAt: now,
    };
    await fs.mkdir(this.config.storageDir, { recursive: true });
    const target = this.filePath(key);
    try {
      // A hidden durable reservation makes a crash between DB and disk writes
      // discoverable. History only exposes records whose image is ready.
      await this.repository.collection.insertOne(record);
      await fs.writeFile(target, file.buffer, { flag: "wx" });
      const update = await this.repository.collection.updateOne({ _id: record._id, storageState: "pending" }, { $set: { storageState: "ready" } });
      if (update.modifiedCount !== 1) throw new Error("Diagnosis image reservation was lost");
      record.storageState = "ready";
    } catch (error) {
      let removed = false;
      try { await this.repository.collection.deleteOne({ _id: record._id }); removed = true; } catch (_) { /* durable reservation is reconciled later */ }
      // Keep disk data if DB acknowledgement is uncertain: a ready record must
      // never deliberately lose its image during an ambiguous write failure.
      if (removed) {
        try { await fs.unlink(target); } catch (cleanup) { if (cleanup.code !== "ENOENT") console.error("Diagnosis image cleanup failed", cleanup.code); }
      }
      throw error;
    }
    return this.serialize(record);
  }
  async detail(id, userId) {
    const record = await this.repository.findOwned(id, userId);
    if (!record) throw new ApiError(404, "Không tìm thấy lịch sử chẩn đoán.");
    return record;
  }
  async list(userId, query) {
    const result = await this.repository.list(userId, query);
    return { ...result, items: result.items.map(record => this.serialize(record)) };
  }
  async remove(id, userId) {
    const record = await this.detail(id, userId);
    // A persistent tombstone hides the item immediately and makes interrupted
    // deletion retryable after restart. All reads (including images) exclude it.
    await this.repository.collection.updateOne({ _id: record._id, userId: record.userId }, { $set: { deletedAt: new Date(), updatedAt: new Date() } });
    try {
      await fs.unlink(this.filePath(record.image.storageKey)).catch(error => { if (error.code !== "ENOENT") throw error; });
      await this.repository.collection.deleteOne({ _id: record._id, deletedAt: { $exists: true } });
    } catch (error) { console.error("Diagnosis deletion queued for retry", error.code); }
    return { deleted: true };
  }
  async reconcileStorage() {
    await fs.mkdir(this.config.storageDir, { recursive: true });
    const collection = this.repository.collection;
    for await (const record of collection.find({ $or: [{ deletedAt: { $exists: true } }, { storageState: "pending", createdAt: { $lt: new Date(Date.now() - 24 * 3600000) } }] })) {
      await fs.unlink(this.filePath(record.image.storageKey)).catch(error => { if (error.code !== "ENOENT") throw error; });
      await collection.deleteOne({ _id: record._id });
    }
    for (const key of await fs.readdir(this.config.storageDir)) {
      if (!/^[a-f\d-]{36}\.(jpg|png|webp)$/.test(key)) continue;
      const target = this.filePath(key), stat = await fs.stat(target);
      // Grace period protects a file between writeFile and insertOne.
      if (Date.now() - stat.mtimeMs > 24 * 3600000 && !await collection.findOne({ "image.storageKey": key }, { projection: { _id: 1 } })) await fs.unlink(target);
    }
  }
}
module.exports = ShrimpDiagnosisService;
