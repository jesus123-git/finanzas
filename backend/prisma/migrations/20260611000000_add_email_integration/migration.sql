-- CreateTable
CREATE TABLE "email_integrations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailUser" TEXT NOT NULL,
    "emailPassword" TEXT NOT NULL,
    "emailHost" TEXT NOT NULL DEFAULT 'imap.gmail.com',
    "emailPort" INTEGER NOT NULL DEFAULT 993,
    "emailMailbox" TEXT NOT NULL DEFAULT 'INBOX',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_integrations_userId_key" ON "email_integrations"("userId");

-- AddForeignKey
ALTER TABLE "email_integrations" ADD CONSTRAINT "email_integrations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
