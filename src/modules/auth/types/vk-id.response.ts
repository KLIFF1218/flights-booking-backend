export interface VkIdTokenResponse {
  access_token: string;
  refresh_token: string;
  id_token: string;
  expires_in: number;
  token_type: string;
}

export interface VkExchangeTokenResponse {
  access_token?: string;
  user_id?: string | number;
}

export interface VkUserInfo {
  email?: string;
  first_name?: string;
  last_name?: string;
}
