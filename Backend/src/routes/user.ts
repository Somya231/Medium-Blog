import { signinInput, signupInput } from '@somyaparikh17/common-app';
import { zValidator } from "@hono/zod-validator";
import { PrismaClient } from "@prisma/client/edge";
import { withAccelerate } from "@prisma/extension-accelerate";
import { Hono } from "hono";
import { z } from "zod";
import { hashPassword, verifyPassword } from "../hashPassword";
import { sign } from "hono/jwt";

export const userRouter = new Hono<{
  //For using connection pool database
  Bindings: {
    DATABASE_URL: string;
    JWT_SECRET: string;
  };
}>();

userRouter.post(
  "/signup",
  // used for validation
  zValidator("json", signupInput, (result, c) => {
    if (!result.success) {
      return c.text("Invalid Inputs", 400);
    }
  }),
  async (c) => {
    const body = await c.req.json();
    // this is used to connect to connection pool for every routes
    const prisma = new PrismaClient({
      datasourceUrl: c.env.DATABASE_URL,
    }).$extends(withAccelerate());
    try {
      // Password hashing
      const hashedPassword = await hashPassword(body.password);
      const user = await prisma.user.create({
        data: {
          email: body.email,
          password: hashedPassword,
          name: body.name,
        },
      });

      //Jwt token
      const jwt = await sign({ id: user.id }, c.env.JWT_SECRET);

      return c.json({ jwt });
    } catch (err) {
      c.status(403);
      return c.json({ error: "error while signing up" });
    }
  }
);

userRouter.post(
  "/signin",
  zValidator("json", signinInput, (result, c) => {
    if (!result.success) {
      return c.text("Invalid Inputs", 400);
    }
  }),
  async (c) => {
    const body = await c.req.json();

    // this is used to connect to connection pool for every routes
    const prisma = new PrismaClient({
      datasourceUrl: c.env.DATABASE_URL,
    }).$extends(withAccelerate());

    try {
      const user = await prisma.user.findUnique({
        where: {
          email: body.email,
        },
      });

      if (!user) {
        c.status(403);
        return c.json({ error: "User not found" });
      }

      const jwt = await sign({ id: user.id }, c.env.JWT_SECRET);

      // verifying password
      if (await verifyPassword(user.password, body.password)) {
        c.status(200);
        return c.json({ jwt });
      }
    } catch (err) {
      c.status(403);
      return c.json({ error: "error while signing in" });
    }
  }
);
