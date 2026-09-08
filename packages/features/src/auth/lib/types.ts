export type UserRole =
  | 'philly'
  | 'ocean'
  | 'goliath'
  | 'mro'
  | 'mro2'
  | 'hmi'
  | 'hmi2'
  | 'indoorshop'
  | 'indoorshop-ot'
  | 'keyin';

export interface AuthUser {
  id: string;
  role: UserRole;
}
