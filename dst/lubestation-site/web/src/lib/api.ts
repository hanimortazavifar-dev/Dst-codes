/** Client for the PHP API in public/api/ (served from the same host, so cookies just work). */

const BASE = `${import.meta.env.BASE_URL}api/`;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const NETWORK_ERROR = "ارتباط با سرور برقرار نشد؛ اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.";

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      credentials: "same-origin",
      ...init,
      // The API rejects state-changing requests without this header (cross-site request guard).
      headers: { "X-Requested-With": "lubestation", ...init.headers },
    });
  } catch {
    throw new ApiError(0, NETWORK_ERROR);
  }
  if (!res.ok) {
    let message = `خطای سرور (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* not JSON: keep the generic message */
    }
    throw new ApiError(res.status, message);
  }
  return res;
}

export async function getJson<T>(path: string): Promise<T> {
  return (await request(path)).json();
}

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await request(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return res.json();
}

export async function postForm<T>(path: string, form: FormData): Promise<T> {
  return (await request(path, { method: "POST", body: form })).json();
}

export async function getFile(path: string): Promise<{ data: ArrayBuffer; headers: Headers }> {
  const res = await request(path);
  return { data: await res.arrayBuffer(), headers: res.headers };
}
