-- AlterTable
ALTER TABLE "AccountingEntry" ADD COLUMN     "creditAccount" TEXT,
ADD COLUMN     "debitAccount" TEXT,
ADD COLUMN     "documentDate" TIMESTAMP(3),
ADD COLUMN     "documentNumber" TEXT,
ADD COLUMN     "documentType" TEXT,
ADD COLUMN     "journalCode" TEXT,
ADD COLUMN     "reference" TEXT;
