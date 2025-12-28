
export interface BookPage {
  pageNumber: number;
  text: string;
  imagePrompt: string;
  imageUrl?: string;
  isGenerating?: boolean;
}

export type ImageSize = '1K' | '2K' | '4K';

export interface BookProject {
  title: string;
  topic: string;
  pages: BookPage[];
  imageSize: ImageSize;
  seo?: {
    title: string;
    description: string;
    keywords: string[];
  };
}

export enum AppStep {
  PLAN = 'PLAN',
  GENERATE = 'GENERATE',
  SEO = 'SEO',
  PREVIEW = 'PREVIEW'
}
