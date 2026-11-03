export interface RecentChat {
  id: string;
  symbol: string;
  companyName: string;
  createdAt: number;
}

export type ChatActionType =
  | "overview"
  | "invested_earlier"
  | "compare"
  | "follow_up";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content?: string;
  symbol?: string;
  companyName?: string;
  actionType?: ChatActionType;
  compareSymbol?: string;
  timestamp: number;
}
