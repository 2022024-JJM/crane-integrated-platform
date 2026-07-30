export type UserRole = 'philly' | 'ocean' | 'goliath' | 'mro' | 'hmi' | 'hmi2';

export interface AuthUser {
  id: string;
  role: UserRole;
}
