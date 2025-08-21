/*
  Warnings:

  - The `category` column on the `App` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `category` column on the `LivreBlanc` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `category` column on the `Media` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `stock_quantity` on the `products` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "AccountingEntry" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "creditAccount" TEXT,
ADD COLUMN     "debitAccount" TEXT,
ADD COLUMN     "documentDate" TIMESTAMP(3),
ADD COLUMN     "documentNumber" TEXT,
ADD COLUMN     "documentType" TEXT,
ADD COLUMN     "journalCode" TEXT,
ADD COLUMN     "reference" TEXT;

-- AlterTable
ALTER TABLE "App" DROP COLUMN "category",
ADD COLUMN     "category" TEXT[];

-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "imageUrl" TEXT;

-- AlterTable
ALTER TABLE "LivreBlanc" ADD COLUMN     "imageUrl" TEXT,
DROP COLUMN "category",
ADD COLUMN     "category" TEXT[];

-- AlterTable
ALTER TABLE "Media" DROP COLUMN "category",
ADD COLUMN     "category" TEXT[];

-- AlterTable
ALTER TABLE "products" DROP COLUMN "stock_quantity";

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "documentType" TEXT,
    "documentNumber" TEXT,
    "documentDate" TIMESTAMP(3),
    "companyId" TEXT NOT NULL,
    "uploadedById" TEXT,
    "accountingEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_accountingEntryId_fkey" FOREIGN KEY ("accountingEntryId") REFERENCES "AccountingEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
