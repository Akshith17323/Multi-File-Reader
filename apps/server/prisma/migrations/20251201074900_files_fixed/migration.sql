/*
  Warnings:

  - You are about to drop the column `gcsName` on the `File` table. All the data in the column will be lost.
  - Added the required column `fileType` to the `File` table without a default value. This is not possible if the table is not empty.
  - Made the column `fileSize` on table `File` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "File_gcsName_key";

-- AlterTable
ALTER TABLE "File" DROP COLUMN "gcsName",
ADD COLUMN     "fileType" TEXT NOT NULL,
ALTER COLUMN "fileSize" SET NOT NULL;
