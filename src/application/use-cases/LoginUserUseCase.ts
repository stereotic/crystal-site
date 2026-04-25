import { inject, injectable } from 'tsyringe';
import { IUserRepository } from '../../domain/repositories';
import { Email, Username } from '../../domain/value-objects';
import { LoginUserDTO, UserResponseDTO } from '../dtos';
import { UnauthorizedError, ValidationError } from '../../domain/errors';
import { User } from '../../domain/entities';

@injectable()
export class LoginUserUseCase {
  constructor(
    @inject('IUserRepository') private userRepository: IUserRepository
  ) {}

  async execute(dto: LoginUserDTO): Promise<UserResponseDTO> {
    // Try to parse as email first
    let user: User | null = null;

    try {
      const email = Email.create(dto.login);
      user = await this.userRepository.findByEmail(email);
    } catch {
      // Not an email, try username
      try {
        const username = Username.create(dto.login);
        user = await this.userRepository.findByUsername(username);
      } catch {
        throw new ValidationError('Invalid login format');
      }
    }

    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Authenticate
    const isValid = await user.authenticate(dto.password);
    if (!isValid) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Update last login
    user.updateLastLogin();
    await this.userRepository.update(user);

    return this.mapToDTO(user);
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
