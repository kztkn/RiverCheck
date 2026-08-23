export interface GameStoryPhoto {
  byteSize: number;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  uploadedAt: string;
}

export interface OwnGameStoryPost {
  id: string;
  body: string | null;
  createdAt: string;
  photo: GameStoryPhoto | null;
  updatedAt: string;
}

export interface PublishedGameStoryPost extends OwnGameStoryPost {
  groupPlayerId: string;
  displayName: string;
  avatarUpdatedAt: string | null;
}
