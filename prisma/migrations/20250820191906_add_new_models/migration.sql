/*
  Warnings:

  - You are about to drop the column `createdAt` on the `AccountingEntry` table. All the data in the column will be lost.
  - You are about to drop the column `creditAccount` on the `AccountingEntry` table. All the data in the column will be lost.
  - You are about to drop the column `debitAccount` on the `AccountingEntry` table. All the data in the column will be lost.
  - You are about to drop the column `documentDate` on the `AccountingEntry` table. All the data in the column will be lost.
  - You are about to drop the column `documentNumber` on the `AccountingEntry` table. All the data in the column will be lost.
  - You are about to drop the column `documentType` on the `AccountingEntry` table. All the data in the column will be lost.
  - You are about to drop the column `journalCode` on the `AccountingEntry` table. All the data in the column will be lost.
  - You are about to drop the column `reference` on the `AccountingEntry` table. All the data in the column will be lost.
  - You are about to drop the column `imageUrl` on the `Article` table. All the data in the column will be lost.
  - You are about to drop the column `imageUrl` on the `LivreBlanc` table. All the data in the column will be lost.
  - You are about to drop the `Document` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Document" DROP CONSTRAINT "Document_accountingEntryId_fkey";

-- DropForeignKey
ALTER TABLE "Document" DROP CONSTRAINT "Document_companyId_fkey";

-- DropForeignKey
ALTER TABLE "Document" DROP CONSTRAINT "Document_uploadedById_fkey";

-- AlterTable
ALTER TABLE "AccountingEntry" DROP COLUMN "createdAt",
DROP COLUMN "creditAccount",
DROP COLUMN "debitAccount",
DROP COLUMN "documentDate",
DROP COLUMN "documentNumber",
DROP COLUMN "documentType",
DROP COLUMN "journalCode",
DROP COLUMN "reference";

-- AlterTable
ALTER TABLE "App" ALTER COLUMN "category" DROP NOT NULL,
ALTER COLUMN "category" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "Article" DROP COLUMN "imageUrl";

-- AlterTable
ALTER TABLE "LivreBlanc" DROP COLUMN "imageUrl",
ALTER COLUMN "category" DROP NOT NULL,
ALTER COLUMN "category" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "Media" ALTER COLUMN "category" DROP NOT NULL,
ALTER COLUMN "category" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "stock_quantity" INTEGER NOT NULL DEFAULT 0;

-- DropTable
DROP TABLE "Document";

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "movementDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "productId" TEXT NOT NULL,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
