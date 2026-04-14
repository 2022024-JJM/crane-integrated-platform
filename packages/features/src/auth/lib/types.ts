export type UserRole = 'philly' | 'ocean' | 'goliath';

export interface AuthUser {
  id: string;
  role: UserRole;
}
