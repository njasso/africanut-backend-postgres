import pkg from "pg";
const { Client } = pkg;

export default async ({ req, res, log }) => {
  try {
    log("🔗 Connexion à PostgreSQL Neon africanut-industry…");

    const client = new Client({
      connectionString: process.env.PG_URI,
      ssl: { rejectUnauthorized: false }
    });

    await client.connect();
    log("✨ Connecté à la DB !");

    // Test avec une table qui existe réellement dans votre schéma
    const result = await client.query("SELECT * FROM \"Company\" LIMIT 5;");
    await client.end();

    return res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });

  } catch (err) {
    log("❌ Erreur :", err);
    return res.json({
      success: false,
      error: err.message
    });
  }
};
