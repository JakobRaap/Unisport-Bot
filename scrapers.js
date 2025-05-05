const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");
const cheerio = require("cheerio");
const { bookCourse } = require("./automatedBooking");
const logger = require("./logger"); // Import the logger

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
        logger.info(`Reactivated course: ${targetCourse.id}`);
      }
    }, timeUntilReactivation);
    logger.info(
      `Scheduled reactivation for course: ${course.id} in ${Math.round(
        timeUntilReactivation / 1000
      )} seconds`
    );
  } else {
    logger.warn(
      `Reactivation time for course ${course.id} is in the past. Skipping scheduling.`
    );
  }
}

// Function to fetch and parse the page
async function fetchAndParsePage(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "de,en-US;q=0.7,en;q=0.3",
      "Upgrade-Insecure-Requests": "1",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      Priority: "u=0, i",
    },
    method: "GET",
  });
  const html = await response.text();
  const $ = cheerio.load(html);
  return $;
}

// Function to check course availability
async function checkCourseAvailability($, course) {
  if (!course.active) {
    return;
  }

  // Check if a booking is already in progress
  if (isBooking) {
    logger.info(`Booking in progress. Skipping course: ${course.id}`);
    return;
  }

  try {
    const el = $(course.cssSelector);
    if (!el.length) {
      logger.warn(`Element not found for course: ${course.id}`);
      return;
    }

    const srcTxt = el.val();

    logger.info(`Course ${course.id} is currently: ${srcTxt}`);

    if (srcTxt !== "Warteliste") {
      // Acquire the booking lock
      isBooking = true;
      logger.setBookingStatus(true);

      logger.booking(`Free spot available for course ${course.id}!`);
      logger.booking(`Attempting to book course: ${course.id}`);
      const isBookingCourse = await bookCourse(
        volleyballURL,
        course.cssSelector
      );
      if (isBookingCourse) {
        logger.success(`Booking successful for course: ${course.id}`);
      } else {
        logger.error(`Booking failed for course: ${course.id}`);
      }

      if (isBookingCourse) {
        // Update courses.json
        const courses = loadCourses();
        const targetCourse = courses.find((c) => c.id === course.id);
        if (targetCourse) {
          targetCourse.active = false;
          targetCourse.bookingDate = new Date().toISOString();
          saveCourses(courses);
          logger.success(
            `Booked course: ${course.id} at ${targetCourse.bookingDate}`
          );
        }

        // Schedule reactivation
        scheduleReactivation(course);
      }

      // Release the booking lock
      isBooking = false;
      logger.setBookingStatus(false);
    }
  } catch (error) {
    logger.error(`Error checking course ${course.id}: ${error}`);
    // Ensure the booking lock is released in case of an error
    isBooking = false;
    logger.setBookingStatus(false);
  }
}

// URL to scrape
const beachvolleyballURL =
  "https://buchung.hochschulsport-hamburg.de/angebote/Sommersemester_2025/_Beachvolleyball.html";
const volleyballURL =
  "https://buchung.hochschulsport-hamburg.de/angebote/Sommersemester_2025/_Volleyball.html";
const volleyballURLwinter =
  "https://buchung.hochschulsport-hamburg.de/angebote/Wintersemester_2024_2025/_Volleyball.html";

// Function to handle scraping
async function handleScraping() {
  try {
    logger.info("///////////////////////////////////////");
    logger.info("Starting scraping...");
    const courses = loadCourses();

    // Fetch and parse the page once
    const $ = await fetchAndParsePage(beachvolleyballURL);

    for (const course of courses) {
      await checkCourseAvailability($, course);
    }

    logger.info("Finished scraping.");
    logger.info("///////////////////////////////////////");
  } catch (error) {
    logger.error(error);
  }
}

// Initialize the interval using setInterval
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
  logger.warn("Shutting down gracefully...");
  clearInterval(timer);
  process.exit();
});
