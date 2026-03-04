export interface Manager {
  id: number;
  login: string;
  email: string;
  userName: string;
  phone: string;
  active: boolean;
}

export interface CreateManagerRequest {
  login: string;
  email: string;
  userName: string;
  phone: string;
  password: string;
  active: boolean;
}

export interface UpdateManagerRequest {
  id: number;
  userName?: string;
  email?: string;
  phone?: string;
  profileImg?: string;
  active?: boolean;
}

export interface ResetUserPasswordRequest {
  email: string;
  password: string;
}

export interface Level2User {
  id: number;
  login: string;
  email: string;
  userName: string;
  phone: string;
  profileImg?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
