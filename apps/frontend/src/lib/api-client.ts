import axios, { AxiosError } from 'axios';

// Standard response envelope from backend
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  meta: {
    requestId: string;
    timestamp: string;
  };
}

// Create axios instance
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  timeout: 10000
});

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiResponse<unknown>>) => {
    // Extract error from standard envelope
    if (error.response?.data?.error) {
      const apiError = new Error(error.response.data.error.message);
      (apiError as any).code = error.response.data.error.code;
      throw apiError;
    }
    throw error;
  }
);
