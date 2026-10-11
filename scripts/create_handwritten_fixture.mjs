import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

async function generateHandwrittenFixture() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 1600 });

  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { margin: 0; background: #e8e3d8; overflow: hidden; }
        canvas { display: block; }
      </style>
    </head>
    <body>
      <canvas id="c" width="1200" height="1600"></canvas>
      <script>
        const canvas = document.getElementById('c');
        const ctx = canvas.getContext('2d');

        // Warm paper background with slight gradient/shadow simulating a phone photo
        const bgGrad = ctx.createLinearGradient(0, 0, 1200, 1600);
        bgGrad.addColorStop(0, '#f4eee0');
        bgGrad.addColorStop(0.5, '#eadeca');
        bgGrad.addColorStop(1, '#dfd3bd');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, 1200, 1600);

        // Header text simulating form header
        ctx.fillStyle = '#443f38';
        ctx.font = 'bold 28px sans-serif';
        ctx.fillText('બનાસકાંઠા મહેનત ટ્રેકર - માસિક રિપોર્ટ', 350, 120);

        // Stats section header
        ctx.font = '18px sans-serif';
        ctx.fillText('હલકો: પાલનપુર  |  તારીખ: ૧૦-૧૦-૨૦૨૬', 380, 170);

        // Draw faint skewed / handwritten stats boxes
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#756c60';
        ctx.strokeRect(100, 220, 1000, 50);
        ctx.strokeRect(100, 270, 1000, 50);

        // Vertical column dividers
        const colW = 1000 / 11;
        for (let i = 1; i < 11; i++) {
          ctx.beginPath();
          ctx.moveTo(100 + i * colW, 220);
          ctx.lineTo(100 + i * colW, 320);
          ctx.stroke();
        }

        // Faint headers
        ctx.font = '13px sans-serif';
        ctx.fillStyle = '#655e54';
        const headers = ['કુલ', 'ધો.10', 'ધો.11', 'ધો.12', 'કોલેજ', 'એન્જિ.', 'મેડિકલ', 'અન્ય1', 'અન્ય2', 'અન્ય3', 'શિક્ષકો'];
        headers.forEach((h, i) => {
          ctx.fillText(h, 105 + i * colW, 252);
        });

        // Handwritten numbers in pencil/ballpoint (light grey, curved)
        ctx.font = 'italic 20px serif';
        ctx.fillStyle = '#5c5248';
        ctx.fillText('115', 120, 305); // low-conf / noisy scribble
        ctx.fillText('11', 120 + colW, 305);
        ctx.fillText('1', 120 + colW * 2, 305);

        // Empty activities table (representing handwritten photo where activity rows are faint/empty)
        ctx.strokeStyle = '#8a8074';
        ctx.strokeRect(100, 360, 1000, 750);
        for (let r = 1; r <= 13; r++) {
          const y = 360 + r * (750 / 14);
          ctx.beginPath();
          ctx.moveTo(100, y);
          ctx.lineTo(1100, y);
          ctx.stroke();
        }
      </script>
    </body>
    </html>
  `);

  await new Promise((r) => setTimeout(r, 600));

  const canvasHandle = await page.$('#c');
  const outPath = path.resolve('tests/fixtures/handwritten_sample.png');
  await canvasHandle.screenshot({ path: outPath });
  await browser.close();
  console.log(`Generated fixture at ${outPath}`);
}

generateHandwrittenFixture().catch(console.error);
