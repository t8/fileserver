import api from './api';

export interface User {
  userId: number;
  username: string;
  token: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export const authService = {
  async login(credentials: LoginCredentials): Promise<User> {
    const response = await api.post('/auth/login', credentials);
    const user: User = response.data;
    localStorage.setItem('authToken', user.token);
    localStorage.setItem('user', JSON.stringify(user));
    return user;
  },

  logout(): void {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
  },

  getCurrentUser(): User | null {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  },

  isAuthenticated(): boolean {
    return !!localStorage.getItem('authToken');
  },
};

