const { Client } = require('pg');

module.exports = async ({ req, res, log, error }) => {
  try {
    log("🔗 Connexion à PostgreSQL Neon pour Africanut...");

    const client = new Client({
      connectionString: process.env.PG_URI,
      ssl: { rejectUnauthorized: false }
    });

    await client.connect();
    log("✅ Connecté à PostgreSQL");

    // Selon la méthode HTTP, exécuter différentes actions
    const method = req.method || 'GET';
    
    switch (method) {
      case 'GET':
        const companies = await client.query('SELECT id, name, slug, sector FROM "Company" ORDER BY name LIMIT 10;');
        await client.end();
        
        return res.json({
          success: true,
          data: companies.rows,
          count: companies.rows.length
        });

      case 'POST':
        // Exemple pour créer une nouvelle entrée
        const { name, sector } = JSON.parse(req.body || '{}');
        
        if (!name || !sector) {
          await client.end();
          return res.json({ error: "Nom et secteur requis" }, 400);
        }
        
        const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
        const newCompany = await client.query(
          'INSERT INTO "Company" (id, slug, name, sector, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING *',
          [require('crypto').randomUUID(), slug, name, sector]
        );
        
        await client.end();
        return res.json({ success: true, company: newCompany.rows[0] });

      default:
        await client.end();
        return res.json({ error: "Méthode non supportée" }, 405);
    }

  } catch (err) {
    error("❌ Erreur:", err);
    return res.json({
      success: false,
      error: err.message
    }, 500);
  }
};
