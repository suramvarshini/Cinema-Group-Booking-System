import axios from 'axios';

// In development, Vite proxies '/api' to 'http://localhost:5000/api'
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 15000
});

// Response error normalizer
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const errorData = error.response?.data || {
      message: error.message || 'An unexpected network error occurred'
    };
    return Promise.reject({
      status: error.response?.status,
      data: errorData,
      message: errorData.message || 'Request failed'
    });
  }
);

export const api = {
  // Movies
  getMovies: async () => {
    const res = await apiClient.get('/movies');
    return res.data;
  },
  getMovieById: async (movieId) => {
    const res = await apiClient.get(`/movies/${movieId}`);
    return res.data;
  },

  // Showtimes
  getShowtimes: async (movieId) => {
    const res = await apiClient.get(`/showtimes/${movieId}`);
    return res.data;
  },
  getShowtimeDetail: async (showtimeId) => {
    const res = await apiClient.get(`/showtimes/detail/${showtimeId}`);
    return res.data;
  },

  // Seats
  getSeats: async (showtimeId) => {
    const res = await apiClient.get(`/seats/${showtimeId}`);
    return res.data;
  },

  // Bookings (Mutex synchronized)
  createBooking: async (bookingData) => {
    // bookingData: { customerName, customerEmail, showtimeId, seatIds }
    const res = await apiClient.post('/bookings', bookingData);
    return res.data;
  },
  getBooking: async (bookingId) => {
    const res = await apiClient.get(`/bookings/${bookingId}`);
    return res.data;
  },
  getAllBookings: async () => {
    const res = await apiClient.get('/bookings');
    return res.data;
  },
  cancelBooking: async (bookingId) => {
    const res = await apiClient.delete(`/bookings/${bookingId}`);
    return res.data;
  },

  // Dashboard Stats
  getDashboardStats: async () => {
    const res = await apiClient.get('/dashboard/stats');
    return res.data;
  }
};

export default api;
