/*
  Warnings:

  - A unique constraint covering the columns `[orderItemId]` on the table `stock_movements` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "stock_movements_orderItemId_key" ON "stock_movements"("orderItemId");
