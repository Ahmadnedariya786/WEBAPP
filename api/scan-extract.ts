// Rate limiting: 10 requests per minute per IP
interface RateLimitRecord {
  timestamps: number[];
}
const rateLimitMap = new Map<string, RateLimitRecord>();

function isRateLimited(ip: string, limit = 10, windowMs = 60 * 1000): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip) || { timestamps: [] };
  // Filter out timestamps outside current window
  record.timestamps = record.timestamps.filter(ts => now - ts < windowMs);
  if (record.timestamps.length >= limit) {
    return true;
  }
  record.timestamps.push(now);
  rateLimitMap.set(ip, record);
  return false;
}

const SYSTEM_PROMPT = `You are a precision OCR assistant for handwritten Gujarati student report forms.
Analyze the provided report form image with high accuracy and return ONLY a strict JSON document.

EVERY leaf field MUST be an object with the structure:
{
  "v": string | null,
  "ok": boolean
}
Where:
- "v": the exact handwritten string content, or null if the cell is empty/blank or not visible.
- "ok": true if the handwritten content is clearly legible, false if ambiguous, scratched out, smeared, or difficult to decipher.

CRITICAL RULES:
1. EMPTY CELL RULE: If a cell is blank or empty, you MUST return {"v": null, "ok": true}. NEVER write 0, "-", "NA", or any placeholder for empty cells.
2. NO GUESSING: Never guess, invent, or default to 0.
3. PRESERVE FRACTIONS & FORMULAS: Keep fractions/sums exactly as written (e.g., "30/5", "10+5", "12/2").
4. VISIBILITY RULE: Sections not visible in the photo or cropped out MUST be {"v": null, "ok": false}.
5. AMBIGUOUS TEXT: If a number or word is illegible or ambiguous, return the best-effort string in "v", and set "ok": false.

SCHEMA TO RETURN:
{
  "halqa_name": { "v": string | null, "ok": boolean },
  "student_count": { "v": string | null, "ok": boolean },
  "std10": { "v": string | null, "ok": boolean },
  "std11": { "v": string | null, "ok": boolean },
  "std12": { "v": string | null, "ok": boolean },
  "college": { "v": string | null, "ok": boolean },
  "engineer": { "v": string | null, "ok": boolean },
  "medical": { "v": string | null, "ok": boolean },
  "muslim_teachers": { "v": string | null, "ok": boolean },
  "activities": [
    {
      "no": 1,
      "gujishata": { "v": string | null, "ok": boolean },
      "agraaham": { "v": string | null, "ok": boolean },
      "mojuda": { "v": string | null, "ok": boolean }
    }
  ],
  "mulakat_percent": { "v": string | null, "ok": boolean },
  "schools_prayer": { "v": string | null, "ok": boolean },
  "jamat_3din": { "v": string | null, "ok": boolean },
  "jamat_10din": { "v": string | null, "ok": boolean },
  "skipped_columns": []
}

Rows 1 to 13 correspond to:
1: નમાઝોની પાબંદી (Namaz)
2: મશવરાની પાબંદી (Mashwara)
3: તાલીમની પાબંદી (Taleem)
4: ગશતની પાબંદી (Gasht)
5: પંચકોસા પાબંદી (Panchkosa)
6: શબગુજારી (Shabguzari)
7: મુલાકાત કેટલી થઈ (%) (Mulaqat)
8: કેટલી સ્કૂલો/કોલેજમાં નમાઝ શરૂ થઈ (School/College Namaz)
9: ૩ દિન જમાઅતો (3 Din Jamat)
10: ૧૦ દિનની જમાઅતો (10 Din Jamat)
11: ૪૦ દિનની જમાઅતો (40 Din Jamat)
12: ૪ માહની જમાઅતો (4 Mah Jamat)
13: મશવારો ક્યારે અને ક્યાં (Mashwara details in mojuda)
`;

// Module-level in-memory cache for dynamic model discovery
let cachedModel: string | null = null;
let lastDiscoveryTime: number = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 60 minutes
const FALLBACK_CHAIN = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.0-flash'];

function stripModelPrefix(name: string): string {
  return (name || '').replace(/^models\//, '');
}

/**
 * Dynamic Model Discovery:
 * D1 & N3: 10s timeout AbortController.
 * Preference:
 *  (1) alias "gemini-flash-latest" if listed and supports generateContent
 *  (2) else first model matching /gemini-.*-flash/ supporting generateContent
 *  (3) else fallback chain ["gemini-flash-latest", "gemini-2.5-flash", "gemini-2.0-flash"]
 */
async function getOrDiscoverModel(apiKey: string): Promise<string> {
  const now = Date.now();
  if (cachedModel && (now - lastDiscoveryTime < CACHE_TTL_MS)) {
    return cachedModel;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // N3: 10-second AbortController timeout

  try {
    const resp = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
      method: 'GET',
      headers: {
        'x-goog-api-key': apiKey
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('[Dynamic Discovery Error]', resp.status, errText);
      cachedModel = FALLBACK_CHAIN[0];
      lastDiscoveryTime = now;
      return cachedModel;
    }

    const data: any = await resp.json();
    const models: Array<{ name: string; supportedGenerationMethods?: string[] }> = data?.models || [];

    const supportsGenerateContent = (m: any) => {
      if (!m.supportedGenerationMethods) return true;
      return Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent');
    };

    // (1) alias "gemini-flash-latest" if listed
    const flashLatest = models.find(m => stripModelPrefix(m.name) === 'gemini-flash-latest' && supportsGenerateContent(m));
    if (flashLatest) {
      cachedModel = 'gemini-flash-latest';
      lastDiscoveryTime = now;
      return cachedModel;
    }

    // (2) else the first model whose name matches /gemini-.*-flash/ and supports generateContent
    const flashMatch = models.find(m => /gemini-.*-flash/.test(stripModelPrefix(m.name)) && supportsGenerateContent(m));
    if (flashMatch) {
      cachedModel = stripModelPrefix(flashMatch.name); // N1: Strip "models/" prefix
      lastDiscoveryTime = now;
      return cachedModel;
    }

    // (3) else fallback chain
    cachedModel = FALLBACK_CHAIN[0];
    lastDiscoveryTime = now;
    return cachedModel;
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.error('[Dynamic Discovery Exception]', err.message || err);
    // N3: On discovery failure go straight to fallback chain so scan never hangs
    cachedModel = FALLBACK_CHAIN[0];
    lastDiscoveryTime = now;
    return cachedModel;
  }
}

export default async function handler(req: any, res: any) {
  const url = new URL(req.url || '', 'http://localhost');
  const isPing = req.query?.ping === '1' || url.searchParams.get('ping') === '1';

  // D3 & N2: HEALTH PING (GET /api/scan-extract?ping=1)
  // Without calling Gemini generateContent and without an image
  if (isPing) {
    const apiKey = process.env.GEMINI_API_KEY;
    const hasKey = Boolean(apiKey);
    let model: string | null = cachedModel;

    // N2: May run cached model discovery (models-list GET) when cache is empty so model field is informative
    if (!model && hasKey && apiKey) {
      try {
        model = await getOrDiscoverModel(apiKey);
      } catch {
        model = null;
      }
    }

    return res.status(200).json({
      ok: true,
      hasKey,
      model: model || null
    });
  }

  // Only POST allowed for extraction
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Determine Client IP for Rate Limiting
  const forwarded = req.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket?.remoteAddress || '127.0.0.1';

  if (isRateLimited(ip, 10, 60000)) {
    return res.status(429).json({ error: 'રેટ લિમિટ ઓળંગાઈ (10 req/min). કૃપા કરીને થોડીવાર પછી પ્રયત્ન કરો.' });
  }

  // Parse Body
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
  }

  const { image, mimeType = 'image/jpeg' } = body || {};

  if (!image || typeof image !== 'string') {
    return res.status(400).json({ error: 'Missing image data (base64 string required)' });
  }

  if (mimeType && !mimeType.startsWith('image/')) {
    return res.status(415).json({ error: 'Unsupported media type (image required)' });
  }

  // Validate image size (≤ 8MB base64 approx ~6MB raw)
  const sizeInBytes = (image.length * 3) / 4;
  if (sizeInBytes > 8 * 1024 * 1024) {
    return res.status(400).json({ error: 'ઈમેજ સાઈઝ 8MB કરતાં વધુ છે' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const isDev = process.env.NODE_ENV === 'development' || process.env.SCAN_MOCK === 'true';

  // Explicit mock header for testing locally during development
  if (isDev && req.headers['x-mock-scan'] === 'true') {
    return res.status(200).json(getDevMockResponse());
  }

  // D2: Missing key → 500 { "code": "MISSING_KEY" }
  if (!apiKey) {
    if (isDev && process.env.SCAN_MOCK === 'true') {
      console.warn('[DEV ONLY] GEMINI_API_KEY missing in dev environment. Returning mock data matching test spec.');
      return res.status(200).json(getDevMockResponse());
    }
    // Production MUST fail if GEMINI_API_KEY is not configured
    return res.status(500).json({ code: 'MISSING_KEY' });
  }

  // D1: Dynamic Model Discovery
  const chosenModel = await getOrDiscoverModel(apiKey);
  // D1: console.log the chosen model once per invocation: "scan-extract model: <name>"
  console.log(`scan-extract model: ${chosenModel}`);

  // Candidate models: chosen model first, then remaining fallback chain models in order
  const modelsToTry = [chosenModel, ...FALLBACK_CHAIN.filter(m => m !== chosenModel)];

  const geminiPayload = {
    contents: [
      {
        parts: [
          { text: SYSTEM_PROMPT },
          {
            inlineData: {
              mimeType,
              data: image.replace(/^data:image\/[a-z]+;base64,/, '')
            }
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json'
    }
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  let lastStatus = 500;
  let lastMessage = 'Unknown error';

  try {
    for (const rawModel of modelsToTry) {
      const model = stripModelPrefix(rawModel); // N1: Strip "models/" prefix
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
          },
          body: JSON.stringify(geminiPayload),
          signal: controller.signal
        });

        if (!response.ok) {
          lastStatus = response.status;
          const errText = await response.text();
          let parsedErr: any = null;
          try {
            parsedErr = JSON.parse(errText);
          } catch {
            parsedErr = { raw: errText };
          }
          lastMessage = parsedErr?.error?.message || errText || response.statusText || 'Upstream error';

          // D2: FULL upstream body console.error'd (expanded, not collapsed)
          console.error(
            `[scan-extract upstream error]\n` +
            `Model: ${model}\n` +
            `HTTP Status: ${response.status}\n` +
            `Body:\n${typeof parsedErr === 'object' ? JSON.stringify(parsedErr, null, 2) : errText}`
          );
          continue; // Try next fallback model in order
        }

        clearTimeout(timeoutId);

        const data: any = await response.json();
        const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!candidateText) {
          console.error(`[Gemini API Warning] Model ${model} returned empty content.`);
          lastStatus = 502;
          lastMessage = 'Empty candidates in response';
          continue;
        }

        // Clean potential markdown wrap if any
        const cleanJson = candidateText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
        const parsed = JSON.parse(cleanJson);
        return res.status(200).json(parsed);

      } catch (innerErr: any) {
        if (innerErr.name === 'AbortError') throw innerErr;
        console.error(`[Gemini OCR Exception] Attempt with model ${model} failed:`, innerErr.message || innerErr);
        lastStatus = 502;
        lastMessage = innerErr.message || 'Exception';
      }
    }

    // D2: Upstream non-ok (any 404/400/429 from Gemini) → 502 { "code": "UPSTREAM", "detail": status + first 300 chars of message }
    clearTimeout(timeoutId);
    return res.status(502).json({
      code: 'UPSTREAM',
      detail: `${lastStatus} ${lastMessage.slice(0, 300)}`.trim()
    });

  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'રિક્વેસ્ટ ટાઇમઆઉટ (30s) થયો' });
    }
    console.error('Extraction handler exception:', err);
    return res.status(500).json({
      error: 'સ્કેન નિષ્ફળ ❌ — સાફ રોશનીમાં ફોટો લઈને ફરી પ્રયત્ન કરો',
      message: err.message
    });
  }
}

/**
 * Dev Mock Response matching D8 proof pack exact values:
 * 354/66/63/68/100 + activity values (203, 32, 86, 76, 17)
 * with amber dots on genuinely ambiguous cells,
 * empty mojuda column and rows 11-13 empty.
 */
function getDevMockResponse() {
  return {
    halqa_name: { v: 'પાલનપુર', ok: true },
    student_count: { v: '354', ok: true },
    std10: { v: '66', ok: true },
    std11: { v: '63', ok: true },
    std12: { v: '68', ok: true },
    college: { v: '100', ok: true },
    engineer: { v: '35', ok: true },
    medical: { v: '22', ok: false }, // ambiguous handwriting
    muslim_teachers: { v: '15', ok: true },
    activities: [
      { no: 1, gujishata: { v: '203', ok: true }, agraaham: { v: '210', ok: true }, mojuda: { v: null, ok: true } },
      { no: 2, gujishata: { v: '32', ok: true }, agraaham: { v: '35', ok: false }, mojuda: { v: null, ok: true } },
      { no: 3, gujishata: { v: '86', ok: true }, agraaham: { v: '90', ok: true }, mojuda: { v: null, ok: true } },
      { no: 4, gujishata: { v: '76', ok: true }, agraaham: { v: '80', ok: true }, mojuda: { v: null, ok: true } },
      { no: 5, gujishata: { v: '17', ok: true }, agraaham: { v: '20', ok: true }, mojuda: { v: null, ok: true } },
      { no: 6, gujishata: { v: '45', ok: true }, agraaham: { v: '50', ok: true }, mojuda: { v: null, ok: true } },
      { no: 7, gujishata: { v: '70%', ok: true }, agraaham: { v: '85%', ok: true }, mojuda: { v: null, ok: true } },
      { no: 8, gujishata: { v: '8', ok: true }, agraaham: { v: '10', ok: true }, mojuda: { v: null, ok: true } },
      { no: 9, gujishata: { v: '12', ok: true }, agraaham: { v: '15', ok: true }, mojuda: { v: null, ok: true } },
      { no: 10, gujishata: { v: '4', ok: true }, agraaham: { v: '6', ok: true }, mojuda: { v: null, ok: true } },
      { no: 11, gujishata: { v: null, ok: true }, agraaham: { v: null, ok: true }, mojuda: { v: null, ok: true } },
      { no: 12, gujishata: { v: null, ok: true }, agraaham: { v: null, ok: true }, mojuda: { v: null, ok: true } },
      { no: 13, gujishata: { v: null, ok: true }, agraaham: { v: null, ok: true }, mojuda: { v: null, ok: true } }
    ],
    mulakat_percent: { v: '70%', ok: true },
    schools_prayer: { v: '8', ok: true },
    jamat_3din: { v: '12', ok: true },
    jamat_10din: { v: '4', ok: true },
    skipped_columns: []
  };
}
