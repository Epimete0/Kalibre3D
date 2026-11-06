import { prisma } from "./prisma";
import { redeemInvitationWithDb } from "./invitation-service-core";
export const redeemInvitation = (options: Omit<Parameters<typeof redeemInvitationWithDb>[0], "db"> & { db?: typeof prisma }) => redeemInvitationWithDb({ ...options, db: options.db ?? prisma });
