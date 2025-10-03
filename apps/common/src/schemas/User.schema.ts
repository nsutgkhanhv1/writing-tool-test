import { Static, Type as t } from "@sinclair/typebox";

export type User = {
  id?: string;
  name?: string;
  email?: string | null;
  avatar?: string | null;
  password?: string;
  phoneNumber?: string | null;
  dateOfBirth?: string | null;
  createdAt?: number;
};

export const UserInfoSchema = t.Object({
  id: t.Optional(t.String()),
  name: t.Optional(t.Union([t.String(), t.Null()])),
  email: t.Optional(t.Union([t.String(), t.Null()])),
  avatar: t.Optional(t.Union([t.String(), t.Null()])),
  phoneNumber: t.Optional(t.Union([t.String(), t.Null()])),
  dateOfBirth: t.Optional(t.Union([t.String(), t.Null()])),
  doneOnboarding: t.Optional(t.Boolean()),
  createdAt: t.Optional(t.Any()),
});

export type UserInfo = Static<typeof UserInfoSchema>;
