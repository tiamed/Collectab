export type WorkspaceRole = 'owner' | 'editor' | 'viewer';
export type ViewMode = 'grid' | 'list';
export type SyncStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface JwtPayload {
  sub: string;
  email: string;
}

export interface RefreshJwtPayload extends JwtPayload {
  type: 'refresh';
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
  meta?: { page?: number; pageSize?: number; total?: number };
}

export interface SessionBookmark {
  title: string;
  url: string;
  favicon: string;
}
