export interface CardFilterDTO {
  region?: string;
  type?: string;
  bank?: string;
  bin?: string;
  isNonVbv?: boolean;
  isFullz?: boolean;
  isRefundable?: boolean;
  minPrice?: number;
  maxPrice?: number;
}

export interface CardResponseDTO {
  id: string;
  region: string;
  type: string;
  cardNumber: string; // masked
  exp: string;
  holderName: string;
  bank: string;
  bin: string;
  priceUsd: number;
  isNonVbv: boolean;
  isFullz: boolean;
  isRefundable: boolean;
}

export interface CardFullResponseDTO extends CardResponseDTO {
  cvv: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
}

export interface CreateCardDTO {
  region: string;
  type: string;
  cardNumber: string;
  exp: string;
  cvv: string;
  holderName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  bank: string;
  bin: string;
  priceCents: number;
  isNonVbv?: boolean;
  isFullz?: boolean;
  isRefundable?: boolean;
}
