export interface VisualRequest {
  productName: string;
  customRequirements: string;
  referenceImage?: string;
}

export type AppState = 'idle' | 'generating' | 'completed';