import { loadEnvironment } from '../config/environment';
import { runAutoClockOut } from '../jobs/autoClockOut';

loadEnvironment();

runAutoClockOut()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
