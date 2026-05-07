export type UserRole = 'philly' | 'ocean' | 'goliath' | 'mro';

export interface AuthUser {
  id: string;
  role: UserRole;
}
