export interface GameHighlightPhoto {
  byteSize: number;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  uploadedAt: string;
}

export interface GameHighlight {
  text: string | null;
  photo: GameHighlightPhoto | null;
  updatedAt: string | null;
}
