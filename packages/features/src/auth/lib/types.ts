export type UserRole = 'philly' | 'ocean' | 'goliath' | 'mro' | 'hmi';

export interface AuthUser {
  id: string;
  role: UserRole;
}
