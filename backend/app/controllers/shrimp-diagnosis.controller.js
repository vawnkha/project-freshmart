const fs = require("node:fs/promises");
const MongoDB = require("../utils/mongodb.util");
const Service = require("../services/shrimp-diagnosis.service");
const handler = work => async (req, res, next) => {
  try { return await work(new Service(MongoDB.client), req, res); }
  catch (error) {
    // The global handler deliberately masks 5xx; expose only these curated errors.
    if (error.code?.startsWith("SHRIMP_AI_")) return res.status(error.statusCode).json({ message: error.message, code: error.code });
    return next(error);
  }
};
exports.create = handler(async (service, req, res) => res.status(201).json(await service.create(req.user.id, req.file)));
exports.list = handler(async (service, req, res) => res.json(await service.list(req.user.id, req.query)));
exports.detail = handler(async (service, req, res) => res.json(service.serialize(await service.detail(req.params.id, req.user.id))));
exports.remove = handler(async (service, req, res) => res.json(await service.remove(req.params.id, req.user.id)));
exports.image = handler(async (service, req, res) => {
  const record = await service.detail(req.params.id, req.user.id);
  let data;
  try { data = await fs.readFile(service.filePath(record.image.storageKey)); }
  catch (error) { if (error.code === "ENOENT") return res.status(404).json({ message: "Ảnh không còn khả dụng." }); throw error; }
  res.set({ "Content-Type": record.image.mimeType, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline" });
  return res.send(data);
});
