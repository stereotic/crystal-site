import dotenv from 'dotenv';

dotenv.config();

class DomainValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

interface Config {
  port: number;
  domain: string;
  sessionSecret: string;
  nodeEnv: string;
  smtp: {
    user: string;
    pass: string;
  };
  telegram: {
    userBotToken: string;
    adminBotToken: string;
    botUsername: string;
    adminIds: string[];
  };
  webhookSecret: string;
  supportBotUrl: string;
}

class ConfigService {
  private config: Config;

  constructor() {
    this.config = this.loadConfig();
    this.validate();
  }

  private loadConfig(): Config {
    return {
      port: parseInt(process.env.PORT || '3000', 10),
      domain: process.env.DOMAIN || 'http://localhost:3000',
      sessionSecret: process.env.SESSION_SECRET || '',
      nodeEnv: process.env.NODE_ENV || 'development',
      smtp: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
      },
      telegram: {
        userBotToken: process.env.USER_BOT_TOKEN || '',
        adminBotToken: process.env.ADMIN_BOT_TOKEN || '',
        botUsername: process.env.BOT_USERNAME || 'CrystalCC_xBot',
        adminIds: (process.env.ADMIN_IDS || '').split(',').map(id => id.trim()).filter(id => id),
      },
      webhookSecret: process.env.WEBHOOK_SECRET || '',
      supportBotUrl: process.env.SUPPORT_BOT_URL || 'http://localhost:3002',
    };
  }

  private validate(): void {
    const required = [
      'sessionSecret',
      'smtp.user',
      'smtp.pass',
      'telegram.userBotToken',
      'telegram.adminBotToken',
      'webhookSecret',
    ];

    for (const key of required) {
      const value = this.getNestedValue(this.config, key);
      if (!value) {
        throw new DomainValidationError(`Missing required config: ${key}`);
      }
    }
  }

  private getNestedValue(obj: unknown, path: string): unknown {
    return path.split('.').reduce((current, key) => {
      return current && typeof current === 'object' ? (current as Record<string, unknown>)[key] : undefined;
    }, obj);
  }

  public get(): Config {
    return this.config;
  }

  public isProduction(): boolean {
    return this.config.nodeEnv === 'production';
  }

  public isDevelopment(): boolean {
    return this.config.nodeEnv === 'development';
  }
}

export const configService = new ConfigService();
export type { Config };
