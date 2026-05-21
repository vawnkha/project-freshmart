const MongoDB = require("../utils/mongodb.util");
const ProductService = require("../services/products.service");

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

  const productContext = products.length
    ? products
        .map(
          (p, i) =>
            `${i + 1}. ${p.name} | Giá: ${Number(p.price || 0).toLocaleString("vi-VN")} VND | Tồn kho: ${p.stock || 0}`,
        )
        .join("\n")
    : "Không có sản phẩm phù hợp.";

  const prompt = `
Bạn là trợ lý AI cho website bán thực phẩm.
Chỉ trả lời dựa trên dữ liệu sản phẩm bên dưới.
Nếu không có dữ liệu phù hợp thì nói rõ là chưa tìm thấy sản phẩm phù hợp.
Nếu có dữ liệu phù hợp mà số lượng tồn kho là 0 thì nó rõ có bán sản phẩm nhưng đã hết hàng.

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
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "Groq API error");
  }

  return data?.choices?.[0]?.message?.content || "Không có phản hồi.";
}

exports.chat = async (req, res, next) => {
  try {
    const productService = new ProductService(MongoDB.client);

    const message = String(req.body?.message || "").trim();
    if (!message) {
      return res.status(400).json({ message: "Thiếu nội dung câu hỏi." });
    }

    const allProducts = await productService.getProductsForAI();
    const normalizedMessage = normalizeText(message);
    const keywords = getKeywords(message);

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
          normalizeText(p.name || "").includes(word),
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
        unit: p.unit,
        thumbnail: p.thumbnail,
        status: p.status,
      })),
    });
  } catch (error) {
    next(error);
  }
};
