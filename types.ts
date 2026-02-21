
export enum AspectRatio {
  SQUARE = "1:1",
  PORTRAIT_SMARTPHONE = "9:16",
  LANDSCAPE_SMARTPHONE = "16:9",
  PHOTO_LANDSCAPE = "3:2",
  PHOTO_PORTRAIT = "2:3",
  INSTA_LANDSCAPE = "4:3",
  INSTA_PORTRAIT = "3:4",
  ULTRAWIDE = "21:9"
}

export interface GeneratedPrompt {
  positive: string;
  negative: string;
  metadata: {
    subject: string;
    medium: string;
    setting: string;
  };
}

export interface GenerationHistory {
  id: string;
  timestamp: number;
  userQuery: string;
  generatedPrompt: GeneratedPrompt;
  imageUrl?: string;
  aspectRatio: AspectRatio;
}
