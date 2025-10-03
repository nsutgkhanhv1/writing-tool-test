import { impl } from "../impl";
import { createNewUser } from "../services/user.service";

impl.fetch("authentication:anonymousLogin", async (ctx) => {
  // const newUser = await createNewUser(ctx.db, {});

  const token = await ctx.signJWT({ userId: "newUser?.id!" });

  return token;
});
