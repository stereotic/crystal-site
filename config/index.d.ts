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
declare class ConfigService {
    private config;
    constructor();
    private loadConfig;
    private validate;
    private getNestedValue;
    get(): Config;
    isProduction(): boolean;
    isDevelopment(): boolean;
}
export declare const configService: ConfigService;
export type { Config };
//# sourceMappingURL=index.d.ts.map