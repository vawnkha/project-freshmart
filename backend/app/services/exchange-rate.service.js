const axios = require("axios");

const DEFAULT_FALLBACK_USD_VND_RATE = 25000;
const DEFAULT_CACHE_TTL_MINUTES = 360;

let rateCache = null;
let pendingRequest = null;

function getFallbackRate() {
  const fallback = Number(
    process.env.PAYPAL_USD_RATE || DEFAULT_FALLBACK_USD_VND_RATE,
  );
  return Number.isFinite(fallback) && fallback > 0
    ? fallback
    : DEFAULT_FALLBACK_USD_VND_RATE;
}

function getCacheTtlMs() {
  const ttlMinutes = Number(
    process.env.EXCHANGE_RATE_CACHE_TTL_MINUTES || DEFAULT_CACHE_TTL_MINUTES,
  );
  const safeTtl =
    Number.isFinite(ttlMinutes) && ttlMinutes > 0
      ? ttlMinutes
      : DEFAULT_CACHE_TTL_MINUTES;
  return safeTtl * 60 * 1000;
}

function normalizeRate(rate) {
  const value = Number(rate);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Invalid USD/VND exchange rate");
  }
  return value;
}

function buildCacheEntry({ rate, source, fetchedAt = new Date() }) {
  const fetchedAtDate =
    fetchedAt instanceof Date ? fetchedAt : new Date(fetchedAt || Date.now());

  return {
    rate: normalizeRate(rate),
    source,
    fetchedAt: fetchedAtDate,
    expiresAt: new Date(fetchedAtDate.getTime() + getCacheTtlMs()),
  };
}

function isCacheValid() {
  return rateCache && rateCache.expiresAt.getTime() > Date.now();
}

function readUsdVndRateFromPayload(payload = {}) {
  if (payload.conversion_rate !== undefined) {
    return payload.conversion_rate;
  }

  if (payload.result === "success" && payload.conversion_rate !== undefined) {
    return payload.conversion_rate;
  }

  if (payload.rates?.VND !== undefined) {
    return payload.rates.VND;
  }

  if (payload.data?.VND !== undefined) {
    return payload.data.VND;
  }

  if (payload.usd?.vnd !== undefined) {
    return payload.usd.vnd;
  }

  throw new Error("USD/VND rate not found in provider response");
}

async function fetchUsdVndRateFromProvider() {
  const provider = String(
    process.env.EXCHANGE_RATE_PROVIDER || "exchangerate-api",
  )
    .trim()
    .toLowerCase();
  const apiKey = process.env.EXCHANGE_RATE_API_KEY;

  let url = process.env.EXCHANGE_RATE_API_URL;
  let source = provider;

  if (!url && provider === "exchangerate-api" && apiKey) {
    url = `https://v6.exchangerate-api.com/v6/${apiKey}/pair/USD/VND`;
    source = "exchangerate-api";
  }

  if (!url && provider === "exchangerate-api") {
    url = "https://open.er-api.com/v6/latest/USD";
    source = "open.er-api";
  }

  if (!url) {
    throw new Error(`Unsupported exchange rate provider: ${provider}`);
  }

  const response = await axios.get(url, { timeout: 8000 });
  const rate = readUsdVndRateFromPayload(response.data);

  return buildCacheEntry({
    rate,
    source,
    fetchedAt: new Date(),
  });
}

function getFallbackRateInfo(error) {
  const fetchedAt = new Date();
  const fallbackEntry = buildCacheEntry({
    rate: getFallbackRate(),
    source: "env:PAYPAL_USD_RATE",
    fetchedAt,
  });

  return {
    ...fallbackEntry,
    fallback: true,
    error: error?.message || "Exchange rate provider unavailable",
  };
}

async function getUsdVndRate(options = {}) {
  if (!options.forceRefresh && isCacheValid()) {
    return {
      ...rateCache,
      fromCache: true,
      fallback: rateCache.source === "env:PAYPAL_USD_RATE",
    };
  }

  if (!pendingRequest) {
    pendingRequest = fetchUsdVndRateFromProvider()
      .then((entry) => {
        rateCache = entry;
        return {
          ...entry,
          fromCache: false,
          fallback: false,
        };
      })
      .catch((error) => {
        const fallbackInfo = getFallbackRateInfo(error);
        rateCache = fallbackInfo;
        console.warn("[ExchangeRate] Using fallback USD/VND rate", {
          source: fallbackInfo.source,
          rate: fallbackInfo.rate,
          error: fallbackInfo.error,
        });
        return {
          ...fallbackInfo,
          fromCache: false,
        };
      })
      .finally(() => {
        pendingRequest = null;
      });
  }

  return pendingRequest;
}

async function convertVndToUsd(vndAmount) {
  const amountVnd = Number(vndAmount || 0);
  const safeAmountVnd = Number.isFinite(amountVnd) ? Math.max(0, amountVnd) : 0;
  const rateInfo = await getUsdVndRate();
  const amountUsd = Number((safeAmountVnd / rateInfo.rate).toFixed(2));

  return {
    amountVnd: safeAmountVnd,
    amountUsd,
    exchangeRate: rateInfo.rate,
    exchangeRateSource: rateInfo.source,
    exchangeRateFetchedAt: rateInfo.fetchedAt,
    exchangeRateExpiresAt: rateInfo.expiresAt,
    fromCache: rateInfo.fromCache,
    fallback: rateInfo.fallback,
  };
}

function clearExchangeRateCache() {
  rateCache = null;
  pendingRequest = null;
}

module.exports = {
  clearExchangeRateCache,
  convertVndToUsd,
  getUsdVndRate,
};
