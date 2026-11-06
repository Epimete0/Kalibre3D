import { prisma } from "./prisma";
import { archiveCenterForOwnerWithDb } from "./center-archive-service-core";
export const archiveCenterForOwner = (options: Omit<Parameters<typeof archiveCenterForOwnerWithDb>[0], "db"> & { db?: typeof prisma }) => archiveCenterForOwnerWithDb({ ...options, db: options.db ?? prisma });
