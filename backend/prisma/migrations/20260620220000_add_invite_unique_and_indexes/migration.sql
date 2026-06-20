-- Add createdAt to business_invites
ALTER TABLE "business_invites" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Add unique constraint on (businessId, email) in business_invites
ALTER TABLE "business_invites" ADD CONSTRAINT "business_invites_businessId_email_key" UNIQUE ("businessId", "email");

-- Add index on businessId in business_invites
CREATE INDEX "business_invites_businessId_idx" ON "business_invites"("businessId");

-- Add index on userId in business_members
CREATE INDEX "business_members_userId_idx" ON "business_members"("userId");
