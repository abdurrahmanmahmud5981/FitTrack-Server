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
const varifyToken = (req, res, next) => {
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

        // jwt releted api 
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            console.log(user);
            const token = jwt.sign(user, process.env.TOKEN_SECRET, { expiresIn: '9h' })
            res.send({ token });
        })
        

        // user releted api
        // save or update a user in db 
        app.post('/users/:email', async (req, res) => {
            const email = req.body.email
            const user = req.body
            // check if user exists in db
            const isExist = await usersCollection.findOne({ email: email })
            if (isExist) {
                return res.send(isExist)
            }
            const result = await usersCollection.insertOne({ ...user, role: 'member', timestamp: Date.now() })
            res.send(result)
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