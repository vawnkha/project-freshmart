const { z } = require("zod");
const { CLASS_NAMES, ALL_CLASS_NAMES, VIETNAMESE_LABELS } = require("../config/shrimp-diagnosis");
const params = z.object({ id: z.string().regex(/^[a-f\d]{24}$/i) });
const date = z.string().datetime({ offset: true });
const listQuery = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(30).default(8),
  className: z.enum(ALL_CLASS_NAMES).optional(),
  from: date.optional(), to: date.optional(),
}).strict().refine(q => !q.from || !q.to || new Date(q.from) <= new Date(q.to), "Khoảng ngày không hợp lệ");
const label = z.object({ classIndex: z.number().int().min(0).max(3), className: z.enum(CLASS_NAMES), classNameVi: z.enum(Object.values(VIETNAMESE_LABELS)) });
const probability = z.number().finite().min(0).max(1);
const inferenceResult = z.object({
  prediction: label.extend({ confidence: probability, probabilities: z.array(label.extend({ probability })).length(4), confidenceThreshold: probability, lowConfidence: z.boolean() }),
  model: z.object({ name: z.literal("ConvNeXtV2-Tiny"), modelId: z.literal("convnextv2_tiny.fcmae_ft_in1k"),
    version: z.literal("f5327345f0c3bd0bd4df7315e72b49e406185979cad1b89803c6ffe85545aa24"),
    experimentHash: z.literal("94eb2b7098910e"), seed: z.literal(42), bestEpoch: z.literal(26) }),
}).superRefine(({ prediction: p }, ctx) => {
  const validLabel = (row, i) => row.classIndex === i && row.className === CLASS_NAMES[i] && row.classNameVi === VIETNAMESE_LABELS[row.className];
  const rows = p.probabilities, sum = rows.reduce((total, row) => total + row.probability, 0);
  const supported = CLASS_NAMES;
  const names = new Set(rows.map(row => row.className)), best = rows[p.classIndex];
  if (supported.length !== rows.length || names.size !== rows.length || !supported.every(name => names.has(name)) ||
      !validLabel(p, p.classIndex) || !rows.every(validLabel) || Math.abs(sum - 1) > 1e-5 ||
      !best || best.className !== p.className || Math.abs(p.confidence - best.probability) > 1e-6 || rows.some(row => row.probability > p.confidence + 1e-6) || p.lowConfidence !== (p.confidence < p.confidenceThreshold)) {
    ctx.addIssue({ code: "custom", message: "Kết quả AI không khớp checkpoint ConvNeXtV2-Tiny bốn lớp" });
  }
});
module.exports = { params, listQuery, inferenceResult };
