const { z } = require("zod");
const {
  dateStringSchema,
  nonEmptyString,
  optionalNonNegativeNumberSchema,
  optionalString,
  statusEnum,
} = require("./common.validator");

const VALID_STATUSES = ["active", "inactive"];
const VALID_POSITIONS = ["home_hero", "home_middle", "home_bottom"];
const positionEnum = z.enum(VALID_POSITIONS, {
  message: "Vi tri banner khong hop le",
});

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function isNonNegativeNumber(value) {
  if (!hasValue(value)) return true;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0;
}

function isValidDate(value) {
  if (!hasValue(value)) return true;
  return !Number.isNaN(new Date(value).getTime());
}

function isValidPublicLink(value) {
  if (!hasValue(value)) return true;
  const link = String(value).trim();
  if (link.startsWith("/") && !link.startsWith("//")) return true;
  try {
    return ["http:", "https:"].includes(new URL(link).protocol);
  } catch (_) {
    return false;
  }
}

function validatePayload(payload = {}, options = {}) {
  if (options.requireImage && !hasValue(payload.imageUrl)) {
    return "imageUrl la bat buoc";
  }

  if (payload.status && !VALID_STATUSES.includes(String(payload.status))) {
    return "status khong hop le";
  }

  if (payload.position && !VALID_POSITIONS.includes(String(payload.position))) {
    return "position khong hop le";
  }

  if (!isNonNegativeNumber(payload.sortOrder)) {
    return "sortOrder phai la so khong am";
  }

  if (!isValidDate(payload.startDate)) return "startDate khong hop le";
  if (!isValidDate(payload.endDate)) return "endDate khong hop le";
  if (!isValidPublicLink(payload.link)) return "link khong hop le";

  if (hasValue(payload.startDate) && hasValue(payload.endDate)) {
    const startDate = new Date(payload.startDate);
    const endDate = new Date(payload.endDate);
    if (startDate.getTime() > endDate.getTime()) {
      return "endDate phai lon hon hoac bang startDate";
    }
  }

  return null;
}

function validateCreate(payload = {}) {
  return validatePayload(payload, { requireImage: true });
}

function validateUpdate(payload = {}) {
  if (!Object.keys(payload || {}).length) {
    return "Du lieu cap nhat khong duoc de trong";
  }

  return validatePayload(payload);
}

module.exports = {
  VALID_POSITIONS,
  VALID_STATUSES,
  createBannerSchema: z
    .object({
      title: optionalString,
      subtitle: optionalString,
      description: optionalString,
      imageUrl: nonEmptyString,
      mobileImageUrl: optionalString,
      link: optionalString,
      buttonText: optionalString,
      position: positionEnum.optional(),
      sortOrder: optionalNonNegativeNumberSchema.default(0),
      status: statusEnum.optional(),
      startDate: dateStringSchema,
      endDate: dateStringSchema,
    })
    .refine(
      (value) =>
        !value.startDate ||
        !value.endDate ||
        new Date(value.startDate).getTime() <=
          new Date(value.endDate).getTime(),
      {
        message: "endDate phai lon hon hoac bang startDate",
        path: ["endDate"],
      },
    ),
  updateBannerSchema: z
    .object({
      title: optionalString,
      subtitle: optionalString,
      description: optionalString,
      imageUrl: optionalString,
      mobileImageUrl: optionalString,
      link: optionalString,
      buttonText: optionalString,
      position: positionEnum.optional(),
      sortOrder: optionalNonNegativeNumberSchema,
      status: statusEnum.optional(),
      startDate: dateStringSchema,
      endDate: dateStringSchema,
    })
    .refine((value) => Object.keys(value).length > 0, {
      message: "Du lieu cap nhat khong duoc de trong",
    })
    .refine(
      (value) =>
        !value.startDate ||
        !value.endDate ||
        new Date(value.startDate).getTime() <=
          new Date(value.endDate).getTime(),
      {
        message: "endDate phai lon hon hoac bang startDate",
        path: ["endDate"],
      },
    ),
  validateCreate,
  validateUpdate,
};
