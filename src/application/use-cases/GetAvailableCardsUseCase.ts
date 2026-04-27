import { inject, injectable } from 'tsyringe';
import { ICardRepository } from '../../domain/repositories';
import { CardFilterDTO, CardResponseDTO } from '../dtos';
import { Card } from '../../domain/entities';

@injectable()
export class GetAvailableCardsUseCase {
  constructor(
    @inject('ICardRepository') private cardRepository: ICardRepository
  ) {}

  async execute(filters?: CardFilterDTO): Promise<any[]> {
    const cards = await this.cardRepository.findAvailable(filters);
    return cards.map(this.mapToDTO);
  }

  private mapToDTO(card: Card): any {
    return {
      id: card.getId(),
      region: card.getRegion(),
      type: card.getType(),
      card_number: card.getCardNumber(), // Use full card number, not masked
      exp: card.getExp(),
      holder_name: card.getHolderName(),
      bank: card.getBank(),
      bin: card.getBin(),
      price_usd: card.getPrice().getDollars(),
      non_vbv: card.isNonVbv(),
      fullz: card.isFullz(),
      refundable: card.isRefundable(),
    };
  }
}
