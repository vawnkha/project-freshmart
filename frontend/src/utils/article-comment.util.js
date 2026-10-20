export function commentContentError(value) {
  if (!String(value || "").trim()) return "Vui lòng nhập nội dung bình luận.";
  if (String(value).trim().length > 1000) return "Bình luận có tối đa 1.000 ký tự.";
  return "";
}

export function commentPage(response) {
  if (!Array.isArray(response?.data) || !Number.isSafeInteger(response?.meta?.total) || response.meta.total < 0 ||
      !Number.isSafeInteger(response.meta.page) || response.meta.page < 1 || typeof response.meta.hasMore !== "boolean" ||
      response.data.some(row => !row?._id || typeof row.content !== "string")) throw new TypeError("Invalid comment response");
  return response;
}

// Only article URLs supplied by the comment login link are accepted.
export function articleLoginReturn(value) {
  return typeof value === "string" && value.length <= 2048 && !/[\\\u0000-\u001f]/.test(value) &&
    /^\/blog\/[^/?#]+(?:[?#].*)?$/.test(value) ? value : "/";
}
