const UPSTREAM = "https://api.grants.gov/v1/api/search2";

export async function onRequest(context) {
  if (context.request.method !== "POST") {
    return json({ error: "Koristi POST za pretragu Grants.gov." }, 405, {
      Allow: "POST"
    });
  }

  let input;
  try {
    input = await context.request.json();
  } catch {
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

  try {
    const upstream = await fetch(UPSTREAM, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const body = await upstream.text();
    if (!upstream.ok) {
      return json({
        error: "Grants.gov API je vratio HTTP " + upstream.status + ".",
        upstreamStatus: upstream.status
      }, 502);
    }

    let data;
    try {
      data = JSON.parse(body);
    } catch {
      return json({ error: "Grants.gov API nije vratio ispravan JSON." }, 502);
    }

    if (data?.errorcode !== 0 || !Array.isArray(data?.data?.oppHits)) {
      return json({
        error: data?.msg || "Grants.gov API je vratio neočekivan odgovor."
      }, 502);
    }

    return json(data, 200);
  } catch (error) {
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
