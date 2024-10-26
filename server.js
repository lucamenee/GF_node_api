const express = require('express');
const pool = require('./db');
const port = 1337;

const app = express();

app.use(express.json());

//routes
app.get('/', (req, res) => {
    res.sendStatus(200);
});

app.get('/setup', async (req, res) => {
    try {
        const data = await pool.query('select * from tags');
        res.status(200).send(data.rows);
    } catch (error) {
        console.error(error.message);
    }
})




app.listen(port, () => console.log(`Server is running on port ${port}`));