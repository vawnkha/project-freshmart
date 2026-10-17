const MongoDB = require("../utils/mongodb.util");
const ProductService = require("../services/products.service");
const ApiError = require("../api-error");

function normalizeText(text = "") {
  return String(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const STOP_WORDS = [
  "cua",
  "hang",
  "co",
  "ban",
  "khong",
  "ko",
  "k",
  "la",
  "gia",
  "bao",
  "nhieu",
  "bn",
  "con",
  "hay",
  "va",
  "voi",
  "cho",
  "xin",
  "toi",
  "minh",
  "hom",
  "nay",
  "loai",
  "cac",
  "san",
  "pham",
  "gi",
  "tim", "can", "muon", "tu", "van", "toi", "duoc",
];

function getKeywords(message = "") {
  return normalizeText(message)
    .split(/\s+/)
    .filter((word) => word && !STOP_WORDS.includes(word));
}

function countMatchedWords(text = "", keywords = []) {
  if (!text || !keywords.length) return 0;
  return keywords.filter((word) => text.includes(word)).length;
}

function scoreProduct(product, normalizedMessage, keywords) {
  const name = normalizeText(product.name || "");
  const searchText = normalizeText(product.search_text || "");

  if (!name && !searchText) return 0;
  if (!keywords.length && !normalizedMessage) return 0;

  let score = 0;
  const nameMatchCount = countMatchedWords(name, keywords);
  const searchMatchCount = countMatchedWords(searchText, keywords);

  if (name === normalizedMessage) score += 1000;
  if (name.includes(normalizedMessage) && normalizedMessage) score += 700;

  if (searchText === normalizedMessage) score += 500;
  if (searchText.includes(normalizedMessage) && normalizedMessage) score += 300;

  score += nameMatchCount * 120;
  score += searchMatchCount * 60;

  if (keywords.length > 0 && nameMatchCount === keywords.length) {
    score += 500;
  }

  if (keywords.length > 0 && searchMatchCount === keywords.length) {
    score += 200;
  }

  return score;
}

async function callGroq(userMessage, products) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new ApiError(503, "Dịch vụ AI chưa được cấu hình");

  const productContext = products.length
    ? products
        .map(
          (p, i) =>
            `${i + 1}. ${p.name} | Giá: ${Number(p.price || 0).toLocaleString("vi-VN")} VND | Tồn kho: ${p.stock || 0}`,
        )
        .join("\n")
    : "Không có sản phẩm phù hợp.";

  const prompt = `
Bạn là trợ lý tìm sản phẩm cho website chế phẩm sinh học và sản phẩm phục vụ nuôi tôm.
Chỉ trả lời dựa trên dữ liệu sản phẩm bên dưới.
Không tự tạo công dụng, liều dùng, chứng nhận hoặc cam kết điều trị. Không coi hàng trong lô khóa là còn hàng.
Nếu không có dữ liệu phù hợp thì nói rõ là chưa tìm thấy sản phẩm phù hợp.
Nếu có dữ liệu phù hợp mà số lượng tồn kho là 0 thì nói rõ có bán sản phẩm nhưng đã hết hàng.

Câu hỏi người dùng:
${userMessage}

Dữ liệu sản phẩm:
${productContext}
`;

  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(15_000),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "Groq API error");
  }

  const reply = data?.choices?.[0]?.message?.content;
  if (typeof reply !== "string" || !reply.trim()) throw new ApiError(502, "Dịch vụ AI chưa trả lời được. Vui lòng thử lại.");
  return reply;
}

exports.chat = async (req, res, next) => {
  try {
    const productService = new ProductService(MongoDB.client);

    const message = String(req.body?.message || "").trim();
    if (!message) {
      return res.status(400).json({ message: "Thiếu nội dung câu hỏi." });
    }

    const normalizedMessage = normalizeText(message);
    const keywords = getKeywords(message);
    const allProducts = await productService.getProductsForAI(keywords.join(" "), 50);

    const scoredProducts = (allProducts || [])
      .map((p) => {
        const name = normalizeText(p.name || "");
        const searchText = normalizeText(p.search_text || "");
        const nameMatchCount = countMatchedWords(name, keywords);
        const searchMatchCount = countMatchedWords(searchText, keywords);
        const matchScore = scoreProduct(p, normalizedMessage, keywords);

        return {
          ...p,
          nameMatchCount,
          searchMatchCount,
          matchScore,
        };
      })
      .filter((p) => {
        if (!keywords.length) return false;

        return keywords.some((word) =>
          normalizeText(p.name || "").includes(word) || normalizeText(p.search_text || "").includes(word),
        );
      })
      .sort((a, b) => {
        if (b.nameMatchCount !== a.nameMatchCount) {
          return b.nameMatchCount - a.nameMatchCount;
        }
        return b.matchScore - a.matchScore;
      });

    const bestNameMatchCount = scoredProducts[0]?.nameMatchCount || 0;
    const bestScore = scoredProducts[0]?.matchScore || 0;

    const matchedProducts = scoredProducts.filter((p) => {
      if (bestNameMatchCount > 0) {
        return (
          p.nameMatchCount >= bestNameMatchCount ||
          p.matchScore >= Math.max(150, bestScore * 0.5)
        );
      }

      return p.matchScore >= Math.max(120, bestScore * 0.6);
    });

    const topProducts = matchedProducts.slice(0, 5);
    const reply = await callGroq(message, topProducts);

    return res.json({
      reply,
      products: topProducts.map((p) => ({
        _id: p._id,
        name: p.name,
        price: p.price,
        stock: p.stock,
        availableStock: p.availableStock,
        unit: p.unit,
        thumbnail: p.thumbnail,
        status: p.status,
      })),
    });
  } catch (error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      return next(new ApiError(504, "Dịch vụ AI phản hồi quá lâu. Vui lòng thử lại."));
    }
    next(error);
  }
};
