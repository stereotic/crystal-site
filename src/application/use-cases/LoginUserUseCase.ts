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
    let user: User | null = null;

    // Check if login contains @ - likely an email
    if (dto.login.includes('@')) {
      try {
        const email = Email.create(dto.login);
        user = await this.userRepository.findByEmail(email);
      } catch (error) {
        // Invalid email format, will try username next
      }
    }

    // If not found by email, try username (without strict validation)
    if (!user) {
      try {
        // Try to find user directly without strict validation
        const username = Username.create(dto.login);
        user = await this.userRepository.findByUsername(username);
      } catch (error) {
        // If Username.create fails, try direct database lookup
        // This handles cases where username doesn't match strict validation
        const db = await import('../../infrastructure/database/DatabaseConnection');
        const dbConn = (await import('../../container')).container.resolve(db.DatabaseConnection);
        const users = await dbConn.query<any>(
          'SELECT * FROM users WHERE username = ? COLLATE NOCASE',
          [dto.login]
        );

        if (users.length > 0) {
          // Reconstruct user from database
          const userRepo = await import('../../infrastructure/database/UserRepository');
          const repo = new userRepo.UserRepository(dbConn);
          user = await repo.findById(users[0].id);
        }
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
