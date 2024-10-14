const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");
const { bookCourse } = require("./automatedBooking");
const player = require("play-sound")((opts = {}));

// Path to courses.json
const coursesPath = path.join(__dirname, "courses.json");

// Global booking lock
let isBooking = false;

// Function to load courses from courses.json
function loadCourses() {
  const data = fs.readFileSync(coursesPath, "utf-8");
  return JSON.parse(data).courses;
}

// Function to save courses to courses.json
function saveCourses(courses) {
  fs.writeFileSync(coursesPath, JSON.stringify({ courses }, null, 2));
}

// Function to calculate the next occurrence of a course
function getNextCourseDate(dayOfWeek, time) {
  const days = {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
  };

  const now = new Date();
  const courseDayNumber = days[dayOfWeek];
  const [hour, minute] = time.split(":").map(Number);

  let courseDate = new Date(now);
  courseDate.setHours(hour, minute, 0, 0);

  // Set the correct day of the week
  const currentDay = courseDate.getDay();
  let diff = (courseDayNumber + 7 - currentDay) % 7;
  if (diff === 0 && courseDate < now) {
    diff = 7;
  }
  courseDate.setDate(courseDate.getDate() + diff);

  return courseDate;
}

// Function to schedule reactivation of a course
function scheduleReactivation(course) {
  const now = new Date();
  const nextCourseDate = getNextCourseDate(course.courseDay, course.courseTime);

  // Reactivate 2 minutes after the course starts
  const reactivationTime = nextCourseDate.getTime() + 2 * 60 * 1000;
  const timeUntilReactivation = reactivationTime - now.getTime();

  if (timeUntilReactivation > 0) {
    setTimeout(() => {
      const courses = loadCourses();
      const targetCourse = courses.find((c) => c.id === course.id);
      if (targetCourse) {
        targetCourse.active = true;
        targetCourse.bookingDate = null;
        saveCourses(courses);
        console.log(`Reactivated course: ${targetCourse.id}`);
      }
    }, timeUntilReactivation);
    console.log(
      `Scheduled reactivation for course: ${course.id} in ${Math.round(
        timeUntilReactivation / 1000
      )} seconds`
    );
  } else {
    console.warn(
      `Reactivation time for course ${course.id} is in the past. Skipping scheduling.`
    );
  }
}

// Updated scrape function with booking lock
async function scrape(url, selector, course) {
  if (!course.active) {
    return;
  }

  // Check if a booking is already in progress
  if (isBooking) {
    console.log(`Booking in progress. Skipping course: ${course.id}`);
    return;
  }

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setDefaultNavigationTimeout(0);
  await page.goto(url);

  try {
    const el = await page.$(selector);
    if (!el) {
      console.log(`Element not found for course: ${course.id}`);
      await browser.close();
      return;
    }

    const src = await el.getProperty("value");
    const srcTxt = await src.jsonValue();

    console.log(`///${course.id} is currently: ${srcTxt}///`);

    if (srcTxt !== "Warteliste") {
      // Acquire the booking lock
      isBooking = true;
      console.log(`Attempting to book course: ${course.id}`);

      await bookCourse(url, selector);
      console.error(
        `Free spot available for ${course.id}!!!!!!!!!!!!!!!!!!!!!!!!!!!!!`
      );

      // Update courses.json
      const courses = loadCourses();
      const targetCourse = courses.find((c) => c.id === course.id);
      if (targetCourse) {
        targetCourse.active = false;
        targetCourse.bookingDate = new Date().toISOString();
        saveCourses(courses);
        console.log(
          `Booked course: ${course.id} at ${targetCourse.bookingDate}`
        );
      }

      // Play alarm
      player.play("alarm.mp3", function (err) {
        if (err) console.error(`Could not play sound: ${err}`);
      });

      // Schedule reactivation
      scheduleReactivation(course);

      // Release the booking lock
      isBooking = false;
    }
  } catch (error) {
    console.error(`Error scraping course ${course.id}:`, error);
    // Ensure the booking lock is released in case of an error
    isBooking = false;
  } finally {
    await browser.close();
  }
}

// URL to scrape
const volleyballURL =
  "https://buchung.hochschulsport-hamburg.de/angebote/Wintersemester_2024_2025/_Volleyball.html";

// Function to handle scraping with booking lock
async function handleScraping() {
  try {
    console.log("///////////////////////////////////////");
    const courses = loadCourses();

    for (const course of courses) {
      // If a booking is in progress, wait until it's done
      if (isBooking) {
        console.log("Booking in progress. Waiting to continue scraping...");
        return;
      }

      // Start scraping the course
      await scrape(volleyballURL, course.cssSelector, course);
    }

    console.log("///////////////////////////////////////");
  } catch (error) {
    console.log(error);
  }
}

// Initialize the interval using recursive setTimeout for better control
function startScrapingTimer(intervalMs) {
  const timer = setInterval(() => {
    handleScraping();
  }, intervalMs);

  return timer;
}

// Start the scraping timer (every 5 seconds)
const scrapingInterval = 5000; // 5000 milliseconds = 5 seconds
const timer = startScrapingTimer(scrapingInterval);

// Optional: Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("Shutting down gracefully...");
  clearInterval(timer);
  process.exit();
});
