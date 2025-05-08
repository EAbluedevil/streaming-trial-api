const express = require('express');
const puppeteer = require('puppeteer');
const app = express();
const PORT = process.env.PORT || 3000;

async function checkNetflixTrial() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.goto('https://www.netflix.com/signup', { waitUntil: 'domcontentloaded' });

  const bodyText = await page.evaluate(() => document.body.innerText);
  const hasTrial = /free trial/i.test(bodyText);

  await browser.close();
  return { service: "Netflix", trial_available: hasTrial, region: "US" };
}

async function checkHuluTrial() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.goto('https://www.hulu.com/start', { waitUntil: 'domcontentloaded' });

  const bodyText = await page.evaluate(() => document.body.innerText);
  const hasTrial = /free trial/i.test(bodyText);

  await browser.close();
  return { service: "Hulu", trial_available: hasTrial, region: "US" };
}

async function checkDisneyTrial() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.goto('https://www.disneyplus.com', { waitUntil: 'domcontentloaded' });

  const bodyText = await page.evaluate(() => document.body.innerText);
  const hasTrial = /free trial/i.test(bodyText);

  await browser.close();
  return { service: "Disney+", trial_available: hasTrial, region: "US" };
}

app.get('/api/streaming-trials', async (req, res) => {
  try {
    const results = await Promise.all([
      checkNetflixTrial(),
      checkHuluTrial(),
      checkDisneyTrial()
    ]);
    res.json(results);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to check trial availability' });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
