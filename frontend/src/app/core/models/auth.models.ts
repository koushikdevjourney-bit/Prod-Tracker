export interface AuthUser {
  id: string;
  name: string;
  email: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthResponse {
  message?: string;
  token: string;
  user: AuthUser;
}

export interface ApiErrorBody {
  message?: string;
  errors?: string[];
}
