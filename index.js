const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config(); 
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const admin = require('firebase-admin'); 

const app = express();
const port = process.env.PORT || 3011;

const uri = process.env.MONGO_URI; 
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH;

if (!serviceAccountPath) {
    console.error("FATAL ERROR: FIREBASE_SERVICE_ACCOUNT_KEY_PATH is not set in .env");
    process.exit(1);
}

let serviceAccount;
try {
    serviceAccount = require(serviceAccountPath); 
} catch (error) {
    console.error("Error reading Firebase service account file. Check FIREBASE_SERVICE_ACCOUNT_KEY_PATH in .env:", error.message);
    process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const allowedOrigins = [
    'http://localhost:5173',
];

app.use(cors({
    origin: allowedOrigins,
    credentials: true, 
}));
app.use(express.json());
app.use(cookieParser());

const verifyToken = async (req, res, next) =>{
    const token = req.cookies.token;
    
    if (!token){
        return res.status(401).send({ message: 'Unauthorized access: No token provided' });
    }
    
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            console.error("Token verification failed:", err);
            return res.status(401).send({ message: 'Unauthorized access: Invalid token' });
        }
        req.decoded = decoded; 
        next();
    });
};

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

let carsCollection;
let bookingsCollection;

async function run(){
    try {
        await client.connect();
        
        const database = client.db("CarRentalDB"); 
        carsCollection = database.collection("cars");
        bookingsCollection = database.collection("bookings");
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. Connected to MongoDB!");

        app.post('/auth/jwt', async (req, res) => {
            const { idToken } = req.body;
            
            if (!idToken){
                return res.status(400).send({ message: 'ID Token required' });
            }
            
            try{
                const decodedToken = await admin.auth().verifyIdToken(idToken);
                const email = decodedToken.email;
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN_SECRET, {
                    expiresIn: '7d', 
                });
                res.cookie('token', token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production', 
                    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict', 
                    maxAge: 7 * 24 * 60 * 60 * 1000, 
                })
                .send({ success: true, email, message: 'JWT cookie set successfully' });
                
            } catch (error) {
                console.error("Firebase/JWT verification failed:", error);
                res.status(401).send({ message: 'Unauthorized: Invalid ID Token' });
            }
        });

        app.post('/auth/logout', async (req, res) =>{
            res.clearCookie('token', {
                maxAge: 0,
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
            }).send({ success: true, message: 'Token cleared' });
        });

        app.get('/cars', async (req, res) => {
            const { limit, search } = req.query;
            let query = {};
            let options = {};
            
            if (search) {
                query.carName = { $regex: new RegExp(search, 'i') }; 
            }
            
            if (limit && !search) {
                options.limit = parseInt(limit);
                options.sort = { createdAt: -1 }; 
            }

            const result = await carsCollection.find(query, options).toArray();
            res.send(result);
        });

        app.get('/cars/:id', async (req, res) => {
            const id = req.params.id;
            try {
                const query = { _id: new ObjectId(id) };
                const car = await carsCollection.findOne(query);
                if (!car) {
                    return res.status(404).send({ message: "Car not found." });
                }
                res.send(car);
            } catch (error) {
                res.status(400).send({ message: "Invalid Car ID format." });
            }
        });

        app.post('/cars', verifyToken, async (req, res) => {
            const newCar = req.body;
            
            if (!newCar.providerEmail || !newCar.carName || !newCar.rentPrice) {
                 return res.status(400).send({ message: "Missing required fields." });
            }

            const carToInsert = {
                ...newCar,
                rentPrice: parseFloat(newCar.rentPrice),
                status: 'Available',
                createdAt: new Date(),
            };
            
            const result = await carsCollection.insertOne(carToInsert);
            res.send(result);
        });
        
        app.get('/my-listings', verifyToken, async (req, res) => {
            const providerEmail = req.decoded.email;
            
            const query = { providerEmail: providerEmail };
            const result = await carsCollection.find(query).toArray();
            res.send(result);
        });
        
        // ===========================================
        // FIX: Car Update Route (PATCH /cars/:id)
        // ===========================================
        app.patch('/cars/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const updatedCarData = req.body;
            const userEmail = req.decoded.email;
            
            // 1. ID Validation Check
            if (!ObjectId.isValid(id)) {
                console.error(`Invalid ID detected in PATCH: ${id}`);
                return res.status(400).send({ message: "Invalid Car ID format." });
            }

            try {
                const query = { _id: new ObjectId(id) };
                const car = await carsCollection.findOne(query);
                
                if (!car) {
                    return res.status(404).send({ message: "Car not found." });
                }
                
                if (car.providerEmail !== userEmail) {
                    return res.status(403).send({ message: "Forbidden: You do not own this listing." });
                }
                
                delete updatedCarData.providerEmail;
                delete updatedCarData.providerName;
                
                // ✅ FINAL FIX: Update ডেটা থেকে _id ফিল্ডটি মুছে দিন
                delete updatedCarData._id; 
                
                const updateDoc = {
                    $set: {
                        ...updatedCarData,
                        // 2. Safe Parsing Fix: If rentPrice is missing/empty string, it uses 0
                        rentPrice: updatedCarData.rentPrice 
                            ? parseFloat(updatedCarData.rentPrice) 
                            : 0,
                    },
                };

                const result = await carsCollection.updateOne(query, updateDoc);
                res.send(result);
                
            } catch (error) {
                // 3. Log actual error for better diagnosis
                console.error("PATCH Car Update Error (DB Query/Data Issue):", error.message);
                res.status(400).send({ message: "Invalid Car ID format or update error." });
            }
        });
        // ===========================================


        app.delete('/cars/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const userEmail = req.decoded.email;
            
            try {
                const query = { _id: new ObjectId(id) };
                const car = await carsCollection.findOne(query);
                
                if (!car) {
                    return res.status(404).send({ message: "Car not found." });
                }
                
                if (car.providerEmail !== userEmail) {
                    return res.status(403).send({ message: "Forbidden: You do not own this listing." });
                }
                
                const result = await carsCollection.deleteOne(query);
                res.send(result);
            } catch (error) {
                res.status(400).send({ message: "Invalid Car ID format." });
            }
        });


        // 6. BOOKING ROUTES 
        app.post('/book', verifyToken, async (req, res) => {
            const bookingData = req.body;
            const userEmail = req.decoded.email; 
            const { carId, userEmail: reqUserEmail } = bookingData;
            
            if (userEmail !== reqUserEmail) {
                 return res.status(403).send({ message: "Forbidden: User email mismatch." });
            }
            
            try {
                const carQuery = { _id: new ObjectId(carId) };
                const car = await carsCollection.findOne(carQuery);
                
                if (!car) {
                    return res.status(404).send({ message: "Booking failed: Car not found." });
                }

                if (car.providerEmail === userEmail) {
                    return res.status(400).send({ message: "Booking failed: You cannot book your own listing." });
                }

                if (car.status !== 'Available') {
                    return res.status(400).send({ message: "Booking failed: Car is already booked or unavailable." });
                }
                
                const bookingToInsert = {
                    ...bookingData,
                    carId: new ObjectId(carId), 
                    bookingDate: new Date(),
                };
                const bookingResult = await bookingsCollection.insertOne(bookingToInsert);

                const updateCarResult = await carsCollection.updateOne(carQuery, {
                    $set: { status: 'Booked' }
                });

                if (updateCarResult.modifiedCount === 0) {
                     await bookingsCollection.deleteOne({ _id: bookingResult.insertedId });
                     return res.status(500).send({ message: "Booking failed: Could not update car status." });
                }
                
                res.send({ success: true, bookingId: bookingResult.insertedId, carUpdate: updateCarResult });

            } catch (error) {
                 console.error("Booking Error:", error);
                 res.status(500).send({ message: "An unexpected error occurred during booking." });
            }
        });

        app.get('/my-bookings', verifyToken, async (req, res) => {
            const userEmail = req.decoded.email;
            
            const query = { userEmail: userEmail };
            
            const result = await bookingsCollection.aggregate([
                { $match: query },
                {
                    $lookup: {
                        from: "cars",
                        localField: "carId",
                        foreignField: "_id",
                        as: "carDetails"
                    }
                },
                {
                    $unwind: {
                        path: "$carDetails",
                        preserveNullAndEmptyArrays: true
                    }
                }
            ]).toArray();
            res.send(result);
        });
        
        // ======================================
        // DELETE BOOKING ROUTE
        // ===========================================
        app.delete('/booking/:id', verifyToken, async (req, res) => {
            const bookingId = req.params.id;
            const userEmail = req.decoded.email;
            
            try {
                // 1. Find booking and verify ownership
                const bookingQuery = { _id: new ObjectId(bookingId), userEmail: userEmail };
                const booking = await bookingsCollection.findOne(bookingQuery);

                if (!booking) {
                    return res.status(404).send({ message: "Booking not found or you don't have permission to cancel it." });
                }
                
                const carId = booking.carId;
                
                // 2. Delete the booking record
                const deleteResult = await bookingsCollection.deleteOne(bookingQuery);

                if (deleteResult.deletedCount === 0) {
                    return res.status(500).send({ message: "Cancellation failed on database." });
                }
                
                // 3. Update Car Status to 'Available'
                const carUpdateResult = await carsCollection.updateOne(
                    { _id: carId },
                    { $set: { status: 'Available' } }
                );

                res.send({ success: true, message: 'Booking cancelled and car status updated to Available.', carUpdate: carUpdateResult });

            } catch (error) {
                console.error("Cancellation Error:", error);
                res.status(400).send({ message: "Invalid Booking ID format or server error." });
            }
        });
        

    } finally {
        // Keeps the client connected
    }
}
run().catch(console.dir);


// 7. BASE ROUTE & LISTENER
app.get('/', (req, res) => {
    res.send('Car Rental Backend Server is Running!');
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});