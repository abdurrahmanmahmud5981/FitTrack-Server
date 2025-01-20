require('dotenv').config()
const express = require('express')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
const jwt = require('jsonwebtoken')
const stripe = require('stripe')(process.env.CLIENT_SECRET_KEY)

const morgan = require('morgan')

const port = process.env.PORT || 5000
const app = express()


// middleware
const corsOptions = {
    origin: ['http://localhost:5173', 'http://localhost:4173', 'https://fit-track-bd.web.app'],
    credentials: true,
    optionSuccessStatus: 200,
}
app.use(cors(corsOptions))

app.use(express.json()) 
app.use(cookieParser())
app.use(morgan('dev'))


// verify token 
const verifyToken = (req, res, next) => {
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


// Middleware for admin
const verifyAdmin = (req, res, next) => {
    verifyToken(req, res, () => {
        if (req.decoded.role !== "admin") {
            return res.status(403).send({ message: "Access denied! Admins only." });
        }
        next();
    });
};

// Middleware for trainer
const verifyTrainer = (req, res, next) => {
    verifyToken(req, res, () => {
        if (req.decoded.role !== "trainer") {
            return res.status(403).send({ message: "Access denied! Trainers only." });
        }
        next();
    });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.fxybk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;


// const uri = `mongodb://localhost:27017`


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
        const forumPostsCollection = db.collection('forum-posts');
        const slotsCollection = db.collection('slots');
        const bookingsCollection = db.collection('bookings');
        const reviewsCollection = db.collection('reviews');



        // jwt releted api 
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.TOKEN_SECRET, { expiresIn: '9h' })
            res.send({ token });
        })

        // subscribers releted api 
        // get all subscribers only for admin
        app.get('/subscribers', verifyToken, async (req, res) => {
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
        // get user role by email 
        app.get('/users/role/:email', async (req, res) => {
            const email = req.params.email
            const user = await usersCollection.findOne({ email: email })
            if (!user) {
                return res.status(404).send({ message: 'User not found.' })
            }
            res.send(user?.role)
        })

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



        // Trainer releted api ----------------------------------
        // get all trainers only for admin
        app.get('/trainers', async (req, res) => {
            const { status } = req.query;
            const result = await trainersCollection.find({ status: status }).toArray()
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
        // get a trainer by id 
        app.get('/trainers/:id', async (req, res) => {
            const id = new ObjectId(req.params.id)
            const trainer = await trainersCollection.findOne({ _id: id })
            if (!trainer) {
                return res.status(404).send({ message: 'Trainer not found.' })
            }
            res.send(trainer)
        })
        app.get('/trainer-status/:email', async (req, res) => {

            const trainer = await trainersCollection.findOne({ email: req.params?.email })
            if (!trainer) {
                return res.status(404).send({ message: 'Trainer not found.' })
            }
            res.send(trainer)
        })
        // get trainer id 
        app.get('/trainer-id/:email', async (req, res) => {
            const trainer = await trainersCollection.findOne({ email: req.params?.email })
            res.send({ trainerId: trainer?._id })
        })

        // update trainer status in db
        app.patch('/trainers/applicants/confirm/:id', verifyToken, async (req, res) => {
            const id = new ObjectId(req.params.id)
            const email = req.body.email;
           
            const result = await trainersCollection.updateOne(
                { _id: id },
                {
                    $set: {
                        status: "Verified",
                    }
                }
            )
            const updateToTrainer = await usersCollection.findOneAndUpdate({ email }, {
                $set: {
                    role: "trainer",
                }
            })
            res.send(result)
        })
        // reject aa applicent 
        app.patch('/trainers/applicants/reject/:id', verifyToken, async (req, res) => {
            const id = new ObjectId(req.params.id)
            const feedback = req.body?.feedback;
            const result = await trainersCollection.updateOne(
                { _id: id },
                {
                    $set: {
                        status: "Rejected",
                        feedback,
                    }
                }
            )
            res.send(result)
        })

        // delete a trainer in db 
        app.delete('/trainers/:id', verifyToken, async (req, res) => {
            const id = new ObjectId(req.params.id)
            const email = req.query.email;
            // delete from classes collection 
            const result = await classesCollection.updateMany(
                {}, // Match all documents in the collection
                {
                    $pull: { trainers: { trainerId: req.params.id } }, // Remove trainer by trainerId
                }
            );

            // change role to member
            const trainerToMember = await usersCollection.findOneAndUpdate({ email }, {
                $set: {
                    role: "member",
                }
            })
            // delete his slots
            const deleteSlot = await slotsCollection.deleteMany({ trainerEmail: email })
            // remove him from trainers collection
            const removed = await trainersCollection.deleteOne({ _id: id })
            res.send(removed)
        })

        //Class releted api ----------------------------------------

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
            try {
                const { page = 1, limit = 6, search = '' } = req.query;

                // Convert page and limit to numbers
                const pageNumber = parseInt(page);
                const limitNumber = parseInt(limit);

                // Define the search condition
                const searchCondition = search
                    ? { name: { $regex: search, $options: 'i' } } // Case-insensitive regex match
                    : {};

                // Fetch classes with pagination and search
                const classes = await classesCollection
                    .find(searchCondition) // Apply search condition
                    .skip((pageNumber - 1) * limitNumber) // Skip records for pagination
                    .limit(limitNumber) // Limit results to the specified number
                    .toArray();

                // Total count of classes matching the search condition
                const totalCount = await classesCollection.countDocuments(searchCondition);

                res.status(200).json({
                    success: true,
                    classes,
                    totalPages: Math.ceil(totalCount / limitNumber),
                });
            } catch (error) {
                console.error('Error fetching classes:', error);
                res.status(500).json({
                    success: false,
                    message: 'An error occurred while fetching classes.',
                });
            }
        });


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
        app.patch('/classes/:name', verifyToken, async (req, res) => {
            const name = req.params.name;
            const newTrainer = req.body; // The new trainer to add

            try {
                // Check if the trainer already exists in the trainers array
                const classExists = await classesCollection.findOne({
                    name,
                    "trainers.trainerId": newTrainer.trainerId, // Check if a trainer with this ID exists
                });

                if (classExists) {
                    // If trainer exists, return a message with their details
                    return res.status(200).send({
                        message: "Trainer already exists in the class.",
                        trainer: classExists.trainers.find(t => t.trainerId === newTrainer.trainerId),
                    });
                }

                // Add the new trainer to the trainers 
                const result = await classesCollection.updateOne(
                    { name }, // Find the class by name
                    {
                        $addToSet: { trainers: newTrainer }, // Add the new trainer if not already present
                    }
                );

                if (result.modifiedCount > 0) {
                    return res.status(200).send({
                        message: "Trainer added successfully to the class.",
                        trainer: newTrainer,
                    });
                }

                res.status(404).send({ message: "Class not found." });
            } catch (error) {
                console.error("Error adding trainer:", error);
                res.status(500).send({ message: "Internal server error", error });
            }
        });

        // incress totalbookings 
        app.patch('/classes/increment-bookings/:name', verifyToken, async (req, res) => {
            const name = req.params.name;
            const result = await classesCollection.updateOne(
                { name: name },
                { $inc: { totalBookings: 1 } }
            )
            res.send(result)
        })

        // delete a class only for admin 
        app.delete('/classes/:name', verifyToken, async (req, res) => {
            const name = req.params.name;
            const result = await classesCollection.deleteOne({ name: name })
            res.send(result)
        })

        // slots releted api -------------------------------
        // get all slots for a trainer by email 
        app.get('/slots/:email', async (req, res) => {
            const email = req.params.email
            const trainer = await trainersCollection.findOne({ email: email })
            if (!trainer) {
                return res.status(404).send({ message: 'Trainer not found.' })
            }
            const slots = await slotsCollection.find({ trainerEmail: trainer.email }).toArray()
            res.send(slots)
        })

        // get a slot by id 
        app.get('/single-slot/:id', verifyToken, async (req, res) => {
            const id = new ObjectId(req.params.id)
            const slot = await slotsCollection.findOne({ _id: id })
            if (!slot) {
                return res.status(404).send({ message: 'Slot not found.' })
            }
            res.send(slot)
        })

        // save  a slot in db
        app.post('/slots', verifyToken, async (req, res) => {
            const result = await slotsCollection.insertOne(req.body);
            res.send(result)
        })
        // delete a slot in db
        app.delete('/slots/:id', verifyToken, async (req, res) => {
            const id = new ObjectId(req.params.id)
            const result = await slotsCollection.deleteOne({ _id: id })
            res.send(result)
        })

        // forum-posts releted api -------------------------
        // get latest 6  posts for home page
        app.get('/featured-posts', async (req, res) => {
            const result = await forumPostsCollection.aggregate([
                { $sort: { date: -1 } },
                { $limit: 6 },
            ]).toArray();
            res.send(result)
        })

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
        // Manage upvotes and down votes
        app.patch('/forum-posts/:id', async (req, res) => {
            const id = req.params.id
            const { type } = req.body
            const filter = { _id: new ObjectId(id) }
            let updateDoc = {
                $inc: { 'votes.upvotes': 1 },
            }
            if (type === 'down') {
                updateDoc = {
                    $inc: { 'votes.downvotes': 1 },
                }
            }
            const result = await forumPostsCollection.updateOne(filter, updateDoc)
            res.send(result)
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



        // create payment intent------------------------
        app.post('/create-payment-intent', verifyToken, async (req, res) => {
            const { amount } = req.body
            const { client_secret } = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                automatic_payment_methods: {
                    enabled: true,
                },
            })
            res.send({ clientSecret: client_secret })
        })





        // bookings releted api  -------------------------
        // add bookings for a user 
        app.post('/bookings', verifyToken, async (req, res) => {
            const booking = req.body
            const result = await bookingsCollection.insertOne(booking)
            res.send(result)
        })



        // get all bookings for a user by email 
        app.get('/bookings/:email', async (req, res) => {
            const email = req.params.email
            const user = await usersCollection.findOne({ email: email })
            if (!user) {
                return res.status(404).send({ message: 'User not found.' })
            }
            const bookings = await bookingsCollection.find({ userEmail: user.email }).toArray()
            res.send(bookings)
        })
        // get all bookings for admin only 
        app.get('/admin/overview', verifyToken, async (req, res) => {
            const totalSubscribers = await subscribersCollection.estimatedDocumentCount();
            const bookings = await bookingsCollection.aggregate([
                { $sort: { _id: -1 } },
                {
                    $addFields: {
                        _id: {
                            $dateToString: {
                                format: '%d/%m/%Y',
                                date: { $toDate: '$_id' },
                            },
                        },
                    },
                },

                {
                    $project: {
                        _id: 1,
                        price: 1,
                        userName: 1,
                        userEmail: 1,
                        paymentId: 1,
                        packageName: 1
                    },
                },

            ]).toArray()
            const { totalBalance } = await bookingsCollection.aggregate([
                { $group: { _id: null, totalBalance: { $sum: '$price' } } },
                {
                    $project: {
                        _id: 0
                    }
                }
            ]).next()
            res.send({ totalBalance, totalSubscribers, bookings })
        })

        // reviews releted api 
        // add reviews for a class 
        app.post('/reviews', verifyToken, async (req, res) => {
            const review = req.body
            const result = await reviewsCollection.insertOne(review)
            res.send(result)
        })

        // get all reviews for a class by classId 
        app.get('/reviews', async (req, res) => {
            const reviews = await reviewsCollection.find().toArray()
            res.send(reviews)
        })

        // update user info in db

        // await client.db('admin').command({ ping: 1 })
        // console.log(
        //     'Pinged your deployment. You successfully connected to MongoDB!'
        // )
    } catch (error) {
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