/*
  Warnings:

  - You are about to drop the `stock_movements` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "stock_movements" DROP CONSTRAINT "stock_movements_productId_fkey";

-- DropTable
DROP TABLE "stock_movements";
