// logger.js
const chalk = require("chalk");

class Logger {
  constructor() {
    this.isBooking = false;
  }

  setBookingStatus(status) {
    this.isBooking = status;
  }

  getTimeStamp() {
    return new Date().toLocaleString();
  }

  info(message) {
    if (!this.isBooking) {
      console.log(
        chalk.blue(`ℹ️  [INFO - ${this.getTimeStamp()}]: ${message}`)
      );
    }
  }

  warn(message) {
    console.warn(
      chalk.yellow(`⚠️  [WARN - ${this.getTimeStamp()}]: ${message}`)
    );
  }

  error(message) {
    console.error(chalk.red(`❌ [ERROR - ${this.getTimeStamp()}]: ${message}`));
  }

  success(message) {
    console.log(
      chalk.green(`✅ [SUCCESS - ${this.getTimeStamp()}]: ${message}`)
    );
  }

  booking(message) {
    console.log(
      chalk.magenta(`🚀 [BOOKING - ${this.getTimeStamp()}]: ${message}`)
    );
  }
}

module.exports = new Logger();
