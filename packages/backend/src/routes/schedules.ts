import { Router } from 'express';

const router = Router();

// TODO: implement using termController/termService as the template.
router.get('/', (_req, res) => {
  res.status(501).json({ success: false, error: 'Not implemented yet' });
});

export default router;
