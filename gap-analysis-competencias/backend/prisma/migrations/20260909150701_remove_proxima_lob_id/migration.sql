/*
  Warnings:

  - You are about to drop the column `proxima_lob_id` on the `colaboradores` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "colaboradores" DROP CONSTRAINT "colaboradores_proxima_lob_id_fkey";

-- AlterTable
ALTER TABLE "colaboradores" DROP COLUMN "proxima_lob_id";
