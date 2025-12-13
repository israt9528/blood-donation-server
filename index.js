const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 3000;

// middleware
app.use(express.json());
app.use(cors());

const admin = require("firebase-admin");

const serviceAccount = require("./firebase-adminsdk.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.u1z8wkz.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const verifyFBToken = async (req, res, next) => {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }

  try {
    const idToken = token.split(" ")[1];
    const decoded = await admin.auth().verifyIdToken(idToken);
    console.log(decoded);
    req.decoded_email = decoded.email;

    next();
  } catch (error) {
    res.status(401).send({ message: "unauthorized access" });
  }
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const db = client.db("donation-db");
    const donorCollection = db.collection("donors");
    const requestCollection = db.collection("requests");

    // donar apis

    app.post("/donors", async (req, res) => {
      const data = req.body;
      const result = await donorCollection.insertOne(data);
      res.send(result);
    });

    app.get("/donors", async (req, res) => {
      const email = req.query.email;
      const query = {};
      if (email) {
        query.email = email;
      }
      const result = await donorCollection.find(query).toArray();
      res.send(result);
    });

    app.put("/donors/:id", async (req, res) => {
      const { name, email, district, upazila, image, bloodGroup } = req.body;
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const update = {
        $set: {
          name: name,
          email: email,
          district: district,
          upazila: upazila,
          image: image,
          bloodGroup: bloodGroup,
          modifiedAt: new Date(),
        },
      };
      const result = await donorCollection.updateOne(query, update);
      res.send(result);
    });

    app.get("/donors", async (req, res) => {
      const result = await donorCollection.find().toArray();
      res.send(result);
    });

    // request api
    app.post("/requests", async (req, res) => {
      const data = req.body;
      data.createdAt = new Date();
      data.donationStatus = "pending";
      const result = await requestCollection.insertOne(data);
      res.send(result);
    });

    app.get("/requests", verifyFBToken, async (req, res) => {
      const email = req.query.email;
      const query = {};
      if (email) {
        query.requesterEmail = email;

        if (email !== req.decoded_email) {
          return res.status(403).send({ message: "forbidden access" });
        }
      }
      const result = await requestCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/requests/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await requestCollection.findOne(query);
      res.send(result);
    });

    app.put("/requests/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const data = req.body;
      const update = {
        $set: data,
      };
      const result = await requestCollection.updateOne(query, update);
      res.send(result);
    });

    app.patch("/requests/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const { donorName, donorEmail } = req.body;
      const update = {
        $set: {
          donorName: donorName,
          donorEmail: donorEmail,
          donationStatus: "inprogress",
        },
      };
      const request = await requestCollection.updateOne(query, update);
      res.send(request);
    });

    app.delete("/requests/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await requestCollection.deleteOne(query);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Donation server is running!");
});

app.listen(port, () => {
  console.log(`server listening on port ${port}`);
});
