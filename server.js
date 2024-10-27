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
 *     /login          ?username=&password=  POST        login an existing user, returning bool (for now)
 *    
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
    res.sendStatus(200).json( { api_version: "1.0", endpoints: ["/login", "/tags", "/inventory"] } );
});

// function to create a generic select query (pass pars in the order they are in the query)
function genericSelectQuery(query, pars) {
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
    genericSelectQuery('select * from tags') (req, res);
})

// return all the foods in the db
app.get('/alimenti', async (req, res) => {
    genericSelectQuery('select * from alimenti') (req, res);
})

// return all the info about an invetory for a given id
app.get('/inventory', async (req, res) => {
    genericSelectQuery('select * from inventari natural left join righe_inventario ' +
            'natural join alimenti natural join categorie where id_inventario = $1', [req.query.id]) (req, res);
})







// to delete, keep only for popolate the db
app.post('/popolate', async (req, res) => {
    try {
        console.log("populating db");
        //await pool.query("insert into righe_inventario(id_inventario, id_alimento, data_scadenza, grammi, essenziale) values (1, 3, '2024-12-18', 300, false)");
            
        res.status(200).send("inventory added");
    } catch (error) {
        console.error(error.message);
    }
})

// to delete, keep only for reference for post requests
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