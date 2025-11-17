import pkg from "pg";
const { Client } = pkg;

export default async ({ req, res, log }) => {
  try {
    log("🔗 Connexion à PostgreSQL Neon africanut-industry…");

    const client = new Client({
      connectionString: process.env.PG_URI,   // ta variable d'env
      ssl: { rejectUnauthorized: false }      // obligatoire pour Neon
    });

    await client.connect();
    log("✨ Connecté à la DB !");

    const result = await client.query("SELECT * FROM members;"); // adapte le nom de la table
    await client.end();

    return res.json({
      success: true,
      data: result.rows
    });

  } catch (err) {
    log("❌ Erreur :", err);
    return res.json({
      success: false,
      error: err.message
    });
  }
};
