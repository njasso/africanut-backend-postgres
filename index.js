const { Client } = require('pg');

module.exports = async (context) => {
  const { req, res, log, error } = context;

  try {
    log("🚀 Démarrage de la fonction Africanut PostgreSQL API");

    // Vérifier la variable d'environnement
    if (!process.env.PG_URI) {
      throw new Error("La variable PG_URI est requise");
    }

    log("🔗 Connexion à la base de données...");
    
    const client = new Client({
      connectionString: process.env.PG_URI,
      ssl: { rejectUnauthorized: false }
    });

    await client.connect();
    log("✅ Connecté à PostgreSQL avec succès");

    // Test de base avec version PostgreSQL
    const versionResult = await client.query('SELECT version();');
    log(`📊 PostgreSQL: ${versionResult.rows[0].version.split(',')[0]}`);

    // Récupérer les entreprises Africanut
    const companiesResult = await client.query(`
      SELECT id, name, slug, sector, tagline 
      FROM "Company" 
      ORDER BY "createdAt" DESC 
      LIMIT 10
    `);

    await client.end();
    log("📈 Données récupérées avec succès");

    return res.json({
      success: true,
      message: "API Africanut PostgreSQL",
      database: "PostgreSQL Neon",
      companies_count: companiesResult.rows.length,
      companies: companiesResult.rows,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    error("❌ Erreur:", err.message);
    
    return res.json({
      success: false,
      error: err.message,
      details: "Vérifiez la connexion à la base de données",
      timestamp: new Date().toISOString()
    }, 500);
  }
};
