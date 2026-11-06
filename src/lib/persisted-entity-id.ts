import { z } from "zod";

const invalidIdMessage = "Identificador inválido.";
const persistedIdString = z.string().max(36, invalidIdMessage);

export const persistedEntityId = z.union([
  persistedIdString.cuid(invalidIdMessage),
  persistedIdString.uuid(invalidIdMessage),
], { error: invalidIdMessage });
