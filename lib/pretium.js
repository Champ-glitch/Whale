// lib/pretium.js
// Wrapper around Pretium's stablecoin payment rail API.
// Every call goes through the same base URL with the consumer key header,
// per https://docs.pretium.africa. This module never marks anything as
// "complete" itself - that's the webhook's job.

const PRETIUM_BASE_URL = "https://api.xwift.africa";

const SUPPORTED_CHAINS = {
  CELO: ["USDT", "USDC", "CUSD"],
  BASE: ["USDC"],
  STELLAR: ["USDC"],
  TRON: ["USDT"],
  SCROLL: ["USDT"],
  SOLANA: ["USDT", "USDC"],
  POLYGON: ["USDT", "USDC"],
  ETHEREUM: ["USDT", "USDC"],
  BNB: ["USDT", "USDC"],
};

export function isSupportedChainAsset(chain, asset) {
  const upperChain = (chain || "").toUpperCase();
  const upperAsset = (asset || "").toUpperCase();
  return SUPPORTED_CHAINS[upperChain]?.includes(upperAsset) ?? false;
}

async function pretiumRequest(path, body) {
  const apiKey = process.env.PRETIUM_CONSUMER_KEY;
  if (!apiKey) {
    throw new Error("PRETIUM_CONSUMER_KEY is not configured");
  }

  const res = await fetch(`${PRETIUM_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok || data.code >= 400) {
    throw new Error(data?.message || `Pretium request failed (${res.status})`);
  }

  return data;
}

// ---- Exchange rate ----
export async function getExchangeRate(currencyCode = "KES") {
  const data = await pretiumRequest("/v1/exchange-rate", { currency_code: currencyCode });
  return data.data; // { buying_rate, selling_rate, quoted_rate }
}

// ---- Account / wallet info ----
export async function getAccountDetail() {
  const data = await pretiumRequest("/account/detail", {});
  return data.data; // { id, name, email, status, wallets[], networks[] }
}

// ---- Off-ramp: pay out KES from a stablecoin deposit ----
export async function payoutKES({ type, shortcode, accountNumber, bankCode, amount, fee, mobileNetwork, chain, transactionHash, callbackUrl }) {
  const body = {
    type, // MOBILE | BUY_GOODS | PAYBILL | BANK_TRANSFER
    shortcode,
    amount: Number(amount),
    chain,
    transaction_hash: transactionHash,
    callback_url: callbackUrl,
  };
  if (fee) body.fee = Number(fee);
  if (mobileNetwork) body.mobile_network = mobileNetwork;
  if (accountNumber) body.account_number = accountNumber;
  if (bankCode) body.bank_code = bankCode;

  return await pretiumRequest("/v1/pay/KES", body);
}

// ---- On-ramp: collect KES via M-Pesa, release stablecoin ----
export async function onrampKES({ shortcode, amount, mobileNetwork, chain, asset, address, callbackUrl }) {
  return await pretiumRequest("/v1/onramp/KES", {
    shortcode,
    amount: Number(amount),
    mobile_network: mobileNetwork,
    chain,
    asset,
    address,
    callback_url: callbackUrl,
  });
}

// ---- Status check (fallback if webhook is delayed) ----
export async function checkStatusKES(transactionCode) {
  const data = await pretiumRequest("/v1/status/KES", { transaction_code: transactionCode });
  return data.data;
}

// ---- Transaction history (Pretium limits range to ~3 days) ----
export async function getTransactionHistory(startDate, endDate) {
  const data = await pretiumRequest("/v1/transactions/KES", {
    start_date: startDate,
    end_date: endDate,
  });
  return data.data;
}

// ---- Refund (only for failed/unconfirmed transactions) ----
export async function refundTransaction(chain, transactionHash) {
  return await pretiumRequest("/v1/refund", { chain, transaction_hash: transactionHash });
}
