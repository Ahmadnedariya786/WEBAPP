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
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Gujarati:wght@400;700&display=swap" rel="stylesheet">
        <style>
          body { margin: 0; background: #fafafa; font-family: 'Noto Sans Gujarati', sans-serif; padding: 24px; color: #111; }
          .card { border: 2px solid #222; padding: 20px; background: #fff; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          h2 { text-align: center; margin: 0 0 12px 0; font-size: 24px; }
          .meta { font-size: 18px; font-weight: bold; margin-bottom: 16px; border-bottom: 1px dashed #666; padding-bottom: 8px; }
          .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 16px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; font-size: 14px; margin-top: 10px; }
          th, td { border: 1px solid #444; padding: 6px 8px; text-align: left; }
          th { background: #f0f0f0; }
          .num { text-align: center; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>બનાસકાંઠા વિદ્યાર્થી કારગુજારી</h2>
          <div class="meta">હલકો: પાલનપુર (Palanpur) | તારીખ: 10/10/2026</div>
          <div class="stats-grid">
            <div>કુલ વિદ્યાર્થી: 120</div>
            <div>ધોરણ ૧૦: 25</div>
            <div>ધોરણ ૧૧: 18</div>
            <div>ધોરણ ૧૨: 15</div>
            <div>કોલેજ: 30</div>
            <div>એન્જિનિયર: 8</div>
            <div>મેડિકલ: 5</div>
            <div>મુસ્લિમ શિક્ષકો: 12</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>પ્રવૃત્તિ</th>
                <th class="num">ગુજિશતા</th>
                <th class="num">અઝાઇમ</th>
                <th class="num">મોજૂદા</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>1. નમાઝોની પાબંદી</td><td class="num">85</td><td class="num">90</td><td class="num">88</td></tr>
              <tr><td>2. મશવરાની પાબંદી</td><td class="num">12</td><td class="num">12</td><td class="num">12</td></tr>
              <tr><td>3. તાલીમની પાબંદી</td><td class="num">20</td><td class="num">22</td><td class="num">21</td></tr>
              <tr><td>4. ગશતની પાબંદી</td><td class="num">15</td><td class="num">16</td><td class="num">15</td></tr>
              <tr><td>5. પંચકોસા પાબંદી</td><td class="num">30</td><td class="num">35</td><td class="num">32</td></tr>
              <tr><td>6. શબગુજારી</td><td class="num">10</td><td class="num">10</td><td class="num">10</td></tr>
              <tr><td>7. મુલાકાત કેટલી થઈ (%)</td><td class="num">75</td><td class="num">80</td><td class="num">78</td></tr>
              <tr><td>8. સ્કૂલોમાં નમાઝ શરૂ થઈ</td><td class="num">4</td><td class="num">5</td><td class="num">4</td></tr>
              <tr><td>9. ૩ દિન જમાઅતો</td><td class="num">2</td><td class="num">2</td><td class="num">2</td></tr>
              <tr><td>10. ૧૦ દિનની જમાઅતો</td><td class="num">1</td><td class="num">1</td><td class="num">1</td></tr>
              <tr><td>11. ૪૦ દિનની જમાઅતો</td><td class="num">1</td><td class="num">1</td><td class="num">1</td></tr>
              <tr><td>12. ૪ માહની જમાઅતો</td><td class="num">0</td><td class="num">1</td><td class="num">0</td></tr>
              <tr><td>13. મશવારો ક્યારે અને ક્યાં</td><td colspan="3">રવિવાર મરકઝ</td></tr>
            </tbody>
          </table>
        </div>
      </body>
      </html>
    `;
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.screenshot({ path: 'sample_report_test.jpg', type: 'jpeg', quality: 90 });
    console.log('sample_report_test.jpg generated successfully');
  } finally {
    await browser.close();
  }
}

createSampleReport();
