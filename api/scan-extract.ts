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

export default async function handler(req: any, res: any) {
  // Only POST allowed
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

  // Validate image size (≤ 8MB base64 approx ~6MB raw)
  const sizeInBytes = (image.length * 3) / 4;
  if (sizeInBytes > 8 * 1024 * 1024) {
    return res.status(400).json({ error: 'ઈમેજ સાઈઝ 8MB કરતાં વધુ છે' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const isDev = process.env.NODE_ENV === 'development' || process.env.SCAN_MOCK === 'true';

  // N2: Dev mock pipeline runs ONLY when NODE_ENV=development or SCAN_MOCK=true
  if (!apiKey) {
    if (isDev) {
      console.warn('[DEV ONLY] GEMINI_API_KEY missing in dev environment. Returning mock data matching test spec.');
      return res.status(200).json(getDevMockResponse());
    }
    // Production MUST fail if GEMINI_API_KEY is not configured
    return res.status(500).json({
      error: 'GEMINI_API_KEY server-side environment variable is not configured on Vercel.'
    });
  }

  // Explicit mock header for testing locally during development
  if (isDev && req.headers['x-mock-scan'] === 'true') {
    return res.status(200).json(getDevMockResponse());
  }

  // Call Gemini Flash Vision API with 30s timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
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

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiPayload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini API Error:', response.status, errText);
      return res.status(response.status >= 500 ? 502 : 400).json({
        error: 'Gemini Vision API એક્સટ્રેક્શન નિષ્ફળ ગયું',
        details: errText
      });
    }

    const data: any = await response.json();
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) {
      return res.status(500).json({ error: 'ઈમેજમાંથી કોઈ ડેટા મળ્યો નથી' });
    }

    // Clean potential markdown wrap if any
    const cleanJson = candidateText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    const parsed = JSON.parse(cleanJson);
    return res.status(200).json(parsed);

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
