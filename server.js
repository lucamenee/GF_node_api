const express = require('express');
const pool = require('./db');
const port = 1337;

const app = express();

app.use(express.json());

//routes
app.get('/', (req, res) => {
    res.sendStatus(200);
});

app.get('/tags', async (req, res) => {
    try {
        const data = await pool.query('select * from tags');
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