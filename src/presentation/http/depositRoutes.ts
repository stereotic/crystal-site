import { Router, Request, Response, NextFunction } from 'express';
import { container } from '../../container';
import { requireAuth } from '../middleware/auth';
import { DatabaseConnection } from '../../infrastructure/database/DatabaseConnection';
import { TelegramUnifiedBot } from '../../infrastructure/telegram';
import { logger } from '../../infrastructure/logger';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Get available wallets
router.get('/wallets', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const db = container.resolve(DatabaseConnection);
    const wallets = await db.query<{ id: number; currency: string; address: string }>(
      'SELECT id, currency, address FROM wallets'
    );

    res.json(wallets);
  } catch (error) {
    logger.error('Error fetching wallets', { error });
    next(error);
  }
});

// Request deposit
router.post('/request', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.session.userId!;
    const { amount, currency } = req.body;

    if (!amount || amount <= 0) {
      res.status(400).json({
        success: false,
        msg: 'Invalid amount'
      });
      return;
    }

    if (!currency) {
      res.status(400).json({
        success: false,
        msg: 'Currency is required'
      });
      return;
    }

    const db = container.resolve(DatabaseConnection);

    // Get user info
    const user = await db.get<{ username: string; worker_id: string | null }>(
      'SELECT username, worker_id FROM users WHERE id = ?',
      [userId]
    );

    if (!user) {
      res.status(404).json({
        success: false,
        msg: 'User not found'
      });
      return;
    }

    // Get wallet address for currency
    const wallet = await db.get<{ address: string }>(
      'SELECT address FROM wallets WHERE currency = ?',
      [currency]
    );

    if (!wallet) {
      res.status(404).json({
        success: false,
        msg: 'Wallet not found for this currency'
      });
      return;
    }

    // Create deposit request
    const requestId = uuidv4();
    const now = Date.now();

    await db.run(
      `INSERT INTO deposit_requests (id, user_id, amount, currency, wallet_address, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [requestId, userId, amount, currency, wallet.address, 'pending', now]
    );

    logger.info('Deposit request created', {
      requestId,
      userId,
      username: user.username,
      amount,
      currency
    });

    res.json({
      success: true,
      requestId,
      walletAddress: wallet.address
    });
  } catch (error) {
    logger.error('Error creating deposit request', { error });
    next(error);
  }
});

// Check payment (sends notification to control bot)
router.post('/check', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.session.userId!;
    const { requestId } = req.body;

    if (!requestId) {
      res.status(400).json({
        success: false,
        msg: 'Request ID is required'
      });
      return;
    }

    const db = container.resolve(DatabaseConnection);

    // Get deposit request
    const request = await db.get<{
      id: string;
      user_id: string;
      amount: number;
      currency: string;
      wallet_address: string;
      status: string;
      notification_sent: number;
    }>(
      'SELECT * FROM deposit_requests WHERE id = ? AND user_id = ?',
      [requestId, userId]
    );

    if (!request) {
      res.status(404).json({
        success: false,
        msg: 'Deposit request not found'
      });
      return;
    }

    // If already processed, return current status
    if (request.status !== 'pending') {
      res.json({
        success: true,
        status: request.status,
        msg: request.status === 'approved' ? 'Payment approved' : 'Payment rejected'
      });
      return;
    }

    // Get user info
    const user = await db.get<{ username: string; worker_id: string | null }>(
      'SELECT username, worker_id FROM users WHERE id = ?',
      [userId]
    );

    if (!user) {
      res.status(404).json({
        success: false,
        msg: 'User not found'
      });
      return;
    }

    // Send notification to unified bot ONLY if not sent before
    if (!request.notification_sent) {
      try {
        const unifiedBot = container.resolve(TelegramUnifiedBot);
        await unifiedBot.sendPaymentNotification(
          request.id,
          user.username,
          request.amount,
          request.wallet_address,
          user.worker_id
        );

        // Mark notification as sent
        await db.run(
          'UPDATE deposit_requests SET notification_sent = 1 WHERE id = ?',
          [requestId]
        );

        logger.info('Payment notification sent', {
          requestId: request.id,
          username: user.username,
          amount: request.amount
        });

        res.json({
          success: true,
          status: request.status,
          msg: 'Payment verification request sent to admin'
        });
      } catch (error) {
        logger.error('Failed to send payment notification', { error });
        res.status(500).json({
          success: false,
          msg: 'Failed to send notification to admin'
        });
      }
    } else {
      // Notification already sent, just return status
      res.json({
        success: true,
        status: request.status,
        msg: 'Waiting for admin confirmation'
      });
    }
  } catch (error) {
    logger.error('Error checking deposit', { error });
    next(error);
  }
});

export default router;
