require("dotenv").config();
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

// Destructure environment variables
const { EMAIL, PASSWORD } = process.env;

// Validate environment variables
if (!EMAIL || !PASSWORD) {
  console.error("ERROR: EMAIL and PASSWORD must be set in the .env file.");
  process.exit(1);
}

// Constants for selectors
const SELECTORS = {
  bookingButton: "#bs_tr4EB9C5B956 > td.bs_sbuch > input",
  buchenButton: 'input.inlbutton.buchen[value="buchen"]',
  loginDiv: "#bs_pw_anmlink",
  emailInput:
    "#bs_pw_anm > div:nth-child(2) > div:nth-child(2) > input:nth-child(1)",
  passwordInput:
    "#bs_pw_anm > div:nth-child(3) > div:nth-child(2) > input:nth-child(1)",
  loginButton:
    "div.bs_form_foot:nth-child(5) > div:nth-child(1) > div:nth-child(2) > input:nth-child(1)",
  termsAndConditions: "#bs_bed > label:nth-child(1) > input:nth-child(1)",
  finalizeBookingButton: "#bs_submit",
  submitBookingButton: "div.bs_right > input:nth-child(1)",
  notSuccessfulText: "#bs_form_main > div > div > div.bs_text_red.bs_text_big",
  alreadyBookedText: ".bs_meldung > div:nth-child(2)",
};

async function bookCourse(courseUrl, bookingButtonSelector) {
  let browser;
  try {
    // Launch Puppeteer
    browser = await puppeteer.launch({
      headless: true,
      slowMo: 90,
      devtools: false,
      defaultViewport: null,
      args: [
        "--start-maximized",
        "--disable-popup-blocking",
        "--no-sandbox",
        "--disable-setuid-sandbox",
      ],
    });

    const [page] = await browser.pages();

    // Handle unexpected dialogs
    page.on("dialog", async (dialog) => {
      console.log(`Dialog message: ${dialog.message()}`);
      await dialog.dismiss();
    });

    // Navigate to the course booking page
    await page.goto(courseUrl, { waitUntil: "networkidle0", timeout: 60000 });
    console.log(`Navigated to: ${courseUrl}`);

    // Modify link behaviors to open in the same tab
    await page.evaluate(() => {
      document.querySelectorAll('a[target="_blank"]').forEach((link) => {
        link.removeAttribute("target");
      });
      window.open = (url) => {
        window.location.href = url;
      };
    });
    console.log("Modified link behaviors to open in the same tab.");

    // Wait for the booking button to appear
    await page.waitForSelector(bookingButtonSelector, {
      visible: true,
      timeout: 60000,
    });
    console.log("Booking button is visible.");

    // Click the booking button
    await page.click(bookingButtonSelector);
    console.log("Clicked the booking button.");

    // Wait for new page/tab to open
    await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait for 5 seconds

    const pages = await browser.pages();
    const newPage = pages.find((p) => p !== page);

    if (!newPage) {
      console.error("No new tab detected after clicking the booking button.");
      return;
    }

    // Bring the new page to front
    await newPage.bringToFront();
    console.log("Switched to the new tab.");

    // Wait for the "buchen" button and click it
    await newPage.waitForSelector(SELECTORS.buchenButton, {
      visible: true,
      timeout: 60000,
    });
    await Promise.all([
      newPage.waitForNavigation({ waitUntil: "networkidle0", timeout: 60000 }),
      newPage.click(SELECTORS.buchenButton),
    ]);
    console.log(
      'Clicked the "buchen" button and navigated to the confirmation page.'
    );

    // Handle login
    await newPage.waitForSelector(SELECTORS.loginDiv, {
      visible: true,
      timeout: 60000,
    });
    await newPage.click(SELECTORS.loginDiv);
    console.log("Clicked the login link.");

    await newPage.waitForSelector(SELECTORS.emailInput, {
      visible: true,
      timeout: 60000,
    });
    await newPage.type(SELECTORS.emailInput, EMAIL, { delay: 10 });
    await newPage.type(SELECTORS.passwordInput, PASSWORD, { delay: 10 });
    console.log("Entered email and password.");

    await Promise.all([
      newPage.waitForNavigation({ waitUntil: "networkidle0", timeout: 60000 }),
      newPage.click(SELECTORS.loginButton),
    ]);
    console.log("Clicked the login button and navigated.");

    // Agree to terms and conditions
    await newPage.waitForSelector(SELECTORS.termsAndConditions, {
      visible: true,
      timeout: 60000,
    });
    await newPage.click(SELECTORS.termsAndConditions);
    console.log("Agreed to terms and conditions.");

    // Finalize the booking
    await newPage.waitForSelector(SELECTORS.finalizeBookingButton, {
      visible: true,
      timeout: 60000,
    });
    await newPage.click(SELECTORS.finalizeBookingButton);
    console.log("Clicked the finalize booking button.");

    // Submit the booking
    await newPage.waitForSelector(SELECTORS.submitBookingButton, {
      visible: true,
      timeout: 60000,
    });
    await newPage.click(SELECTORS.submitBookingButton);
    console.log("Submitted the booking.");

    // Check for unsuccessful booking message
    if (await newPage.$(SELECTORS.notSuccessfulText)) {
      // Ensure the directory exists
      const screenshotDir = path.join(__dirname, "booking-screenshots");
      if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
      }

      await newPage.screenshot({
        path: path.join(
          screenshotDir,
          "booking-confirmation" + Date.now() + ".png"
        ),
      });

      if (await newPage.$(SELECTORS.alreadyBookedText)) {
        // Get the text content of the page
        const pageTextContent = await newPage.evaluate(
          () => document.body.innerText
        );

        if (
          pageTextContent.includes(
            "Sie sind für dieses Angebot bereits seit"
          )
        ) {
          console.error("Course is already booked.");
          await browser.close();
          return true;
        }
      }

      console.error("Booking was not successful.");
      await browser.close();
      return false;
    }

    console.log("Booking was successful.");
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Ensure the directory exists
    const screenshotDir = path.join(__dirname, "booking-screenshots");
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    await newPage.screenshot({
      path: path.join(
        screenshotDir,
        "booking-confirmation" + Date.now() + ".png"
      ),
    });

    // Close the browser
    await browser.close();
    console.log("Browser closed.");
    return true;
  } catch (error) {
    console.error("An error occurred during the scraping process:", error);
    if (browser) {
      await browser.close();
      console.log("Browser closed due to an error.");
    }
    return false;
  }
}

module.exports = { bookCourse };
