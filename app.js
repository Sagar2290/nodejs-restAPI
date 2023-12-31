const path = require("path");

const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const { createHandler } = require("graphql-http/lib/use/express");

const graphqlSchema = require("./graphql/schema");
const graphqlResolver = require("./graphql/resolvers");
const { error } = require("console");

const auth = require("./middleware/is-auth");
const { clearImage } = require("./util/file");

const app = express();

const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "images");
  },
  filename: (req, file, cb) => {
    cb(null, uuidv4() + "-" + file.originalname);
  },
});

const fileFilter = (req, file, cb) => {
  if (
    file.mimetype === "image/png" ||
    file.mimetype === "image/jpg" ||
    file.mimetype === "image/jpeg"
  ) {
    cb(null, true);
  }
  cb(null, false);
};

// app.use(bodyParser.urlencoded()); // x-www-form-urlencoded <form>
app.use(bodyParser.json());
app.use(
  multer({ storage: fileStorage, fileFilter: fileFilter }).single("image")
);
app.use("/images", express.static(path.join(__dirname, "images")));

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

app.use(auth);

app.put("/post-image", (req, res, next) => {
  if (!req.isAuth) {
    throw new Error("not authenticated!");
  }
  if (!req.file) {
    return res.status(200).json({ message: "No file provided!" });
  }
  if (req.body.oldPath) {
    clearImage(req.body.oldPath);
  }
  return res.status(201).json({
    message: "File stored.",
    filePath: req.file.path.replace("\\", "/"),
  });
});

// app.use("/graphql", createHandler({ schema }));

app.all("/graphql", (req, res) =>
  createHandler({
    schema: graphqlSchema,
    rootValue: {
      createUser: (args) => graphqlResolver.createUser(args, req),
      login: (args) => graphqlResolver.login(args, req),
      createPost: (args) => graphqlResolver.createPost(args, req),
      posts: (args) => graphqlResolver.posts(args, req),
      post: (args) => graphqlResolver.post(args, req),
      updatePost: (args) => graphqlResolver.updatePost(args, req),
      deletePost: (args) => graphqlResolver.deletePost(args, req),
      user: (args) => graphqlResolver.user(args, req),
      updateStatus: (args) => graphqlResolver.updateStatus(args, req),
    },
    formatError(err) {
      if (!err.originalError) {
        return err;
      }
      const data = err.originalError.data;
      const message = err.message || "An error occurred.";
      const code = err.originalError.code || 500;
      return { message: message, status: code, data: data };
    },
  })(req, res)
);

app.use((error, req, res, next) => {
  console.log(error);
  const status = error.statusCode || 500;
  const message = error.message;
  const data = error.data;
  res.status(status).json({ message: message, data: data });
});

mongoose
  .connect(
    "mongodb+srv://sagar3715:B4ppkbZxy00OOf4i@cluster0.jjie4rf.mongodb.net/messages?retryWrites=true"
  )
  .then((result) => {
    app.listen(8080);
  })
  .catch((err) => console.log(err));
