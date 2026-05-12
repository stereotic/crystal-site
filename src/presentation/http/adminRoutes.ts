import { Router, Request, Response, NextFunction } from 'express';
import { container } from '../../container';
import { DatabaseConnection } from '../../infrastructure/database/DatabaseConnection';
import { logger } from '../../infrastructure/logger';

const router = Router();

// Middleware to check if user is admin
async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.session.userId) {
      res.status(401).json({ success: false, msg: 'Not authenticated' });
      return;
    }

    const db = container.resolve(DatabaseConnection);
    const user = await db.get<{ is_admin: number }>(
      'SELECT is_admin FROM users WHERE id = ?',
      [req.session.userId]
    );

    if (!user || !user.is_admin) {
      res.status(403).json({ success: false, msg: 'Access denied' });
      return;
    }

    next();
  } catch (error) {
    logger.error('Error checking admin status', { error });
    res.status(500).json({ success: false, msg: 'Server error' });
  }
}

// Get all wallets
router.get('/wallets', requireAdmin, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const db = container.resolve(DatabaseConnection);
    const wallets = await db.query<{ id: number; currency: string; address: string }>(
      'SELECT * FROM wallets ORDER BY id'
    );

    res.json({
      success: true,
      wallets
    });
  } catch (error) {
    logger.error('Error fetching wallets', { error });
    next(error);
  }
});

// Update wallet address
router.post('/wallets/update', requireAdmin, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { currency, address } = req.body;

    if (!currency || !address) {
      res.status(400).json({
        success: false,
        msg: 'Currency and address are required'
      });
      return;
    }

    if (address.length < 10) {
      res.status(400).json({
        success: false,
        msg: 'Address is too short'
      });
      return;
    }

    const validCurrencies = ['BTC', 'ETH', 'USDT_TRC20', 'USDT_BEP20'];
    if (!validCurrencies.includes(currency)) {
      res.status(400).json({
        success: false,
        msg: 'Invalid currency'
      });
      return;
    }

    const db = container.resolve(DatabaseConnection);

    // Update or insert wallet
    const result = await db.run(
      'UPDATE wallets SET address = ? WHERE currency = ?',
      [address, currency]
    );

    if (result.changes === 0) {
      // Insert if doesn't exist
      await db.run(
        'INSERT INTO wallets (currency, address) VALUES (?, ?)',
        [currency, address]
      );
    }

    logger.info('Wallet address updated via admin panel', {
      currency,
      address: address.substring(0, 20) + '...',
      userId: req.session.userId
    });

    res.json({
      success: true,
      msg: 'Wallet address updated successfully'
    });
  } catch (error) {
    logger.error('Error updating wallet address', { error });
    next(error);
  }
});

// Get all admins
router.get('/users', requireAdmin, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const db = container.resolve(DatabaseConnection);
    const admins = await db.query<{ id: string; username: string; email: string }>(
      'SELECT id, username, email FROM users WHERE is_admin = 1'
    );

    res.json({
      success: true,
      admins
    });
  } catch (error) {
    logger.error('Error fetching admins', { error });
    next(error);
  }
});

// Add admin
router.post('/users/add', requireAdmin, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { username } = req.body;

    if (!username) {
      res.status(400).json({
        success: false,
        msg: 'Username is required'
      });
      return;
    }

    const db = container.resolve(DatabaseConnection);

    // Find user by username
    const user = await db.get<{ id: string; is_admin: number }>(
      'SELECT id, is_admin FROM users WHERE username = ?',
      [username]
    );

    if (!user) {
      res.json({
        success: false,
        msg: 'User not found'
      });
      return;
    }

    if (user.is_admin) {
      res.json({
        success: false,
        msg: 'User is already an admin'
      });
      return;
    }

    // Make user admin
    await db.run(
      'UPDATE users SET is_admin = 1 WHERE id = ?',
      [user.id]
    );

    logger.info('User promoted to admin', {
      username,
      userId: user.id,
      promotedBy: req.session.userId
    });

    res.json({
      success: true,
      msg: 'User is now an admin'
    });
  } catch (error) {
    logger.error('Error adding admin', { error });
    next(error);
  }
});

// Remove admin
router.post('/users/remove', requireAdmin, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.body;

    if (!userId) {
      res.status(400).json({
        success: false,
        msg: 'User ID is required'
      });
      return;
    }

    // Prevent removing yourself
    if (userId === req.session.userId) {
      res.json({
        success: false,
        msg: 'Cannot remove your own admin rights'
      });
      return;
    }

    const db = container.resolve(DatabaseConnection);

    // Remove admin rights
    await db.run(
      'UPDATE users SET is_admin = 0 WHERE id = ?',
      [userId]
    );

    logger.info('Admin rights removed', {
      userId,
      removedBy: req.session.userId
    });

    res.json({
      success: true,
      msg: 'Admin rights removed'
    });
  } catch (error) {
    logger.error('Error removing admin', { error });
    next(error);
  }
});

export default router;
