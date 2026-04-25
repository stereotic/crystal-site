import { inject, injectable } from 'tsyringe';
import { IUserRepository } from '../../domain/repositories';
import { User } from '../../domain/entities';
import { Username, Email, Password, Money } from '../../domain/value-objects';
import { RegisterUserDTO, UserResponseDTO } from '../dtos';
import { ConflictError } from '../../domain/errors';

@injectable()
export class RegisterUserUseCase {
  constructor(
    @inject('IUserRepository') private userRepository: IUserRepository
  ) {}

  async execute(dto: RegisterUserDTO): Promise<UserResponseDTO> {
    // Validate and create value objects
    const username = Username.create(dto.username);
    const email = dto.email ? Email.create(dto.email) : null;
    const password = await Password.create(dto.password);

    // Check if user already exists
    const exists = await this.userRepository.exists(username, email);
    if (exists) {
      throw new ConflictError('User with this username or email already exists');
    }

    // Create user entity
    const user = User.create({
      username,
      email,
      password,
      balance: Money.zero(),
      isPremium: false,
      isWorker: false,
      isBanned: false,
      telegramId: null,
      telegramUsername: null,
      workerId: null,
      partnerId: null,
      referrerId: null,
      referralCode: this.generateReferralCode(),
      lastLoginAt: null,
    });

    // Save to repository
    await this.userRepository.save(user);

    return this.mapToDTO(user);
  }

  private generateReferralCode(): string {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
  }

  private mapToDTO(user: User): UserResponseDTO {
    return {
      id: user.getId(),
      username: user.getUsername().getValue(),
      email: user.getEmail()?.getValue() || null,
      balanceUsd: user.getBalance().getDollars(),
      isPremium: user.isPremium(),
      isWorker: user.isWorker(),
      telegramUsername: user.getTelegramUsername(),
    };
  }
}
