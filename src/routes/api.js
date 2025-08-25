const API_BASE_URL = 'https://africanut-backend-postgres-production.up.railway.app';

/**
 * Fonction utilitaire pour effectuer des requêtes API sécurisées.
 * Elle gère automatiquement les en-têtes, la sérialisation du corps et les erreurs.
 * @param {string} endpoint Le chemin de l'API (ex: '/employees').
 * @param {object} options Les options de la requête fetch.
 * @param {string} options.method La méthode HTTP (par défaut 'GET').
 * @param {object} [options.headers] Les en-têtes de la requête.
 * @param {any} [options.body] Le corps de la requête à envoyer (sera sérialisé en JSON).
 * @returns {Promise<object|string>} Une promesse qui résout avec la réponse JSON ou texte.
 */
export const api = async (endpoint, options = {}) => {
  // Construction de l'URL de manière robuste
  const url = `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : "/" + endpoint}`;

  // Fusion des en-têtes par défaut avec les en-têtes personnalisés
  const mergedHeaders = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const config = {
    method: options.method || 'GET',
    headers: mergedHeaders,
  };

  // Ajout du corps de la requête uniquement pour les méthodes qui en ont un
  if (config.method !== 'GET' && config.method !== 'HEAD' && options.body !== undefined) {
    config.body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(url, config);

    if (!response.ok) {
      let errorMessage = 'Une erreur est survenue lors de la requête.';
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        // Le backend a renvoyé une erreur JSON structurée
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } else {
        // Le backend a renvoyé une erreur en texte brut
        const errorText = await response.text();
        errorMessage = errorText || errorMessage;
      }

      throw new Error(`Erreur API ${response.status}: ${errorMessage}`);
    }

    // Vérification du type de contenu avant de tenter d'analyser le JSON
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    } else {
      // Retourne la réponse texte si ce n'est pas du JSON
      return await response.text();
    }

  } catch (error) {
    // Affiche l'erreur complète dans la console pour le débogage
    console.error("Échec de la requête API:", error);
    throw error;
  }
};
