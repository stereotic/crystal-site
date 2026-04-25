export interface RegisterUserDTO {
  username: string;
  email?: string;
  password: string;
  referralCode?: string;
}

export interface LoginUserDTO {
  login: string; // username or email
  password: string;
}

export interface UserResponseDTO {
  id: string;
  username: string;
  email: string | null;
  balanceUsd: number;
  isPremium: boolean;
  isWorker: boolean;
  telegramUsername: string | null;
}

export interface UpdateUserDTO {
  email?: string;
  telegramId?: string;
  telegramUsername?: string;
}
