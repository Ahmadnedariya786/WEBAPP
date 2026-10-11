import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

async function generateCleanFormFixture() {
  const fixtureDir = path.resolve('tests/fixtures');
  if (!fs.existsSync(fixtureDir)) {
    fs.mkdirSync(fixtureDir, { recursive: true });
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1000, height: 1450, deviceScaleFactor: 1 });

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <link href="https://fonts.googleapis.com/css2?family=Hind+Vadodara:wght@400;600;700&family=Noto+Sans+Gujarati:wght@400;600;700&display=swap" rel="stylesheet">
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 40px;
            background: #ffffff;
            font-family: 'Hind Vadodara', 'Noto Sans Gujarati', sans-serif;
            color: #000000;
          }
          .container {
            width: 100%;
            max-width: 1100px;
            margin: 0 auto;
            border: 2px solid #000;
            padding: 30px;
          }
          .title {
            text-align: center;
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 8px;
          }
          .meta {
            text-align: center;
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 24px;
            border-bottom: 1px solid #333;
            padding-bottom: 12px;
          }
          .section-title {
            font-size: 20px;
            font-weight: 700;
            margin: 16px 0 8px 0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          th, td {
            border: 1.5px solid #000;
            padding: 8px 10px;
            text-align: center;
            font-size: 18px;
          }
          th {
            background-color: #f2f2f2;
            font-weight: 700;
          }
          .text-left {
            text-align: left;
          }
          .num {
            font-weight: 600;
            font-size: 20px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="title">બનાસકાંઠા વિદ્યાર્થી કારગુજારી રિપોર્ટ</div>
          <div class="meta">હલકો: પાલનપુર &nbsp;&nbsp;|&nbsp;&nbsp; તારીખ: 11/10/2026</div>

          <div class="section-title">સ્ટુડન્ટ આંકડા</div>
          <table id="stats-table">
            <thead>
              <tr>
                <th>સ્ટુડન્ટની સંખ્યા</th>
                <th>ધોરણ 10</th>
                <th>ધોરણ 11</th>
                <th>ધોરણ 12</th>
                <th>કોલેજ</th>
                <th>એન્જિનિયર</th>
                <th>મેડિકલ</th>
                <th>મુસ્લિમ શિક્ષકોની સંખ્યા</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="num">340</td>
                <td class="num">62</td>
                <td class="num">58</td>
                <td class="num">64</td>
                <td class="num">96</td>
                <td class="num">28</td>
                <td class="num">12</td>
                <td class="num">9</td>
              </tr>
            </tbody>
          </table>

          <div class="section-title">૧૩ મહેનત પ્રવૃત્તિઓ</div>
          <table id="activities-table">
            <thead>
              <tr>
                <th style="width: 8%;">નં.</th>
                <th class="text-left" style="width: 44%;">પ્રવૃત્તિ</th>
                <th style="width: 16%;">ગુજિશતા</th>
                <th style="width: 16%;">અઝાઇમ</th>
                <th style="width: 16%;">મોજૂદા</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>1</td>
                <td class="text-left">નમાઝોની પાબંદી</td>
                <td class="num">135</td>
                <td class="num">211</td>
                <td class="num">164</td>
              </tr>
              <tr>
                <td>2</td>
                <td class="text-left">મશવરાની પાબંદી</td>
                <td class="num">135</td>
                <td class="num">205</td>
                <td class="num">195</td>
              </tr>
              <tr>
                <td>3</td>
                <td class="text-left">તાલીમની પાબંદી</td>
                <td class="num">68</td>
                <td class="num">96</td>
                <td class="num">87</td>
              </tr>
              <tr>
                <td>4</td>
                <td class="text-left">ગશતની પાબંદી</td>
                <td class="num">141</td>
                <td class="num">226</td>
                <td class="num">204</td>
              </tr>
              <tr>
                <td>5</td>
                <td class="text-left">પંચકોસા પાબંદી</td>
                <td class="num">67</td>
                <td class="num">84</td>
                <td class="num">50</td>
              </tr>
              <tr>
                <td>6</td>
                <td class="text-left">શબગુજારી</td>
                <td class="num">97</td>
                <td class="num">120</td>
                <td class="num">43</td>
              </tr>
              <tr>
                <td>7</td>
                <td class="text-left">મુલાકાત કેટલી થઈ (%)</td>
                <td class="num">157</td>
                <td class="num">243</td>
                <td class="num">62</td>
              </tr>
              <tr>
                <td>8</td>
                <td class="text-left">કેટલી સ્કૂલો/કોલેજમાં નમાઝ શરૂ થઈ</td>
                <td class="num">172</td>
                <td class="num">227</td>
                <td class="num">172</td>
              </tr>
              <tr>
                <td>9</td>
                <td class="text-left">૩ દિન જમાઅતો</td>
                <td class="num">23</td>
                <td class="num">37</td>
                <td class="num">27</td>
              </tr>
              <tr>
                <td>10</td>
                <td class="text-left">૧૦ દિનની જમાઅતો</td>
                <td class="num">8</td>
                <td class="num">22</td>
                <td class="num">2</td>
              </tr>
              <tr>
                <td>11</td>
                <td class="text-left">૪૦ દિનની જમાઅતો</td>
                <td class="num">19</td>
                <td class="num">25</td>
                <td class="num">7</td>
              </tr>
              <tr>
                <td>12</td>
                <td class="text-left">૪ માહની જમાઅતો</td>
                <td class="num">4</td>
                <td class="num">12</td>
                <td class="num">4</td>
              </tr>
              <tr>
                <td>13</td>
                <td class="text-left">મશવારો ક્યારે અને ક્યાં</td>
                <td colspan="3"></td>
              </tr>
            </tbody>
          </table>
        </div>
      </body>
      </html>
    `;

    await page.setContent(html, { waitUntil: 'networkidle0' });
    // Wait for fonts to be ready
    await page.evaluate(async () => {
      if (document.fonts) await document.fonts.ready;
    });

    const targetPath = path.join(fixtureDir, 'clean_form.png');
    await page.screenshot({ path: targetPath, type: 'png' });
    console.log(`Clean form fixture created at: ${targetPath}`);
  } finally {
    await browser.close();
  }
}

generateCleanFormFixture();
