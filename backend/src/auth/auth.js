// const express = require("express");
// const cors = require("cors");
// const app = express();
// const { PrismaClient } = require("@prisma/client");

// const prisma = new PrismaClient();
// app.use(
//   cors({
//     origin: ["http://localhost:1705", "http://localhost:5173"],
//     methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
//   })
// );
// app.use(express.json());

// app.get("/", async (req, res) => {

//   try {
//     const tasks = await prisma.tasks.findMany();

//     return res.status(200).json(tasks);

//   } catch (err) {

//     return res.status(404).json({ Message: "Resourse not found" });

//   }
// });

// app.post("/", async (req, res) => {
//   try {
//     const { task, importance, urgency } = req.body;

//     const existing_task = await prisma.tasks.findFirst({
//       where: {
//         task: task,
//       },
//     });

//     if (!existing_task) {
//       await prisma.tasks.create(
//         {
//           data: req.body
//         }
//       );
//       console.log("created the task");

//       return res.status(200).json({ Message: "Task created successfully" });

//     } else {

//       return res.status(409).json({ Message: "Task already exists" });

//     }
//   } catch (err) {
//     console.log(err);
//     return res.status(500).json({ Message: "Failed to add task" });
//   }
// });

// app.delete('/',async (req,res)=>{
//   try {
//     const {id} = req.id
//     const existing_to_delete = await prisma.tasks.delete({where:{id:id}})
//     if (existing_to_delete){
//       return res.status(409).json({Message:""})
//     }
//   }
//   catch{

//   }
// })


// module.exports = app;


const express = require('express');
const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Creating App
const app = express();

// Creating Prisma instance
const prisma = new PrismaClient();

// Middleware to parse JSON requests
app.use(express.json());

// Define routes
app.get('/', (req, res) => {
    res.status(200).send("Hello World!!");
});

app.post('/signup', async (req, res) => {
    const { username, email, password } = req.body

    if (!username || !email || !password) {
        return res.status(400).json({ "error": "All fields are required" })
    }
    else {
        let existing_username = await prisma.user.findUnique({ where: { username: username } })
        let existing_email = await prisma.user.findUnique({ where: { email: email } })

        if (existing_email || existing_username) {
            return res.status(400).json({ "error": "Username or email already exists" })
        }
        else {
            await prisma.user.create({data:req.body})
            return res.status(200).json({
    "message": "Signup successful!",
    "user": {username,email}})

        }
    }
});

app.post('/login', async (req, res) => {
    
});

// Set the port from environment variable or default to 3000
const port = process.env.PORT || 3000;

// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

// Export app and prisma instances
module.exports = { app, prisma };
