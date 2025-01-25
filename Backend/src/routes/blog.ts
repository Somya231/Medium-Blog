import { Hono } from "hono";
import { PrismaClient } from "@prisma/client/edge";
import { withAccelerate } from "@prisma/extension-accelerate";
import { verify } from "hono/jwt";
import { zValidator } from "@hono/zod-validator";
import { createPostInput, updatePostInput } from "@somyaparikh17/common-app";

export const blogRouter = new Hono<{
  Bindings: {
    DATABASE_URL: string;
    JWT_SECRET: string;
  };
  Variables: {
    userId: string;
  };
}>();


// auth middleware
blogRouter.use(async (c, next) => {
  try {
    const jwt = c.req.header("Authorization");
    if (!jwt) {
      c.status(401);
      return c.json({ error: "Unauthorized: No token provided" });
    }

    const token = jwt.split(" ")[1];
    if (!token) {
      c.status(401);
      return c.json({ error: "Unauthorized: Invalid token format" });
    }

    const payload = await verify(token, c.env.JWT_SECRET);
    if (!payload || !payload.id) {
      c.status(401);
      return c.json({ error: "Unauthorized: Invalid or expired token" });
    }

    c.set("userId", String(payload.id)); // Store user ID in context
    await next();
  } catch (err) {
    console.error("JWT verification error:", err);
    c.status(401);
    return c.json({ error: "Unauthorized: Token verification failed" });
  }
});


// to create blogs
blogRouter.post("/", zValidator("json", createPostInput, (result, c) => {
  if (!result.success) {
    return c.text("Invalid Inputs", 400);
  }
}) , async (c) => {
  const body = await c.req.json();
  const prisma = new PrismaClient({
    datasourceUrl: c.env.DATABASE_URL,
  }).$extends(withAccelerate());

  const userId = c.get("userId");
  try {
    const blog = await prisma.post.create({
      data: {
        title: body.title,
        content: body.content,
        authorId: userId,
      },
    });

    return c.json({ id: blog.id });
  } catch (err) {
    c.status(411);
    return c.json({ message: "Invalid" });
  }
});


// To update blogs
blogRouter.put("/", zValidator("json", updatePostInput, (result, c) => {
  if (!result.success) {
    return c.text("Invalid Inputs", 400);
  }
}) , async (c) => {
  const body = await c.req.json();
  const prisma = new PrismaClient({
    datasourceUrl: c.env.DATABASE_URL,
  }).$extends(withAccelerate());

  const userId = c.get("userId");
  try {
    const blog = await prisma.post.update({
      where: {
        id: body.id,
        authorId: userId,
      },
      data: {
        title: body.title,
        content: body.content,
      },
    });
    return c.json({ message: "updated blog" });
  } catch (err) {
    c.status(411);
    return c.json({ message: "Invalid" });
  }
});

// To get all blogs
blogRouter.get("/bulk", async (c) => {
  const prisma = new PrismaClient({
    datasourceUrl: c.env.DATABASE_URL,
  }).$extends(withAccelerate());

  try {
    const blogs = await prisma.post.findMany({});

    return c.json(blogs);
  } catch (err) {
    return c.json({ message: "Invalid" });
  }
});

// To get blog by id
blogRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  const prisma = new PrismaClient({
    datasourceUrl: c.env.DATABASE_URL,
  }).$extends(withAccelerate());

  try {
    const blog = await prisma.post.findUnique({
      where: {
        id: id,
      },
    });
    return c.json(blog);
  } catch (err) {
    c.status(411);
    return c.json({ message: "Invalid" });
  }
});
