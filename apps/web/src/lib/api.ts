import { hc, parseResponse, type ClientResponse, type InferRequestType } from "hono/client";
import type { AppType } from "@keuangan-apotek/api";

const apiBase = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

/** The generated Hono RPC client. Route names, params, bodies, and responses are inferred from the API. */
export const api = hc<AppType>(apiBase);

type RpcCall = (...args: any[]) => Promise<ClientResponse<any, any, any>>;
type RpcBody<T extends RpcCall> = Awaited<ReturnType<T>> extends infer R
  ? R extends ClientResponse<infer Body, any, any> ? Body : never
  : never;
type RpcSuccess<T extends RpcCall> = Extract<RpcBody<T>, { data: unknown }>;

/**
 * Execute an RPC call and return its successful response body. Hono's
 * `parseResponse` keeps the response type attached to the endpoint function.
 */
export async function rpc<T extends RpcCall>(call: T): Promise<RpcSuccess<T>> {
  try {
    return await parseResponse(call()) as RpcSuccess<T>;
  } catch (error) {
    const detail = error instanceof Error && "detail" in error
      ? (error as Error & { detail?: { data?: { error?: unknown } } }).detail
      : undefined;
    const message = detail?.data?.error;
    throw new Error(typeof message === "string" ? message : error instanceof Error ? error.message : "Permintaan API gagal");
  }
}

export async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, init);
  if (response.status === 204) return undefined as T;
  const body = await response.json() as { data?: T; error?: unknown };
  if (!response.ok || body.error !== undefined) {
    throw new Error(typeof body.error === "string" ? body.error : "Permintaan API gagal");
  }
  return body.data as T;
}

export type RpcRequest<T extends RpcCall> = InferRequestType<T>;
