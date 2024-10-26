require('dotenv').config();
const express = require('express');
const pool = require('./db');
const port = 1337;
const app = express();
const API_KEY = process.env.API_KEY;

app.use(express.json());

// Middleware to check API key
app.use((req, res, next) => {
    const apiKey = req.headers['api-key'];
    console.log("------------------------------------------------");
    console.log("New request for: "+req.url );
    console.log("Method: "+req.method);
    if (apiKey && apiKey === API_KEY) {
        next();
        console.log('API key is valid');        
    } else {
        res.status(403).send('Forbidden');
        console.log('API key is invalid');
    }
});

//routes
app.get('/', (req, res) => {
    res.sendStatus(200);
});

app.get('/tags', async (req, res) => {
    try {
        console.log("querying tags");
        const data = await pool.query('select * from tags');
        console.log(data.rows);
        res.status(200).send(data.rows);
    } catch (error) {
        console.error(error.message);
    }
})

app.post('/tags', async (req, res) => {
    try {
        console.log(req.query.tag);
        await pool.query('insert into tags (nome_tag) values($1)', [req.query.tag]);
        res.status(200).send("tag added");
    } catch (error) {
        console.error(error.message);
    }
})




app.listen(port, () => console.log(`Server is running on port ${port}`));