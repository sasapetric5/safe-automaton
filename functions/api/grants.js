const UPSTREAM = "https://api.grants.gov/v1/api/search2";

export async function onRequest(context) {
  const requestId = crypto.randomUUID();
  const method = context.request.method;

  // Never log request bodies, API tokens, or complete upstream responses.
  console.log("[grants]", JSON.stringify({
    event: "request_received",
    requestId,
    method,
    path: new URL(context.request.url).pathname
  }));

  if (method !== "POST") {
    console.log("[grants]", JSON.stringify({
      event: "method_rejected",
      requestId,
      method,
      status: 405
    }));
    return json({ error: "Koristi POST za pretragu Grants.gov." }, 405, {
      Allow: "POST"
    });
  }

  let input;
  try {
    input = await context.request.json();
  } catch (error) {
    console.log("[grants]", JSON.stringify({
      event: "invalid_request_json",
      requestId,
      errorName: error instanceof Error ? error.name : "UnknownError"
    }));
    return json({ error: "Neispravno JSON telo zahteva." }, 400);
  }

  const keyword = typeof input?.keyword === "string" ? input.keyword.trim().slice(0, 200) : "";
  const rows = Number.isInteger(input?.rows) ? Math.min(50, Math.max(1, input.rows)) : 20;
  const startRecordNum = Number.isInteger(input?.startRecordNum)
    ? Math.min(10000, Math.max(0, input.startRecordNum))
    : 0;

  const payload = {
    rows,
    startRecordNum,
    keyword: keyword || "technology",
    oppStatuses: "posted|forecasted"
  };

  console.log("[grants]", JSON.stringify({
    event: "upstream_request_start",
    requestId,
    rows: payload.rows,
    startRecordNum: payload.startRecordNum,
    keywordLength: payload.keyword.length
  }));

  try {
    const upstream = await fetch(UPSTREAM, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(payload)
    });

    console.log("[grants]", JSON.stringify({
      event: "upstream_response",
      requestId,
      status: upstream.status,
      ok: upstream.ok
    }));

    const body = await upstream.text();
    if (!upstream.ok) {
      console.log("[grants]", JSON.stringify({
        event: "upstream_http_error",
        requestId,
        status: upstream.status
      }));
      return json({
        error: "Grants.gov API je vratio HTTP " + upstream.status + ".",
        upstreamStatus: upstream.status
      }, 502);
    }

    let data;
    try {
      data = JSON.parse(body);
    } catch {
      console.log("[grants]", JSON.stringify({
        event: "upstream_invalid_json",
        requestId,
        bodyLength: body.length
      }));
      return json({ error: "Grants.gov API nije vratio ispravan JSON." }, 502);
    }

    if (data?.errorcode !== 0 || !Array.isArray(data?.data?.oppHits)) {
      console.log("[grants]", JSON.stringify({
        event: "upstream_unexpected_payload",
        requestId,
        errorcode: data?.errorcode ?? null,
        hasOppHitsArray: Array.isArray(data?.data?.oppHits)
      }));
      return json({
        error: data?.msg || "Grants.gov API je vratio neočekivan odgovor."
      }, 502);
    }

    console.log("[grants]", JSON.stringify({
      event: "request_succeeded",
      requestId,
      status: 200,
      hitCount: data.data.hitCount ?? null,
      returnedCount: data.data.oppHits.length
    }));

    return json(data, 200);
  } catch (error) {
    console.error("[grants]", JSON.stringify({
      event: "request_exception",
      requestId,
      errorName: error instanceof Error ? error.name : "UnknownError",
      detail: error instanceof Error ? error.message.slice(0, 240) : "Nepoznata greška"
    }));
    return json({
      error: "Greška pri povezivanju sa Grants.gov API-jem.",
      detail: error instanceof Error ? error.message.slice(0, 240) : "Nepoznata greška"
    }, 502);
  }
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders
    }
  });
}
