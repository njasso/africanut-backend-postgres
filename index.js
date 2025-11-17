import pkg from "pg";
const { Client } = pkg;

// Pool de connexions pour de meilleures performances
import { Pool } from "pg";

export default async ({ req, res, log, error }) => {
  let client;
  
  try {
    log("🔗 Connexion à PostgreSQL Neon...");

    // Vérifier que la variable d'environnement est définie
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL non définie dans les variables d'environnement");
    }

    client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      },
      connectionTimeoutMillis: 5000, // 5 secondes timeout
      idleTimeoutMillis: 30000,
    });

    await client.connect();
    log("✅ Connecté à PostgreSQL Neon !");

    // Vérifier les tables disponibles
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;
    
    const tablesResult = await client.query(tablesQuery);
    log(`📋 Tables disponibles: ${tablesResult.rows.map(row => row.table_name).join(', ')}`);

    // Exécuter une requête basée sur la méthode HTTP
    let result;
    const method = req.method || 'GET';
    
    switch (method) {
      case 'GET':
        // Récupérer les données de la table companies si elle existe
        if (tablesResult.rows.some(row => row.table_name === 'companies')) {
          result = await client.query(`
            SELECT id, slug, name, sector, tagline, "createdAt", "updatedAt"
            FROM companies 
            ORDER BY "createdAt" DESC 
            LIMIT 20
          `);
        } else {
          // Fallback: informations système
          result = await client.query(`
            SELECT 
              current_database() as database_name,
              version() as postgres_version,
              current_user as current_user,
              now() as server_time
          `);
        }
        break;
        
      case 'POST':
        // Exemple d'insertion (à adapter)
        const { action, data } = req.body || {};
        
        if (action === 'test_insert' && data) {
          // Insérer dans une table de test
          result = await client.query(`
            INSERT INTO test_table (name, value) 
            VALUES ($1, $2) 
            RETURNING *
          `, [data.name, data.value]);
        } else {
          result = { rows: [], command: 'SELECT' };
        }
        break;
        
      default:
        result = { rows: [] };
    }

    return res.json({
      success: true,
      method: method,
      tables: tablesResult.rows.map(row => row.table_name),
      data: result.rows,
      count: result.rows.length,
      connection: "PostgreSQL Neon",
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    error("❌ Erreur PostgreSQL:", err);
    
    return res.json({
      success: false,
      error: err.message,
      code: err.code,
      suggestion: getErrorSuggestion(err),
      timestamp: new Date().toISOString()
    }, 500);
    
  } finally {
    // Toujours fermer la connexion
    if (client) {
      try {
        await client.end();
        log("🔌 Connexion fermée proprement");
      } catch (closeError) {
        error("Erreur lors de la fermeture:", closeError);
      }
    }
  }
};

// Fonction utilitaire pour les suggestions d'erreur
function getErrorSuggestion(err) {
  const suggestions = {
    'ECONNREFUSED': 'Vérifiez l\'URL de connexion et que la base de données est active',
    '28000': 'Identifiants de connexion incorrects',
    '3D000': 'La base de données n\'existe pas',
    '42P01': 'La table n\'existe pas',
    'ENOTFOUND': 'Impossible de résoudre l\'hôte de la base de données'
  };
  
  return suggestions[err.code] || 'Vérifiez la configuration de la base de données';
}
