export interface Manager {
  id: number;
  login: string;
  email: string;
  userName: string;
  phone: string;
  active: boolean;
  userLevel?: 'L1' | 'L2';
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
  login?: string;
  email?: string;
  userName?: string;
  phone?: string;
  active?: boolean;
}
