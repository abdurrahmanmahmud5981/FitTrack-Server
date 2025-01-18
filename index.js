require('dotenv').config()
const express = require('express')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
const jwt = require('jsonwebtoken')


const morgan = require('morgan')

const port = process.env.PORT || 5000
const app = express()


// middleware
const corsOptions = {
    origin: ['http://localhost:5173', 'http://localhost:5174'],
    credentials: true,
    optionSuccessStatus: 200,
}
app.use(cors(corsOptions))

app.use(express.json())
app.use(cookieParser())
app.use(morgan('dev'))


// verify token 
const verifyToken = (req, res, next) => {
    // console.log(req.headers);
    if (!req.headers.authorization) {
        return res.status(401).send({ message: 'forbidden! No token provided.' });
    }
    const token = req.headers.authorization.split(' ')[1];
    jwt.verify(token, process.env.TOKEN_SECRET, (error, decoded) => {
        if (error) return res.status(403).send({ message: 'Token is not valid.' });
        req.decoded = decoded;
        next();
    })

}

// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.fxybk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;


const uri = `mongodb://localhost:27017`


const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
})

async function run() {
    try {
        const db = client.db('fit-track-DB');
        const usersCollection = db.collection('users');
        const subscribersCollection = db.collection('subscribers');
        const trainersCollection = db.collection('trainers');
        const classesCollection = db.collection('classes');
        const forumPostsCollection = db.collection('forum-posts');//


        // jwt releted api 
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            console.log(user);
            const token = jwt.sign(user, process.env.TOKEN_SECRET, { expiresIn: '9h' })
            res.send({ token });
        })

        // subscribers releted api 
        // get all subscribers only for admin
        app.get('/subscribers', async (req, res) => {
            const result = await subscribersCollection.find().toArray()
            res.send(result)
        })
        // save  a subscriber in db 
        app.post('/subscribers', async (req, res) => {
            const subscriber = req.body
            const email = subscriber.email;
            // check if user exists in db
            const isExist = await subscribersCollection.findOne({ email: email })
            if (isExist) {
                return res.send({ message: 'You have already subscribed to this newsletter.' })
            }
            const result = await subscribersCollection.insertOne(subscriber)
            res.send(result)
        })


        // user releted api
        // get a user by email
        app.get('/users/:email', async (req, res) => {
            const email = req.params.email
            const user = await usersCollection.findOne({ email: email })
            if (!user) {
                return res.status(404).send({ message: 'User not found.' })
            }
            res.send(user)
        })
        // save  a user in db 
        app.post('/users/:email', async (req, res) => {
            const email = req.params.email
            const user = req.body
            // check if user exists in db
            const isExist = await usersCollection.findOne({ email: email })
            if (isExist) {
                return res.send(isExist)
            }
            const result = await usersCollection.insertOne({ ...user, role: 'member' })
            res.send(result)
        })
        // update user info in db 
        app.patch('/users/:id', async (req, res) => {
            const id = new ObjectId(req.params.id)
            const updatedUser = req.body
            const result = await usersCollection.updateOne(
                { _id: id },
                {
                    $set: {
                        name: updatedUser.name,
                        image: updatedUser.image
                    }
                }
            )
            res.send(updatedUser)
        })



        // Trainer releted api 
        // get all trainers only for admin
        app.get('/trainers', verifyToken, async (req, res) => {
            const result = await trainersCollection.find().toArray()
            res.send(result)
        })
        // save  a trainer in db 
        app.post('/trainers', verifyToken, async (req, res) => {
            const trainer = req.body
            const email = trainer.email;
            // check if user exists in db
            const isExist = await trainersCollection.findOne({ email: email })
            if (isExist) {
                return res.send({ message: 'You have already applied.' })
            }
            const result = await trainersCollection.insertOne(trainer)
            res.send(result)
        })

        //Class releted api 

        // get 6 class for home page
        app.get('/featured-classes', async (req, res) => {
            const result = await classesCollection.aggregate([
                { $sort: { totalBookings: -1 } },
                { $limit: 6 },
            ]).toArray()
            res.send(result)
        })

        // get all class 
        app.get('/classes', async (req, res) => {
            const { page = 1, limit = 6 } = req.query;

            // Convert page and limit to numbers
            const pageNumber = parseInt(page);
            const limitNumber = parseInt(limit);

            // Fetch classes with pagination and populate trainers
            const classes = await classesCollection.find()
                .skip((pageNumber - 1) * limitNumber) // Skip records for pagination
                .limit(limitNumber).toArray(); // Limit results to the specified number

            // Total count of classes
            const totalCount = await classesCollection.countDocuments();

            res.status(200).json({
                success: true,
                classes,
                totalPages: Math.ceil(totalCount / limitNumber),
            });

        })

        // add a class only for admin 
        app.post('/classes', verifyToken, verifyToken, async (req, res) => {
            const classObj = req.body
            const result = await classesCollection.insertOne({ ...classObj, totalBookings: 0 })
            res.send(result)
        })

        // get a class by id
        app.get('/classes/:id', async (req, res) => {
            const id = new ObjectId(req.params.id)
            const classObj = await classesCollection.findOne({ _id: id })
            if (!classObj) {
                return res.status(404).send({ message: 'Class not found.' })
            }
            res.send(classObj)
        })

        // update class info in db
        app.patch('/classes/:id', verifyToken, async (req, res) => {
            const id = new ObjectId(req.params.id)
            const updatedClass = req.body
            const result = await classesCollection.updateOne(
                { _id: id },
                {
                    $set: {
                        name: updatedClass.name,
                        description: updatedClass.description,
                        trainer: updatedClass.trainer
                    }
                }
            )
            res.send(updatedClass)
        })



        // forum-posts releted api 
        // get all forum-posts 
        app.get('/forum-posts', async (req, res) => {
            const { page = 1, limit = 6 } = req.query;

            // Convert page and limit to numbers
            const pageNumber = parseInt(page);
            const limitNumber = parseInt(limit);

            // Fetch posts with pagination and populate trainers
            const posts = await forumPostsCollection.find()
                .skip((pageNumber - 1) * limitNumber) // Skip records for pagination
                .limit(limitNumber).toArray(); // Limit results to the specified number

            // Total count of posts
            const totalCount = await forumPostsCollection.countDocuments();

            res.status(200).json({
                success: true,
                posts,
                totalPages: Math.ceil(totalCount / limitNumber),
            });

            // const result = await forumPostsCollection.find().toArray()
            // res.send(result)
        })
        // save  a forum-post in db 
        app.post('/forum-posts', verifyToken, async (req, res) => {
            const forumPost = req.body
            const result = await forumPostsCollection.insertOne(forumPost)
            res.send(result)
        })

        // get a forum-post by id
        app.get('/forum-posts/:id', async (req, res) => {
            const id = new ObjectId(req.params.id)
            const forumPost = await forumPostsCollection.findOne({ _id: id })
            if (!forumPost) {
                return res.status(404).send({ message: 'Forum-post not found.' })
            }
            res.send(forumPost)
        })

        // update forum-post info in db
        app.patch('/forum-posts/:id', verifyToken, async (req, res) => {
            const id = new ObjectId(req.params.id)
            const updatedForumPost = req.body
            const result = await forumPostsCollection.updateOne(
                { _id: id },
                {
                    $set: {
                        title: updatedForumPost.title,
                        content: updatedForumPost.content,
                        author: updatedForumPost.author
                    }
                }
            )
            res.send(updatedForumPost)
        })

        await client.db('admin').command({ ping: 1 })
        console.log(
            'Pinged your deployment. You successfully connected to MongoDB!'
        )
    } catch (error) {
        console.log(error);
    }
    finally { }
}

run().catch(console.dir)

app.get('/', (req, res) => {
    res.send('Hello From FitTrack Server ');
})

app.listen(port, () => {
    console.log(`FitTrack is listening on port : ${port}`);
})