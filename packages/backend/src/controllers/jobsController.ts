import { timingSafeEqual } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config/environment';
import { runAutoClockOut } from '../jobs/autoClockOut';
import { isAtOrAfterOrgLocalTime } from '../lib/orgTime';
import { HttpError } from '../middleware/errorHandler';

function cronAuthorized(header: string | undefined): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header ?? '');
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

export const jobsController = {
  async autoClockOut(req: Request, res: Response, next: NextFunction) {
    try {
      if (!cronAuthorized(req.header('authorization'))) {
        throw new HttpError(401, 'Unauthorized');
      }

      const { enabled, hour, minute } = config.autoClockOut;
      if (!enabled) {
        res.json({ success: true, data: { skipped: true, reason: 'disabled' } });
        return;
      }

      if (!isAtOrAfterOrgLocalTime(new Date(), hour, minute)) {
        res.json({ success: true, data: { skipped: true, reason: 'before cutoff' } });
        return;
      }

      const result = await runAutoClockOut();
      res.json({
        success: true,
        data: {
          skipped: false,
          closedCount: result.closedCount,
          staleCount: result.staleCount,
          skippedCount: result.skippedCount,
        },
      });
    } catch (err) {
      next(err);
    }
  },
};
