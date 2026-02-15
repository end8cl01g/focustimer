const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Mock API responses
  await page.route('**/api/timer-state', route => route.fulfill({
    status: 200,
    body: JSON.stringify({ activeTaskId: '1', timers: { '1': { seconds: 120, isRunning: false } } })
  }));

  await page.route('**/api/tasks', route => route.fulfill({
    status: 200,
    body: JSON.stringify([
      { id: '1', title: 'Focus Task 1', start: new Date().toISOString(), end: new Date(Date.now() + 3600000).toISOString() },
      { id: '2', title: 'Upcoming Task', start: new Date(Date.now() + 7200000).toISOString(), end: new Date(Date.now() + 10800000).toISOString() }
    ])
  }));

  // Go to the app
  const url = 'file://' + path.resolve('public/index.html');
  await page.goto(url);

  // Wait for loading to disappear
  await page.waitForSelector('#loading', { state: 'hidden' });

  // Take screenshot
  await page.screenshot({ path: 'screenshot.png' });
  console.log('Screenshot saved to screenshot.png');

  await browser.close();
})();
