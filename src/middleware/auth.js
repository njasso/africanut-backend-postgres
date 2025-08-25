// src/context/AuthContext.js
import { createContext, useContext, useState, useEffect } from 'react';
import { api, setToken, getToken } from '../services/api';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  });
  const [isAuthenticated, setIsAuthenticated] = useState(!!getToken());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Vérifier l'authentification au chargement de l'application
    const storedUser = localStorage.getItem('user');
    const storedToken = getToken();
    if (storedUser && storedToken) {
      setUser(JSON.parse(storedUser));
      setIsAuthenticated(true);
      setToken(storedToken);
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const response = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      const { token, user } = response;
      if (!token || !user) {
        throw new Error('Réponse invalide du serveur');
      }

      setToken(token);
      setUser(user);
      setIsAuthenticated(true);
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('token', token);
      return { success: true };
    } catch (error) {
      console.error('Erreur de connexion:', error.message);
      return { success: false, message: error.message || 'Échec de la connexion' };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setIsAuthenticated(false);
    setToken(null); // Supprimer le jeton des en-têtes
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
