export interface SendSupportMessageDTO {
  userEmail: string;
  message: string;
  fileId?: string;
  fileType?: string;
  chatType?: 'support' | 'premium';
}

export interface SupportMessageResponseDTO {
  id: string;
  role: 'user' | 'admin';
  text: string;
  fileId?: string;
  fileType?: string;
  timestamp: string;
}
