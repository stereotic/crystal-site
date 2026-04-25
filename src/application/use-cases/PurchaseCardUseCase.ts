import { inject, injectable } from 'tsyringe';
import { IUserRepository, ICardRepository } from '../../domain/repositories';
import { CardFullResponseDTO } from '../dtos';
import { NotFoundError, InsufficientFundsError } from '../../domain/errors';

@injectable()
export class PurchaseCardUseCase {
  constructor(
    @inject('IUserRepository') private userRepository: IUserRepository,
    @inject('ICardRepository') private cardRepository: ICardRepository
  ) {}

  async execute(userId: string, cardId: string): Promise<CardFullResponseDTO> {
    // Get user
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Get card
    const card = await this.cardRepository.findById(cardId);
    if (!card) {
      throw new NotFoundError('Card not found');
    }

    if (!card.isActive()) {
      throw new NotFoundError('Card is no longer available');
    }

    // Check balance
    const price = card.getPrice();
    if (user.getBalance().isLessThan(price)) {
      throw new InsufficientFundsError('Insufficient balance');
    }

    // Deduct balance
    user.deductBalance(price);
    await this.userRepository.update(user);

    // Deactivate card
    card.deactivate();
    await this.cardRepository.update(card);

    // Return full card details
    return {
      id: card.getId(),
      region: card.getRegion(),
      type: card.getType(),
      cardNumber: card.getCardNumber(),
      exp: card.getExp(),
      cvv: card.getCvv(),
      holderName: card.getHolderName(),
      address: card.getAddress(),
      city: card.getCity(),
      state: card.getState(),
      zip: card.getZip(),
      phone: card.getPhone(),
      bank: card.getBank(),
      bin: card.getBin(),
      priceUsd: card.getPrice().getDollars(),
      isNonVbv: card.isNonVbv(),
      isFullz: card.isFullz(),
      isRefundable: card.isRefundable(),
    };
  }
}
