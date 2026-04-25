"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.configService = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const errors_1 = require("../domain/errors");
dotenv_1.default.config();
class ConfigService {
    config;
    constructor() {
        this.config = this.loadConfig();
        this.validate();
    }
    loadConfig() {
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
    validate() {
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
                throw new errors_1.ValidationError(`Missing required config: ${key}`);
            }
        }
    }
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => {
            return current && typeof current === 'object' ? current[key] : undefined;
        }, obj);
    }
    get() {
        return this.config;
    }
    isProduction() {
        return this.config.nodeEnv === 'production';
    }
    isDevelopment() {
        return this.config.nodeEnv === 'development';
    }
}
exports.configService = new ConfigService();
//# sourceMappingURL=index.js.map