import { Router } from 'express';
import pkg from '@prisma/client';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { Parser as CsvParser } from 'json2csv';
import { requireAuth } from '../middleware/auth.js';

const { PrismaClient, EntryType } = pkg;
const prisma = new PrismaClient();
const router = Router();

/**
 * Helper : récupérer les écritures comptables avec filtres optionnels.
 * @param {object} filters - Un objet contenant les filtres de la requête.
 * @returns {Promise<Array>} - Un tableau des écritures comptables.
 */
async function getAccountingEntries({ companySlug, startDate, endDate, accountClass }) {
    console.log('Filtres de la requête:', { companySlug, startDate, endDate, accountClass });

    const where = {};

    if (companySlug && companySlug.trim() !== '') {
        const company = await prisma.company.findUnique({ where: { slug: companySlug } });
        if (!company) {
            throw new Error('Entreprise invalide');
        }
        where.companyId = company.id;
    }

    if (startDate || endDate) {
        where.date = {};
        if (startDate) where.date.gte = new Date(startDate);
        if (endDate) where.date.lte = new Date(endDate);
    }

    if (accountClass) {
        where.OR = [
            { debitAccount: { startsWith: accountClass } },
            { creditAccount: { startsWith: accountClass } }
        ];
    }

    try {
        const entries = await prisma.accountingEntry.findMany({
            where,
            include: {
                company: { select: { id: true, name: true, slug: true } },
                createdBy: { select: { id: true, name: true, email: true } },
                documents: true
            },
            orderBy: { date: 'asc' } // Tri par date pour une meilleure lisibilité des rapports
        });

        console.log(`Nombre d'écritures trouvées: ${entries.length}`);
        return entries;

    } catch (error) {
        console.error('Erreur Prisma lors de la récupération des écritures:', error);
        throw error; // Renvoyer l'erreur pour qu'elle soit gérée par la route
    }
}

/**
 * Helper : formater les données pour l'export.
 * @param {object} entry - Une écriture comptable.
 * @returns {object} - L'écriture formatée pour l'export.
 */
function formatEntryForExport(entry) {
    return {
        Date: entry.date ? new Date(entry.date).toLocaleDateString('fr-FR') : 'N/A',
        'Compte Débit': entry.debitAccount || 'N/A',
        'Compte Crédit': entry.creditAccount || 'N/A',
        'Type d\'écriture': entry.type === 'PRODUCT' ? 'Produit' : 'Charge',
        Libellé: entry.label || 'N/A',
        Montant: entry.amount ? parseFloat(entry.amount) : 0,
        Devise: 'XAF',
        Journal: entry.journalCode || 'OD',
        Référence: entry.reference || 'N/A',
        'Type Justificatif': entry.documentType || 'N/A',
        'Numéro Justificatif': entry.documentNumber || 'N/A',
        'Date Justificatif': entry.documentDate ? new Date(entry.documentDate).toLocaleDateString('fr-FR') : 'N/A',
        'Document ID': entry.documents && entry.documents.length > 0 ? entry.documents[0].id : 'N/A',
        'Entreprise': entry.company ? entry.company.name : 'N/A'
    };
}

// 📌 ROUTE POUR RÉCUPÉRER LES DONNÉES DU DASHBOARD
// Le chemin a été changé de '/accounting' à '/'
router.get('/', requireAuth, async (req, res) => {
    try {
        const { companySlug, startDate, endDate, accountClass } = req.query;
        const entries = await getAccountingEntries({ companySlug, startDate, endDate, accountClass });
        res.json(entries);
    } catch (err) {
        console.error('Erreur récupération données comptables:', err);
        res.status(500).json({ error: 'Erreur lors de la récupération des données comptables' });
    }
});

// 📌 Export Excel avec mise en forme OHADA
// Le chemin a été changé de '/accounting.xlsx' à '/excel'
router.get('/excel', requireAuth, async (req, res) => {
    try {
        const { companySlug, startDate, endDate, accountClass } = req.query;
        const entries = await getAccountingEntries({ companySlug, startDate, endDate, accountClass });

        if (entries.length === 0) {
            console.log('Aucune écriture trouvée pour l\'export Excel.');
            return res.status(204).end(); // No Content, pour éviter de créer un fichier vide.
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Écritures Comptables');

        // En-têtes avec style
        worksheet.columns = [
            { header: 'Date', key: 'Date', width: 15 },
            { header: 'Journal', key: 'Journal', width: 10 },
            { header: 'Référence', key: 'Référence', width: 15 },
            { header: 'Compte Débit', key: 'CompteDébit', width: 15 },
            { header: 'Compte Crédit', key: 'CompteCrédit', width: 15 },
            { header: 'Libellé', key: 'Libellé', width: 30 },
            { header: 'Montant (XAF)', key: 'Montant', width: 15 },
            { header: 'Type Justificatif', key: 'TypeJustificatif', width: 15 },
            { header: 'Numéro Justificatif', key: 'NuméroJustificatif', width: 20 },
            { header: 'Entreprise', key: 'Entreprise', width: 20 }
        ];

        // Style des en-têtes
        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } };
        worksheet.getRow(1).alignment = { horizontal: 'center' };

        // Données
        entries.forEach(entry => {
            worksheet.addRow({
                Date: entry.date ? new Date(entry.date).toLocaleDateString('fr-FR') : 'N/A',
                Journal: entry.journalCode || 'OD',
                Référence: entry.reference || 'N/A',
                CompteDébit: entry.debitAccount || 'N/A',
                CompteCrédit: entry.creditAccount || 'N/A',
                Libellé: entry.label || 'N/A',
                Montant: entry.amount ? parseFloat(entry.amount) : 0,
                TypeJustificatif: entry.documentType || 'N/A',
                NuméroJustificatif: entry.documentNumber || 'N/A',
                Entreprise: entry.company ? entry.company.name : 'N/A'
            });
        });

        // Format monétaire pour la colonne Montant
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber > 1) { // Skip header row
                const amountCell = row.getCell('Montant');
                amountCell.numFmt = '#,##0.00 "XAF"';
            }
        });

        // Totaux
        const totalRow = worksheet.addRow({});
        worksheet.mergeCells(`A${worksheet.rowCount}:F${worksheet.rowCount}`);
        worksheet.getCell(`A${worksheet.rowCount}`).value = 'TOTAL';
        worksheet.getCell(`A${worksheet.rowCount}`).font = { bold: true };
        worksheet.getCell(`A${worksheet.rowCount}`).alignment = { horizontal: 'right' };

        worksheet.getCell(`G${worksheet.rowCount}`).value = { formula: `SUM(G2:G${worksheet.rowCount - 1})` };
        worksheet.getCell(`G${worksheet.rowCount}`).numFmt = '#,##0.00 "XAF"';
        worksheet.getCell(`G${worksheet.rowCount}`).font = { bold: true };

        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader('Content-Disposition', `attachment; filename="journal-comptable-${new Date().toISOString().split('T')[0]}.xlsx"`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('Erreur export Excel:', err);
        res.status(500).json({ error: 'Erreur lors de l\'export Excel' });
    }
});

// 📌 Export CSV amélioré
// Le chemin a été changé de '/accounting.csv' à '/csv'
router.get('/csv', requireAuth, async (req, res) => {
    try {
        const { companySlug, startDate, endDate, accountClass } = req.query;
        const entries = await getAccountingEntries({ companySlug, startDate, endDate, accountClass });

        if (entries.length === 0) {
            console.log('Aucune écriture trouvée pour l\'export CSV.');
            return res.status(204).end(); // No Content
        }

        const formattedData = entries.map(entry => formatEntryForExport(entry));
        const fields = [
            'Date', 'Type d\'écriture', 'Compte Débit', 'Compte Crédit', 'Libellé', 'Montant', 'Devise',
            'Journal', 'Référence', 'Type Justificatif', 'Numéro Justificatif',
            'Date Justificatif', 'Document ID', 'Entreprise'
        ];

        const csvParser = new CsvParser({ fields, delimiter: ';' });
        const csv = csvParser.parse(formattedData);

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="journal-comptable-${new Date().toISOString().split('T')[0]}.csv"`);
        res.send('\uFEFF' + csv); // BOM pour Excel
    } catch (err) {
        console.error('Erreur export CSV:', err);
        res.status(500).json({ error: 'Erreur lors de l\'export CSV' });
    }
});

// 📌 Export PDF professionnel pour les transactions
// Le chemin a été changé de '/accounting.pdf' à '/pdf'
router.get('/pdf', requireAuth, async (req, res) => {
    try {
        const { companySlug, startDate, endDate, accountClass } = req.query;
        const entries = await getAccountingEntries({ companySlug, startDate, endDate, accountClass });

        if (entries.length === 0) {
            console.log('Aucune écriture trouvée pour l\'export PDF Transactions.');
            return res.status(204).end();
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="journal-comptable-${new Date().toISOString().split('T')[0]}.pdf"`);

        const doc = new PDFDocument({ margin: 50, size: 'A4', layout: 'landscape' });
        doc.pipe(res);

        // En-tête
        doc.fontSize(20).font('Helvetica-Bold')
            .text('JOURNAL COMPTABLE OHADA', { align: 'center' });

        // Période
        const periodText = startDate && endDate
            ? `Période: Du ${new Date(startDate).toLocaleDateString('fr-FR')} au ${new Date(endDate).toLocaleDateString('fr-FR')}`
            : 'Période: Toutes dates';

        doc.fontSize(12).font('Helvetica')
            .text(periodText, { align: 'center' });

        // Entête du tableau
        let y = 120;
        const columnWidths = [45, 30, 50, 50, 50, 110, 60, 50, 45, 30];
        const headers = ['Date', 'Journal', 'Réf.', 'Compte Débit', 'Compte Crédit', 'Libellé', 'Montant', 'Justificatif', 'ID Doc.', 'Type'];

        doc.font('Helvetica-Bold').fontSize(8);
        let x = 50;
        headers.forEach((header, i) => {
            doc.text(header, x, y, { width: columnWidths[i] });
            x += columnWidths[i];
        });

        // Ligne de séparation
        doc.moveTo(50, y + 15).lineTo(50 + columnWidths.reduce((a, b) => a + b, 0), y + 15).stroke();

        // Données
        y += 20;
        doc.font('Helvetica').fontSize(8);

        entries.forEach((entry, index) => {
            if (y > 540) { // Nouvelle page pour l'orientation paysage A4
                doc.addPage();
                y = 50;
                doc.font('Helvetica-Bold').fontSize(8);
                x = 50;
                headers.forEach((header, i) => {
                    doc.text(header, x, y, { width: columnWidths[i] });
                    x += columnWidths[i];
                });
                doc.moveTo(50, y + 15).lineTo(50 + columnWidths.reduce((a, b) => a + b, 0), y + 15).stroke();
                y += 20;
                doc.font('Helvetica').fontSize(8);
            }

            const docInfo = entry.documents && entry.documents.length > 0
                ? entry.documents[0].type
                : '-';

            const rowData = [
                entry.date ? new Date(entry.date).toLocaleDateString('fr-FR') : 'N/A',
                entry.journalCode || 'OD',
                entry.reference || '-',
                entry.debitAccount || '-',
                entry.creditAccount || '-',
                entry.label || 'N/A',
                entry.amount ? `${entry.amount.toLocaleString('fr-FR')} XAF` : '0 XAF',
                entry.documentNumber || '-',
                docInfo,
                entry.type === 'PRODUCT' ? 'P' : 'C'
            ];

            x = 50;
            rowData.forEach((text, i) => {
                doc.text(text, x, y, { width: columnWidths[i] });
                x += columnWidths[i];
            });

            y += 15;
        });

        // Pied de page avec totaux
        const total = entries.reduce((sum, entry) => sum + (entry.amount || 0), 0);
        doc.font('Helvetica-Bold').fontSize(10);
        doc.text(`TOTAL: ${total.toLocaleString('fr-FR')} XAF`, 50, y + 20, { align: 'right' });

        doc.end();
    } catch (err) {
        console.error('Erreur export PDF:', err);
        res.status(500).json({ error: 'Erreur lors de l\'export du journal comptable' });
    }
});

// 📌 Export Compte de Résultat détaillé
router.get('/pnl.pdf', requireAuth, async (req, res) => {
    try {
        const { companySlug, startDate, endDate, accountClass } = req.query;
        const entries = await getAccountingEntries({ companySlug, startDate, endDate, accountClass });

        if (entries.length === 0) {
            console.log('Aucune écriture trouvée pour l\'export PDF P&L.');
            return res.status(204).end();
        }

        // Calculs détaillés par classe de comptes
        const produits = entries.filter(e => e.type === 'PRODUCT');
        const charges = entries.filter(e => e.type === 'EXPENSE');

        const totalProduits = produits.reduce((sum, e) => sum + (e.amount || 0), 0);
        const totalCharges = charges.reduce((sum, e) => sum + (e.amount || 0), 0);
        const benefice = totalProduits - totalCharges;
        const tauxMarge = totalProduits > 0 ? (benefice / totalProduits * 100) : 0;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="compte-resultat-${new Date().toISOString().split('T')[0]}.pdf"`);

        const doc = new PDFDocument({ margin: 50 });
        doc.pipe(res);

        // En-tête
        doc.fontSize(20).font('Helvetica-Bold')
            .text('COMPTE DE RÉSULTAT - SYSCOHADA', { align: 'center' });

        // Période
        const periodText = startDate && endDate
            ? `Période: Du ${new Date(startDate).toLocaleDateString('fr-FR')} au ${new Date(endDate).toLocaleDateString('fr-FR')}`
            : 'Période: Toutes dates';

        doc.fontSize(12).font('Helvetica')
            .text(periodText, { align: 'center' });

        // Section Produits
        doc.fontSize(16).font('Helvetica-Bold')
            .text('PRODUITS (Classe 7)', 50, 120);

        let y = 150;
        doc.fontSize(10).font('Helvetica');

        produits.forEach(produit => {
            doc.text(`${produit.label || 'N/A'}`, 70, y);
            doc.text(`${(produit.amount || 0).toLocaleString('fr-FR')} XAF`, 400, y, { align: 'right' });
            y += 20;
        });

        // Total Produits
        doc.font('Helvetica-Bold')
            .text('Total Produits', 70, y + 10)
            .text(`${totalProduits.toLocaleString('fr-FR')} XAF`, 400, y + 10, { align: 'right' });

        // Section Charges
        y += 40;
        doc.fontSize(16).font('Helvetica-Bold')
            .text('CHARGES (Classe 6)', 50, y);

        y += 30;
        doc.fontSize(10).font('Helvetica');

        charges.forEach(charge => {
            doc.text(`${charge.label || 'N/A'}`, 70, y);
            doc.text(`${(charge.amount || 0).toLocaleString('fr-FR')} XAF`, 400, y, { align: 'right' });
            y += 20;
        });

        // Total Charges
        doc.font('Helvetica-Bold')
            .text('Total Charges', 70, y + 10)
            .text(`${totalCharges.toLocaleString('fr-FR')} XAF`, 400, y + 10, { align: 'right' });

        // Résultat
        y += 40;
        doc.fontSize(14).font('Helvetica-Bold')
            .text('RÉSULTAT NET', 50, y)
            .text(`${benefice.toLocaleString('fr-FR')} XAF`, 400, y, { align: 'right' });

        doc.fontSize(12).font('Helvetica')
            .text(`Taux de marge: ${tauxMarge.toFixed(2)}%`, 50, y + 25);

        doc.end();
    } catch (err) {
        console.error('Erreur export PNL PDF:', err);
        res.status(500).json({ error: 'Erreur lors de l\'export du compte de résultat' });
    }
});

// 📌 Export Bilan détaillé OHADA
router.get('/balance-sheet.pdf', requireAuth, async (req, res) => {
    try {
        const { companySlug, startDate, endDate } = req.query;
        const entries = await getAccountingEntries({ companySlug, startDate, endDate });

        if (entries.length === 0) {
            console.log('Aucune écriture trouvée pour l\'export Bilan.');
            return res.status(204).end();
        }

        const accountBalances = {};

        entries.forEach(entry => {
            const debitAccountClass = entry.debitAccount ? entry.debitAccount.toString().charAt(0) : null;
            const creditAccountClass = entry.creditAccount ? entry.creditAccount.toString().charAt(0) : null;

            if (debitAccountClass) {
                accountBalances[debitAccountClass] = (accountBalances[debitAccountClass] || 0) + parseFloat(entry.amount);
            }
            if (creditAccountClass) {
                accountBalances[creditAccountClass] = (accountBalances[creditAccountClass] || 0) - parseFloat(entry.amount);
            }
        });

        const totalActif = (accountBalances['2'] || 0) + (accountBalances['3'] || 0) + (accountBalances['5'] || 0) + (accountBalances['4'] > 0 ? accountBalances['4'] : 0);
        const totalPassif = (accountBalances['1'] || 0) + (accountBalances['4'] < 0 ? Math.abs(accountBalances['4']) : 0);
        const resultatNet = (accountBalances['7'] || 0) - (accountBalances['6'] || 0);

        const totalPassifFinal = totalPassif + resultatNet;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="bilan-ohada-${new Date().toISOString().split('T')[0]}.pdf"`);

        const doc = new PDFDocument({ margin: 50 });
        doc.pipe(res);

        // En-tête
        doc.fontSize(20).font('Helvetica-Bold')
            .text('BILAN OHADA', { align: 'center' });

        // Période
        const periodTextBilan = startDate && endDate
            ? `Période: Du ${new Date(startDate).toLocaleDateString('fr-FR')} au ${new Date(endDate).toLocaleDateString('fr-FR')}`
            : 'Période: Toutes dates';

        doc.fontSize(12).font('Helvetica')
            .text(periodTextBilan, { align: 'center' });

        // Structure du bilan sur deux colonnes
        const colonneGauche = 50;
        const colonneDroite = 300;
        let y = 120;

        // ACTIF
        doc.fontSize(16).font('Helvetica-Bold')
            .text('ACTIF', colonneGauche, y);

        y += 30;
        doc.fontSize(12);
        doc.text('Classe 2: Actif immobilisé', colonneGauche + 20, y)
            .text(`${(accountBalances['2'] || 0).toLocaleString('fr-FR')} XAF`, colonneGauche + 200, y, { align: 'right' });

        y += 20;
        doc.text('Classe 3: Stocks', colonneGauche + 20, y)
            .text(`${(accountBalances['3'] || 0).toLocaleString('fr-FR')} XAF`, colonneGauche + 200, y, { align: 'right' });

        y += 20;
        doc.text('Classe 5: Disponibilités', colonneGauche + 20, y)
            .text(`${(accountBalances['5'] || 0).toLocaleString('fr-FR')} XAF`, colonneGauche + 200, y, { align: 'right' });
        
        y += 20;
        // La classe 4 peut avoir des soldes débiteurs (créances) et créditeurs (dettes). Seuls les soldes débiteurs sont des actifs.
        doc.text('Classe 4: Comptes de tiers (Actif)', colonneGauche + 20, y)
            .text(`${(accountBalances['4'] > 0 ? accountBalances['4'] : 0).toLocaleString('fr-FR')} XAF`, colonneGauche + 200, y, { align: 'right' });


        y += 30;
        doc.font('Helvetica-Bold')
            .text('TOTAL ACTIF', colonneGauche, y)
            .text(`${totalActif.toLocaleString('fr-FR')} XAF`, colonneGauche + 200, y, { align: 'right' });

        // PASSIF
        y = 120;
        doc.fontSize(16).font('Helvetica-Bold')
            .text('PASSIF', colonneDroite, y);

        y += 30;
        doc.fontSize(12);
        doc.text('Classe 1: Capitaux permanents', colonneDroite + 20, y)
            .text(`${(accountBalances['1'] || 0).toLocaleString('fr-FR')} XAF`, colonneDroite + 200, y, { align: 'right' });

        y += 20;
        // Seuls les soldes créditeurs de la classe 4 sont des passifs (dettes).
        doc.text('Classe 4: Dettes', colonneDroite + 20, y)
            .text(`${(accountBalances['4'] < 0 ? Math.abs(accountBalances['4']) : 0).toLocaleString('fr-FR')} XAF`, colonneDroite + 200, y, { align: 'right' });

        // Ajout du résultat de l'exercice au passif
        y += 20;
        doc.text('Résultat de l\'exercice', colonneDroite + 20, y)
            .text(`${resultatNet.toLocaleString('fr-FR')} XAF`, colonneDroite + 200, y, { align: 'right' });

        y += 30;
        doc.font('Helvetica-Bold')
            .text('TOTAL PASSIF', colonneDroite, y)
            .text(`${totalPassifFinal.toLocaleString('fr-FR')} XAF`, colonneDroite + 200, y, { align: 'right' });

        // Équilibre
        y += 50;
        if (Math.abs(totalActif - totalPassifFinal) < 0.01) { // Tolérance pour les erreurs de virgule flottante
            doc.fontSize(14).fillColor('green')
                .text('✓ BILAN ÉQUILIBRÉ', 50, y, { align: 'center' });
        } else {
            doc.fontSize(14).fillColor('red')
                .text('✗ BILAN DÉSÉQUILIBRÉ', 50, y, { align: 'center' })
                .fillColor('black').fontSize(12)
                .text(`Différence: ${Math.abs(totalActif - totalPassifFinal).toLocaleString('fr-FR')} XAF`, 50, y + 25, { align: 'center' });
        }

        doc.end();
    } catch (err) {
        console.error('Erreur export Bilan PDF:', err);
        res.status(500).json({ error: 'Erreur lors de l\'export du bilan' });
    }
});


/**
 * Rapport des mouvements de stock (inchangé)
 */
// Le chemin a été changé de '/stock' à '/stock' - il n'y a pas de doublon, il n'y a donc pas de changement
router.get('/stock', async (req, res) => {
    const { startDate, endDate } = req.query;

    try {
        const movements = await prisma.stockMovement.findMany({
            where: {
                movementDate: {
                    gte: startDate ? new Date(startDate) : undefined,
                    lte: endDate ? new Date(endDate) : undefined,
                },
            },
            include: { product: true },
            orderBy: { movementDate: 'asc' },
        });

        res.json(movements);
    } catch (error) {
        console.error('Erreur lors de la récupération du rapport de stock:', error);
        res.status(500).json({ error: 'Échec de la récupération du rapport de stock.' });
    }
});


// 📌 NOUVELLE ROUTE POUR L'ANALYSE IA
// Le chemin a été changé de '/deepseek-analyze' à '/ai-analysis'
router.post('/ai-analysis', requireAuth, async (req, res) => {
    try {
        const { entries, analysisPrompt } = req.body;
        if (!entries || !Array.isArray(entries) || !analysisPrompt) {
            return res.status(400).json({ error: 'Données d\'entrées (écritures comptables) ou prompt manquants.' });
        }

        // Formatage des écritures pour le modèle d'IA
        const formattedEntries = entries.map(entry => {
            return `Date: ${new Date(entry.date).toLocaleDateString('fr-FR')}, Libellé: ${entry.label}, Montant: ${entry.amount} XAF, Compte Débit: ${entry.debitAccount}, Compte Crédit: ${entry.creditAccount}`;
        }).join('\n');

        const fullPrompt = `En tant qu'analyste financier expert, base-toi sur les écritures comptables suivantes pour répondre à la question de l'utilisateur. Utilise des données précises de la comptabilité pour étayer ton analyse. Si l'information demandée n'est pas dans les écritures, dis-le clairement.
        
Écritures comptables:
${formattedEntries}

Question de l'utilisateur:
${analysisPrompt}

Réponse détaillée:`;

        const payload = {
            contents: [{
                parts: [{ text: fullPrompt }]
            }],
        };

        const apiKey = "";
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

        // Appel à l'API Gemini
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(JSON.stringify(errorData));
        }

        const result = await response.json();
        const analysis = result?.candidates?.[0]?.content?.parts?.[0]?.text || 'Impossible de générer le rapport. Veuillez réessayer.';

        res.json({ analysis });

    } catch (err) {
        console.error('Erreur lors de l\'appel à l\'API AI:', err);
        res.status(500).json({ error: 'Erreur lors de la génération du rapport AI.' });
    }
});

// Les autres routes (POST, PUT, DELETE) restent inchangées
// 📌 POST : création d'une écriture
router.post('/', requireAuth, async (req, res) => {
    try {
        const {
            label,
            type,
            amount,
            companySlug,
            journalCode,
            reference,
            debitAccount,
            creditAccount,
            documentType,
            documentNumber,
            documentDate,
            documentId
        } = req.body;

        if (!companySlug) {
            return res.status(400).json({ error: 'Entreprise invalide' });
        }
        if (!Object.values(EntryType).includes(type)) {
            return res.status(400).json({ error: 'Type invalide (PRODUCT ou EXPENSE requis)' });
        }

        const company = await prisma.company.findUnique({ where: { slug: companySlug } });
        if (!company) return res.status(400).json({ error: 'Entreprise invalide' });

        const entry = await prisma.accountingEntry.create({
            data: {
                label,
                type,
                amount: Number(amount),
                companyId: company.id,
                createdById: req.user.id,
                journalCode,
                reference,
                debitAccount,
                creditAccount,
                documentType,
                documentNumber,
                documentDate: documentDate ? new Date(documentDate) : null,
                documents: documentId ? { connect: { id: documentId } } : undefined,
            },
            include: { company: true, createdBy: true, documents: true }
        });

        res.status(201).json(entry);
    } catch (err) {
        console.error('Erreur POST /api/accounting', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// 📌 PUT : mise à jour d'une écriture
router.put('/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const {
            label,
            type,
            amount,
            companySlug,
            journalCode,
            reference,
            debitAccount,
            creditAccount,
            documentType,
            documentNumber,
            documentDate,
            documentId
        } = req.body;

        if (!companySlug) {
            return res.status(400).json({ error: 'Entreprise invalide' });
        }
        if (!Object.values(EntryType).includes(type)) {
            return res.status(400).json({ error: 'Type invalide (PRODUCT ou EXPENSE requis)' });
        }

        const entry = await prisma.accountingEntry.findUnique({ where: { id } });
        if (!entry) return res.status(404).json({ error: 'Élément non trouvé' });

        const company = await prisma.company.findUnique({ where: { slug: companySlug } });
        if (!company) return res.status(400).json({ error: 'Entreprise invalide' });

        let updateData = {
            label,
            type,
            amount: Number(amount),
            companyId: company.id,
            journalCode,
            reference,
            debitAccount,
            creditAccount,
            documentType,
            documentNumber,
            documentDate: documentDate ? new Date(documentDate) : null,
        };

        if (documentId) {
            updateData.documents = { connect: { id: documentId } };
        } else {
            updateData.documents = { set: [] };
        }

        const updatedEntry = await prisma.accountingEntry.update({
            where: { id },
            data: updateData,
            include: { company: true, createdBy: true, documents: true }
        });

        res.json(updatedEntry);
    } catch (err) {
        console.error('Erreur PUT /api/accounting/:id', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// 📌 DELETE : suppression d'une écriture
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.accountingEntry.delete({ where: { id } });
        res.json({ success: true });
    } catch (err) {
        console.error('Erreur DELETE /api/accounting/:id', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

export default router;
