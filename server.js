/**
 *  Simple HTTP REST server + MongoDB (Mongoose) + Express
 * 
 *  Endpoints          Attributes          Method        Description
 * 
 *     /                  -                  GET         Returns the version and a list of available endpoints
 *     /inventory       ?id=                 GET         Returns all the inventory items for a given id
 *
 *     /tags              -                  GET         Get a list of tags
 * 
 *     /login          ?username=&password=  GET        login an existing user, returning bool (for now)
 * 
 *     /register       ?username=&password=  POST       register a new user
 *                      &kcal=&email=
 * 
 *     ...
 * 
 **/

require('dotenv').config();
const express = require('express');
const pool = require('./db');
const port = 1337;
const app = express();
const API_KEY = process.env.API_KEY;
const bcrypt = require('bcryptjs');

app.use(express.json());

// Middleware to check API key
app.use((req, res, next) => {
    const apiKey = req.headers['api-key'];
    console.log("------------------------------------------------");
    console.log("New request for: "+req.url );
    console.log("Method: "+req.method);
    if (apiKey && apiKey === API_KEY) {        
        console.log('API key is valid');  
        next();      
    } else {
        res.status(403).send('Forbidden');
        console.log('API key is invalid');
    }
});


//routes
app.get('/', (req, res) => {
    res.sendStatus(200).json( { api_version: "1.0", endpoints: ["/login", "/tags", "/inventory"] } );
});

// function to create a generic select query (pass pars in the order they are in the query)
function genericSelectQueryEndpoint(query, pars) {
    return async (req, res) => {
        try {
            console.log("querying");
            const data = await pool.query(query, pars);
            console.log(data.rows);
            res.status(200).send(data.rows);
        } catch (error) {
            console.error(error.message);
        }
    }
}

// return all the tags in the db
app.get('/tags', async (req, res) => {
    genericSelectQueryEndpoint("select * from tags") (req, res);
})

// return all the foods in the db
app.get('/alimenti', async (req, res) => {
    genericSelectQueryEndpoint("select * from alimenti") (req, res);
})

// return all the info about an invetory for a given id
app.get('/inventory', async (req, res) => {
    genericSelectQueryEndpoint("select * from inventari natural left join righe_inventario " +
            "natural join alimenti natural join categorie where id_inventario = $1", [req.query.id]) (req, res);
})

// login
app.get('/login', async (req, res) => {
    try {
        console.log("login request for user: "+req.query.username);
        const { username, password } = req.query;
        const resultSalt = await pool.query("select salt from utenti where username = $1", [username]);
        const salt = resultSalt.rows[0].salt;
        if (salt === null) {
            console.log("wrong username");
            res.status(200).send(false);
        } else {
            const resultHash = await pool.query("select hashed_password from utenti where username = $1", [username]);
            const hash = resultHash.rows[0].hashed_password;
            if (hash === bcrypt.hashSync(password, salt)) {
                console.log("login success");
                res.status(200).send(true);
            } else {
                console.log("wrong password");
                res.status(200).send(false);
            }
        }
    } catch (error) {
        console.error(error.message);
    }

})

// registration
app.post('/register', async (req, res) => {
    const { username, password, kcal, email  } = req.query;
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);
    try {
        await pool.query("insert into utenti (username, hashed_password, salt, obiettivo_kcal, email) values ($1, $2, $3, $4, $5)", [username, hash, salt, kcal, email]);
        res.status(200).send("user added");
    } catch (error) {
        console.error(error.message);
    }
})







// to delete, keep only for popolate the db, keep only for reference for post requests (?make a insert generic query function like for select?)
app.post('/popolate', async (req, res) => {
    try {
        console.log("populating db");
        //await pool.query("insert into righe_inventario(id_inventario, id_alimento, data_scadenza, grammi, essenziale) values (1, 3, '2024-12-18', 300, false)");
            
        res.status(200).send("data added");
    } catch (error) {
        console.error(error.message);
    }
})

// to delete, 
app.post('/tags', async (req, res) => {
    try {
        console.log(req.query.tag);
        await pool.query('insert into tags (nome_tag) values($1)', [req.query.tag]);
        res.status(200).send("tag added");
    } catch (error) {
        console.error(error.message);
    }
})

//to delete, keep for queryng the db
app.get('/temp', async (req, res) => { 
    genericSelectQueryEndpoint("alter table utenti alter column hashed_password type varchar(70)") (req, res);
})



app.listen(port, () => console.log(`Server is running on port ${port}`));