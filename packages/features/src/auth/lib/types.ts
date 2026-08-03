export type UserRole =
  | 'philly'
  | 'ocean'
  | 'goliath'
  | 'mro'
  | 'mro2'
  | 'hmi'
  | 'hmi2';

export interface AuthUser {
  id: string;
  role: UserRole;
}
