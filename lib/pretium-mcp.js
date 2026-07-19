// lib/pretium-mcp.js
// A minimal MCP (Model Context Protocol) client for Pretium's agent system.
// This is a completely separate system from lib/pretium.js (the general
// merchant REST API) - agents have their own balance, own withdrawal flow
// (no transaction_hash needed once funds are in the agent's balance), and
// their own spend policies enforced server-side by Pretium.

const MCP_URL = "https://mcp.pretium.africa/mcp";
let requestIdCounter = 1;

async function mcpCall(method, params = {}) {
  const apiKey = process.env.PRETIUM_CONSUMER_KEY;
  if (!apiKey) throw new Error("PRETIUM_CONSUMER_KEY is not configured");

  const id = requestIdCounter++;

  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });

  const rawText = await res.text();

  // The server responds in SSE format ("event: message\ndata: {...}").
  // Extract the JSON payload regardless of exact formatting.
  let payload;
  const dataLineMatch = rawText.match(/data:\s*(\{.*\})/s);
  try {
    payload = dataLineMatch ? JSON.parse(dataLineMatch[1]) : JSON.parse(rawText);
  } catch (err) {
    throw new Error(`Couldn't parse MCP response: ${rawText.slice(0, 200)}`);
  }

  if (payload.error) {
    throw new Error(payload.error.message || "MCP call failed");
  }

  return payload.result;
}

async function callTool(name, args) {
  const result = await mcpCall("tools/call", { name, arguments: args });

  if (result.isError) {
    const errText = result.content?.[0]?.text || "Tool call failed";
    throw new Error(errText);
  }

  const textContent = result.content?.find((c) => c.type === "text");
  if (textContent) {
    try {
      return JSON.parse(textContent.text);
    } catch {
      return textContent.text;
    }
  }
  return result;
}

// ---- Agent lifecycle ----

export async function registerAgent(secretKey) {
  return await callTool("register_agent", { secret_key: secretKey });
}

export async function getAgent(agentId) {
  return await callTool("get_agent", { agent_id: agentId });
}

export async function createAgentSpendPolicy({ agentId, assetType, currencyCode, maxAutoApproveAmount, dailyLimit, monthlyLimit }) {
  const args = { agent_id: agentId, asset_type: assetType, max_auto_approve_amount: Number(maxAutoApproveAmount) };
  if (currencyCode) args.currency_code = currencyCode;
  if (dailyLimit) args.daily_limit = Number(dailyLimit);
  if (monthlyLimit) args.monthly_limit = Number(monthlyLimit);
  return await callTool("create_agent_spend_policy", args);
}

// ---- Balance ----

export async function getAgentBalance({ agentId, assetType, currencyCode, assetCode, network }) {
  const args = { agent_id: agentId, asset_type: assetType };
  if (currencyCode) args.currency_code = currencyCode;
  if (assetCode) args.asset_code = assetCode;
  if (network) args.network = network;
  return await callTool("get_agent_balance", args);
}

// ---- Moving money (both of these should go through a confirmation gate before being called) ----

export async function agentCreateStablecoinOrder({ agentId, address, network, amount, assetCode }) {
  const args = { agent_id: agentId, address, network, amount: Number(amount) };
  if (assetCode) args.asset_code = assetCode;
  return await callTool("agent_create_stablecoin_order", args);
}

export async function agentCreateFiatOrder({ agentId, amount, currencyCode, type, shortcode, mobileNetwork, bankCode, accountNumber, accountName, narration }) {
  const args = { agent_id: agentId, amount: Number(amount), currency_code: currencyCode, type };
  if (shortcode) args.shortcode = shortcode;
  if (mobileNetwork) args.mobile_network = mobileNetwork;
  if (bankCode) args.bank_code = bankCode;
  if (accountNumber) args.account_number = accountNumber;
  if (accountName) args.account_name = accountName;
  if (narration) args.narration = narration;
  return await callTool("agent_create_fiat_order", args);
}

export async function getAgentFiatOrderStatus({ agentId, reference, currencyCode }) {
  const args = { agent_id: agentId, reference };
  if (currencyCode) args.currency_code = currencyCode;
  return await callTool("get_agent_fiat_order_status", args);
}
