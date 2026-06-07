-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "categoryLabel" TEXT,
ALTER COLUMN "accountId" DROP NOT NULL;
