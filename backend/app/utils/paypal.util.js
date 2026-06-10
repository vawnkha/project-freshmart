const axios = require("axios");
const { convertVndToUsd } = require("../services/exchange-rate.service");

const BASE_URL =
  process.env.PAYPAL_BASE_URL || "https://api-m.sandbox.paypal.com";

function getPaypalCurrency() {
  return String(process.env.PAYPAL_CURRENCY || "USD").trim().toUpperCase();
}

function formatPaypalAmount(amount) {
  const number = Number(amount || 0);
  return Number.isFinite(number) ? number.toFixed(2) : "0.00";
}

async function convertVndToPaypalAmount(vnd, currency = getPaypalCurrency()) {
  const totalVnd = Number(vnd || 0);
  const safeTotalVnd = Number.isFinite(totalVnd) ? Math.max(0, totalVnd) : 0;

  if (currency === "USD") {
    const conversion = await convertVndToUsd(safeTotalVnd);
    return {
      amount: conversion.amountUsd,
      amountValue: formatPaypalAmount(conversion.amountUsd),
      currency,
      exchangeRate: conversion.exchangeRate,
      exchangeRateSource: conversion.exchangeRateSource,
      exchangeRateFetchedAt: conversion.exchangeRateFetchedAt,
      exchangeRateExpiresAt: conversion.exchangeRateExpiresAt,
      fromCache: conversion.fromCache,
      fallback: conversion.fallback,
      totalVnd: safeTotalVnd,
      amountVnd: conversion.amountVnd,
      amountUsd: conversion.amountUsd,
    };
  }

  return {
    amount: safeTotalVnd,
    amountValue: formatPaypalAmount(safeTotalVnd),
    currency,
    exchangeRate: 1,
    exchangeRateSource: "none",
    exchangeRateFetchedAt: new Date(),
    exchangeRateExpiresAt: null,
    fromCache: false,
    fallback: false,
    totalVnd: safeTotalVnd,
    amountVnd: safeTotalVnd,
    amountUsd: null,
  };
}

function extractCapturedPaypalAmount(captureResponse = {}) {
  const purchaseUnit = captureResponse.purchase_units?.[0] || {};
  const capture = purchaseUnit.payments?.captures?.[0] || {};
  const amount = capture.amount || {};

  return {
    value: amount.value || null,
    amount: amount.value !== undefined ? Number(amount.value) : null,
    currency: amount.currency_code || null,
    captureId: capture.id || null,
    status: capture.status || null,
  };
}

function extractPaypalOrderAmount(orderResponse = {}) {
  const purchaseUnit = orderResponse.purchase_units?.[0] || {};
  const amount = purchaseUnit.amount || {};

  return {
    value: amount.value || null,
    amount: amount.value !== undefined ? Number(amount.value) : null,
    currency: amount.currency_code || null,
  };
}

async function getAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  const response = await axios.post(
    `${BASE_URL}/v1/oauth2/token`,
    "grant_type=client_credentials",
    {
      auth: {
        username: clientId,
        password: clientSecret,
      },
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    },
  );

  return response.data.access_token;
}

async function paypalGetOrder(paypalOrderId) {
  const accessToken = await getAccessToken();

  const response = await axios.get(
    `${BASE_URL}/v2/checkout/orders/${paypalOrderId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    },
  );

  return response.data;
}

async function paypalCreateOrder({ total, currency = "USD", referenceId }) {
  const accessToken = await getAccessToken();
  const value = typeof total === "string" ? total : formatPaypalAmount(total);

  const response = await axios.post(
    `${BASE_URL}/v2/checkout/orders`,
    {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: referenceId,
          amount: {
            currency_code: currency,
            value,
          },
        },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    },
  );

  return response.data;
}

async function paypalCaptureOrder(paypalOrderId) {
  const accessToken = await getAccessToken();

  const response = await axios.post(
    `${BASE_URL}/v2/checkout/orders/${paypalOrderId}/capture`,
    {},
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    },
  );

  return response.data;
}

module.exports = {
  convertVndToPaypalAmount,
  extractCapturedPaypalAmount,
  extractPaypalOrderAmount,
  formatPaypalAmount,
  getPaypalCurrency,
  paypalCreateOrder,
  paypalCaptureOrder,
  paypalGetOrder,
};
