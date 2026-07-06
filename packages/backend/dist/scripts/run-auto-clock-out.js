"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const environment_1 = require("../config/environment");
const autoClockOut_1 = require("../jobs/autoClockOut");
(0, environment_1.loadEnvironment)();
(0, autoClockOut_1.runAutoClockOut)()
    .then(() => process.exit(0))
    .catch((err) => {
    console.error(err);
    process.exit(1);
});
