const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000/api');

class ApiService {
  constructor() {
    this.baseUrl = API_URL;
  }

  async getToken() {
    const { auth } = await import('./firebase');
    const user = auth.currentUser;
    if (user) {
      return await user.getIdToken();
    }
    return null;
  }

  async request(endpoint, options = {}) {
    const token = await this.getToken();
    
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Something went wrong');
    }

    return data;
  }

  // Auth endpoints
  async checkEmail(email) {
    return this.request('/auth/check-email', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async validateRole(email, expectedRole) {
    return this.request('/auth/validate-role', {
      method: 'POST',
      body: JSON.stringify({ email, expectedRole }),
    });
  }

  async registerStudent(data) {
    return this.request('/auth/register-student', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async linkFirebase(email, firebaseUid) {
    return this.request('/auth/link-firebase', {
      method: 'POST',
      body: JSON.stringify({ email, firebaseUid }),
    });
  }

  async getMe() {
    return this.request('/auth/me');
  }

  // Student endpoints
  async createRequest(data) {
    return this.request('/student/request', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getStudentRequests() {
    return this.request('/student/requests');
  }

  // Advisor endpoints
  async getAdvisorRequests() {
    return this.request('/advisor/requests');
  }

  async getAdvisorHistory() {
    return this.request('/advisor/history');
  }

  async approveAsAdvisor(requestId, remarks) {
    return this.request(`/advisor/approve/${requestId}`, {
      method: 'POST',
      body: JSON.stringify({ remarks }),
    });
  }

  async rejectAsAdvisor(requestId, remarks) {
    return this.request(`/advisor/reject/${requestId}`, {
      method: 'POST',
      body: JSON.stringify({ remarks }),
    });
  }

  // HOD endpoints
  async getHodRequests() {
    return this.request('/hod/requests');
  }

  async approveAsHod(requestId, remarks) {
    return this.request(`/hod/approve/${requestId}`, {
      method: 'POST',
      body: JSON.stringify({ remarks }),
    });
  }

  async rejectAsHod(requestId, remarks) {
    return this.request(`/hod/reject/${requestId}`, {
      method: 'POST',
      body: JSON.stringify({ remarks }),
    });
  }

  // Security endpoints
  async verifyQr(qrToken) {
    return this.request('/security/verify-qr', {
      method: 'POST',
      body: JSON.stringify({ qrToken }),
    });
  }

  async getScanHistory() {
    return this.request('/security/scan-history');
  }

  // Admin endpoints
  async seedFaculty() {
    return this.request('/admin/seed-faculty', {
      method: 'POST',
    });
  }

  async getFaculty() {
    return this.request('/admin/faculty');
  }
}

export const api = new ApiService();
export default api;
