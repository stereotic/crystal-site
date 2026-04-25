export interface SupportMessage {
  id: string;
  userEmail: string;
  role: 'user' | 'admin';
  text: string;
  fileId?: string;
  fileType?: string;
  timestamp: Date;
}

export interface ISupportRepository {
  saveMessage(message: Omit<SupportMessage, 'id'>): Promise<void>;
  getMessagesByUser(userEmail: string): Promise<SupportMessage[]>;
  getAllMessages(): Promise<SupportMessage[]>;
}
