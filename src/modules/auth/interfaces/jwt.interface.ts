export type JwtTokenType = 'access' | 'refresh';

export interface JwtPayload {
  id: string;
  typ: JwtTokenType;
}
