const puppeteer = require("puppeteer");

var player = require("play-sound")((opts = {}));
const volleyballURL =
  "https://buchung.hochschulsport-hamburg.de/angebote/Sommersemester_2023/_Volleyball.html";
const halle2und3xpath =
  "/html/body/div[1]/div/main/section[1]/article/div[2]/div/div/form/div[4]/div[2]/table/tbody/tr[5]/td[9]/input";
const halle3xpath =
  "/html/body/div[1]/div/main/section[1]/article/div[2]/div/div/form/div[4]/div[2]/table/tbody/tr[6]/td[9]/input";
const beachvolleyballURL =
  "https://buchung.hochschulsport-hamburg.de/angebote/Sommersemester_2023/_Beachvolleyball.html";
const beach3axpath =
  "/html/body/div[1]/div/main/section[1]/article/div[2]/div/div/form/div[6]/div[2]/table/tbody/tr[1]/td[9]/input";
const beach3bxpath =
  "/html/body/div[1]/div/main/section[1]/article/div[2]/div/div/form/div[6]/div[2]/table/tbody/tr[2]/td[9]/input";
const beach3cxpath =
  "/html/body/div[1]/div/main/section[1]/article/div[2]/div/div/form/div[6]/div[2]/table/tbody/tr[3]/td[9]/input";
const beach2axpath =
  "/html/body/div[1]/div/main/section[1]/article/div[2]/div/div/form/div[5]/div[2]/table/tbody/tr[1]/td[9]/input";
const beach2dxpath =
  "/html/body/div[1]/div/main/section[1]/article/div[2]/div/div/form/div[5]/div[2]/table/tbody/tr[4]/td[9]/input";

async function scrape(url, xpath, kurs) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setDefaultNavigationTimeout(0);
  await page.goto(url);
  const [el] = await page.$x(xpath);
  const src = await el.getProperty("value");
  const srcTxt = await src.jsonValue();

  console.log(`///${kurs} ist momentan: ${srcTxt}///`);

  if (srcTxt !== "ausgebucht") {
    console.error(`Freier Platz für ${kurs}!!!!!!!!!!!!!!!!!!!!!!!!!!!!!`);
    player.play("alarm.mp3", function (err) {
      if (err) throw err;
    });
    clearInterval(timer);
  }

  browser.close();
}

const timer = setInterval(() => {
  try {
    console.log("///////////////////////////////////////");
    //scrape(volleyballURL, halle2und3xpath, "Halle 23");
    // scrape(volleyballURL, halle3xpath, "Halle  3");
    //scrape(beachvolleyballURL, beach3axpath, "Beach 3A");
    scrape(beachvolleyballURL, beach3bxpath, "Beach 3B");
    scrape(beachvolleyballURL, beach3cxpath, "Beach 3C");
    //scrape(beachvolleyballURL, beach2axpath, "Beach 2A");
    scrape(beachvolleyballURL, beach2dxpath, "Beach 2D");
    console.log("///////////////////////////////////////");
  } catch (error) {
    console.log(error);
  }
}, 10000);
