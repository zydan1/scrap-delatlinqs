const express = require('express');
const puppeteer = require('puppeteer-extra');
const RecaptchaPlugin = require('puppeteer-extra-plugin-recaptcha');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const randUserAgent = require('rand-user-agent');
const HtmlTableToJson = require('html-table-to-json');
const tabletojson = require('tabletojson').Tabletojson;
// const { bypass } = require('./bypass/bypass');
// ;
const app = express();
const port = 3000;
puppeteer.use(StealthPlugin());

puppeteer.use(
  RecaptchaPlugin({
    provider: {
      id: '2captcha',
      token: 'c21eee7a0b591c74597265e5e89cfa28', // REPLACE THIS WITH YOUR OWN 2CAPTCHA API KEY ⚡
    },
    visualFeedback: true, // colorize reCAPTCHAs (violet = detected, green = solved)
  })
);
const formatData = async (dataTable = [], lastName = '', birthDate = '') => {
  if (dataTable[0]) {
    const data = dataTable[0];
    const formated = [];
    const regex = /(\d{1,2})\-(\d{1,2})\-(\d{4})/g;
    console.log(data);
    data.forEach((ele, index) => {
      formated.push({ lastName, birthDate });
      for (const key in ele) {
        if (Object.hasOwnProperty.call(ele, key)) {
          const element = ele[key];
          if (key === 'TrainingGeldig tot') {
            geldigTot = element.match(regex)[0];
            traning = element.replace(geldigTot, '');
            Object.assign(formated[index], { geldigTot, traning });
            console.log({ geldigTot, traning });
          } else if (key === 'ExamennummerExamendatum') {
            const examenNummer = element.slice(0, 17);
            const examenDatum = element
              .replace(examenNummer, '')
              .replace(/ /g, '');
            Object.assign(formated[index], { examenNummer, examenDatum });
            console.log({ examenNummer, examenDatum });
          }
        }
      }
    });
    return Promise.resolve(formated);
  }
  return Promise.resolve([]);
};

const scrap = async (lastName = '', birthDate = '') => {
  try {
    const browser = await puppeteer.launch({
      slowMo: 10,
      args: [
        '--lang=nl',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-infobars',
        '--window-position=0,0',
        '--ignore-certifcate-errors',
        '--ignore-certifcate-errors-spki-list',
      ],
      headless: true,
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();
    await page.setViewport({
      width: 1920 + Math.floor(Math.random() * 100),
      height: 3000 + Math.floor(Math.random() * 100),
      deviceScaleFactor: 1,
      hasTouch: false,
      isLandscape: false,
      isMobile: false,
    });

    const agent = randUserAgent('desktop', 'chrome', 'windows');
    console.log(agent);

    await page.setJavaScriptEnabled(true);
    await page.setDefaultNavigationTimeout(0);

    await page.setUserAgent(agent);
    // await page.setRequestInterception(true);
    // page.on('request', (req) => {
    //   if (
    //     req.resourceType() == 'stylesheet' ||
    //     req.resourceType() == 'font' ||
    //     req.resourceType() == 'image'
    //   ) {
    //     req.abort();
    //   } else {
    //     req.continue();
    //   }
    // });

    await page.evaluateOnNewDocument(() => {
      // Pass webdriver check
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
    });

    await page.evaluateOnNewDocument(() => {
      // Pass chrome check
      window.chrome = {
        runtime: {},
        // etc.
      };
    });

    await page.evaluateOnNewDocument(() => {
      //Pass notifications check
      const originalQuery = window.navigator.permissions.query;
      return (window.navigator.permissions.query = (parameters) =>
        parameters.name === 'notifications'
          ? Promise.resolve({ state: Notification.permission })
          : originalQuery(parameters));
    });

    await page.evaluateOnNewDocument(() => {
      // Overwrite the `plugins` property to use a custom getter.
      Object.defineProperty(navigator, 'plugins', {
        // This just needs to have `length > 0` for the current test,
        // but we could mock the plugins too if necessary.
        get: () => [1, 2, 3, 4, 5],
      });
    });

    await page.evaluateOnNewDocument(() => {
      // Overwrite the `languages` property to use a custom getter.
      Object.defineProperty(navigator, 'languages', {
        get: () => ['nl'],
      });
    });

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'nl',
    });
    await page.goto(
      `https://online.secure-logistics.nl/Deltalinqs?LastName=${lastName}&BirthDate=${birthDate}`
    );
    console.log(
      `https://online.secure-logistics.nl/Deltalinqs?LastName=${lastName}&BirthDate=${birthDate}`
    );
    // await page.solveRecaptchas();
    // recaptcha-verify-button

    const [button] = await page.$x("//button[contains(., 'zoeken')]");

    console.log(button);
    if (button) {
      //   await page.waitForTimeout(2000)
      await button.click();
      await page.waitForTimeout(200);
      const checkCaptcha = await page.evaluate(() => {
        let el = document.querySelector('.rc-imageselect');
        return el ? el.innerText : '';
      });
      // await page.screenshot({ path: 'example1.png' });
      if (checkCaptcha !== null && checkCaptcha !== undefined) {
        await page.solveRecaptchas();
        await Promise.all([page.waitForNavigation()]);
        const html = await page.evaluate(
          () => document.querySelector('*').outerHTML
        );
        const converted = await formatData(
          tabletojson.convert(html),
          lastName,
          birthDate
        );
        return Promise.resolve(converted);
      } else {
        const html = await page.evaluate(
          () => document.querySelector('*').outerHTML
        );
        const converted = await formatData(
          tabletojson.convert(html),
          lastName,
          birthDate
        );
        return Promise.resolve(converted);
        console.log(converted);
      }
      // await page.screenshot({ path: 'example.png' });
      //   await page.waitForTimeout(500);
    }
    return Promise.resolve();
  } catch (error) {
    console.error(error);
    return Promise.reject(error);
  }
};

app.get('/scrap/:last_name/:birth_date', async (req, res) => {
  const data = await scrap(req.params.last_name, req.params.birth_date);
  res.send(data);
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
