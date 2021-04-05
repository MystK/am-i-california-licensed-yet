const puppeteer = require('puppeteer');
const sgMail = require('@sendgrid/mail');

const config = require('./config.js');
sgMail.setApiKey(config.sendgridApiKey);

const sendEmail = ({ found }) => {
  let text = 'Sorry we didn\'t find it yet!\n\nI am checking every 5 minutes and will send you an email right away if found!\n\nYou will get a not found email every hour so you know I am still checking!'
  let subject = 'RE: Not found!'
  if (found) {
    text = 'FOUND! MANUALLY CHECK IT NOW!!!!\n\nhttps://search.dca.ca.gov/?BD=30&TP=114',
    subject = 'YOU ARE A LICENSED PHARMACIST!!!'
  }
  const msg = {
    to: config.to,
    from: config.from,
    subject,
    text,
  };
  return sgMail.send(msg);
}

const getNames = page => page.evaluate(() => {
  const names = [];
  document.querySelectorAll('.post.yes').forEach(node => {
    const name = node.querySelector('footer > ul:nth-child(2) > li:nth-child(1) > h3').innerText;
    names.push(name);
  })
  return names;
});

const isNameFound = names => {
  for (let name of names) {
    if (
      name.includes(config.firstName) &&
      name.includes(config.lastName)
    ) return true;
  }
  return false;
}

const timeout = time => new Promise(res => setTimeout(res, time));

(async () => {
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto('https://search.dca.ca.gov/?BD=30&TP=114');
    await page.waitFor('#firstName');
    await page.type('#firstName', config.firstName),
    await page.type('#lastName', config.lastName),
    await page.click('#srchSubmitHome');

    await page.waitFor('.post.yes');

    let names = await getNames(page);
    let sentHourlyNotFound = false;
    while (!isNameFound(names)) {
      if (!sentHourlyNotFound) {
        sentHourlyNotFound = true;
        setTimeout(() => {
          sentHourlyNotFound = false;
        }, 1000 * 60 * 60);
        await sendEmail({ found: false });
      }
      await timeout(1000 * 60 * 5);
      await page.reload();
      await page.waitFor('.post.yes');
      names = await getNames(page);
    }

    await sendEmail({ found: true });

    await browser.close();
    process.exit();
  } catch (err) {
    console.log(err);
  }
})();
