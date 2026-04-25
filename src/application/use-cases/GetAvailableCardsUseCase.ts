import { inject, injectable } from 'tsyringe';
import { ICardRepository } from '../../domain/repositories';
import { CardFilterDTO, CardResponseDTO } from '../dtos';
import { Card } from '../../domain/entities';

@injectable()
export class GetAvailableCardsUseCase {
  constructor(
    @inject('ICardRepository') private cardRepository: ICardRepository
  ) {}

  async execute(filters?: CardFilterDTO): Promise<CardResponseDTO[]> {
    const cards = await this.cardRepository.findAvailable(filters);
    return cards.map(this.mapToDTO);
  }

  private mapToDTO(card: Card): CardResponseDTO {
    return {
      id: card.getId(),
      region: card.getRegion(),
      type: card.getType(),
      cardNumber: card.getMaskedCardNumber(),
      exp: card.getExp(),
      holderName: card.getHolderName(),
      bank: card.getBank(),
      bin: card.getBin(),
      priceUsd: card.getPrice().getDollars(),
      isNonVbv: card.isNonVbv(),
      isFullz: card.isFullz(),
      isRefundable: card.isRefundable(),
    };
  }
}
