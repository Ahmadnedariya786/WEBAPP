import puppeteer from 'puppeteer';

async function createSampleReport() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 1000 });
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <link href="https://fonts.googleapis.com/css2?family=Caveat:wght@600&family=Noto+Sans+Gujarati:wght@400;700&display=swap" rel="stylesheet">
        <style>
          body { margin: 0; background: #fafafa; font-family: 'Noto Sans Gujarati', sans-serif; padding: 24px; color: #111; }
          .card { border: 2px solid #222; padding: 20px; background: #fff; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          h2 { text-align: center; margin: 0 0 12px 0; font-size: 24px; }
          .meta { font-size: 18px; font-weight: bold; margin-bottom: 16px; border-bottom: 1px dashed #666; padding-bottom: 8px; }
          .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 16px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; font-size: 14px; margin-top: 10px; }
          th, td { border: 1px solid #444; padding: 4px 6px; text-align: left; height: 26px; }
          th { background: #f0f0f0; }
          .num { text-align: center; font-weight: bold; font-family: 'Noto Sans Gujarati', sans-serif; font-size: 16px; color: #0d1b2a; }
          .handwritten { font-family: 'Caveat', cursive, sans-serif; font-size: 20px; font-weight: bold; color: #1a365d; }
          .faint-ambiguous { opacity: 0.18; filter: blur(0.8px); font-family: 'Caveat', cursive; font-size: 14px; color: #777; }
          .noisy-symbol { color: #555; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>બનાસકાંઠા વિદ્યાર્થી કારગુજારી</h2>
          <div class="meta">હલકો: પાલનપુર (Palanpur) | તારીખ: 10/10/2026</div>
          <div class="stats-grid">
            <div>કુલ વિદ્યાર્થી: <span class="num">120</span></div>
            <div>ધોરણ ૧૦: <span class="num">25</span></div>
            <div>ધોરણ ૧૧: <span class="num">18</span></div>
            <div>ધોરણ ૧૨: <span class="num">15</span></div>
            <div>કોલેજ: <span class="num">30</span></div>
            <div>એન્જિનિયર: <span class="num">8</span></div>
            <div>મેડિકલ: <span class="num">5</span></div>
            <div>મુસ્લિમ શિક્ષકો: <span class="num">12</span></div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 42%;">પ્રવૃત્તિ</th>
                <th class="num" style="width: 19%;">ગુજિશતા</th>
                <th class="num" style="width: 19%;">અઝાઇમ</th>
                <th class="num" style="width: 20%;">મોજૂદા</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>1. નમાઝોની પાબંદી</td><td class="num">85</td><td class="num">90</td><td class="num">88</td></tr>
              <tr><td>2. મશવરાની પાબંદી</td><td class="num">12</td><td class="num">12</td><td class="num">12</td></tr>
              <tr><td>3. તાલીમની પાબંદી</td><td class="num">20</td><td class="num">22</td><td class="num">21</td></tr>
              <tr><td>4. ગશતની પાબંદી</td><td class="num">15</td><td class="num">16</td><td class="num">15</td></tr>
              <tr><td>5. પંચકોસા પાબંદી</td><td class="num">30</td><td class="num">35</td><td class="num">32</td></tr>
              <!-- Row 6: શબગુજારી is completely BLANK -->
              <tr><td>6. શબગુજારી</td><td></td><td></td><td></td></tr>
              <tr><td>7. મુલાકાત કેટલી થઈ (%)</td><td class="num">75</td><td class="num">80</td><td class="num">78</td></tr>
              <!-- Row 8 mojuda has a faint ambiguous mark for F4 low-confidence tag test -->
              <tr><td>8. સ્કૂલોમાં નમાઝ શરૂ થઈ</td><td class="num">4</td><td class="num">5</td><td class="num"><span class="faint-ambiguous">~ ?</span></td></tr>
              <tr><td>9. ૩ દિન જમાઅતો</td><td class="num">2</td><td class="num">2</td><td class="num">2</td></tr>
              <tr><td>10. ૧૦ દિનની જમાઅતો</td><td class="num">1</td><td class="num">1</td><td class="num">1</td></tr>
              <!-- Row 11: ૪૦ દિનની જમાઅતો is completely BLANK -->
              <tr><td>11. ૪૦ દિનની જમાઅતો</td><td></td><td></td><td></td></tr>
              <!-- Row 12: ૪ માહની જમાઅતો is completely BLANK -->
              <tr><td>12. ૪ માહની જમાઅતો</td><td></td><td></td><td></td></tr>
              <!-- Row 13: મશવારો text field has OCR junk symbols: '" | + !! =' -->
              <tr><td>13. મશવારો ક્યારે અને ક્યાં</td><td colspan="3"><span class="noisy-symbol">" | + !! =</span></td></tr>
            </tbody>
          </table>
        </div>
      </body>
      </html>
    `;
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.screenshot({ path: 'sample_report_test.jpg', type: 'jpeg', quality: 90 });
    console.log('sample_report_test.jpg generated successfully with owner test scenario!');
  } finally {
    await browser.close();
  }
}

createSampleReport();
