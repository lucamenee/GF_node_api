/**
 *  HTTP REST server + Express
 * 
 *  Endpoints          Attributes          Method        Description
 * 
 *     /                  -                  GET         Returns the version and a list of available endpoints
 * 
 *     /inventory       ?id_inventario=      GET         Return all the products in a invetory for a given id_inventario
 * 
 *     /alimenti          -                  GET         Returns all the foods in the db
 * 
 *     /addFoodInventory ?id_inventario=&    POST        Add a food to an inventory
 *                      id_alimento=&
 *                      data_scadenza=&
 *                      grammi=&essenziale     
 *
 *     /tags              -                  GET         Get a list of tags
 * 
 *     /login          ?username=&password=  GET        login an existing user, returning bool (for now)
 * 
 *     /register       ?username=&password=  POST       register a new user
 *                      &kcal=&email=
 *      
 *     /user            ?id_utente=          GET       get all info from a user of a given id_utente
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

// single record query
function singleRecordQuery(query, pars) {
    return async (req, res) => {
        console.log("querying...");
        try {
            const data = await pool.query(query, pars);
            console.log(data.rows[0]);
            res.status(200).send(data.rows[0]);
        } catch (error) {
            console.error(error.message);
        }
    }
}

// function to create a generic select query (pass pars in the order they are in the query)
function genericSelectQuery(query, pars) {
    return async (req, res) => {
        console.log("querying...");
        try {
            const data = await pool.query(query, pars);
            console.log(data.rows);
            res.status(200).send(data.rows);
        } catch (error) {
            console.error(error.message);
        }
    }
}

// function to create a generic insert query 
function genericInsertQuery(query, pars) {

    return async (req, res) => {
        console.log("inserting...");
        let status = 200, msg = "", rowsAffected = 0;
        try {
            const result = await pool.query(query, pars);
            rowsAffected = result.rowCount;
            msg =  "insert succeded, rows affected: "+rowsAffected;
        } catch (error) {
            status = 500;
            msg = "insert failed, error: "+error.message;
        }
        console.error(msg);
        res.status(status).send({ "rowsAffected": rowsAffected, "msg": msg });
    };
}

// function to create a generic update query
function genericUpdateQuery(query, pars) {
    return async (req, res) => {
        console.log("updating...");
        let status = 200, msg = "update success", rowsAffected = 0;
        try {
            const result = await pool.query(query, pars);
            rowsAffected = result.rowCount;
            console.log("update succeded, rows affected: "+rowsAffected);
        } catch (error) {
            status = 500;
            msg = "update failed, error: "+error.message;
            console.error(error.message);
        }
        res.status(status).send({ "rowsAffected": rowsAffected, "msg": msg });
    };
}


// return all the tags in the db
app.get('/tags', async (req, res) => {
    genericSelectQuery("select * from tags") (req, res);
})

// return all the foods in the db
app.get('/alimenti', async (req, res) => {
    genericSelectQuery("select * from alimenti natural join categorie") (req, res);
})

// return all the products in a invetory for a given id_inventario
app.get('/inventory', async (req, res) => {
    genericSelectQuery("select * from righe_inventario " +
            "natural join alimenti natural join categorie " +
            "where id_inventario = $1", [req.query.id_inventario]) (req, res);
})

// login
app.post('/login', async (req, res) => {
    try {
        console.log("login request for user: "+req.query.username);
        const { username, password } = req.query;
        const resultSalt = await pool.query("select salt from utenti where username = $1", [username]);
        let salt = null, msg = null, id_utente = null, status = 200, id_inventario = null;
        try {
            salt = resultSalt.rows[0].salt;
        } catch (error) {
            msg = "wrong username";
            status = 401;
        }
        if (salt !== null) {
            const resultHash = await pool.query("select hashed_password, id_utente, id_inventario from utenti where username = $1", [username]);
            const hash = resultHash.rows[0].hashed_password;
            if (hash === bcrypt.hashSync(password, salt)) {
                msg = "login success";
                id_utente = resultHash.rows[0].id_utente;
                id_inventario = resultHash.rows[0].id_inventario;
            } else {
                msg = "wrong password";
                status = 401;
            }
        }

        console.log(msg);
        res.status(status).send({"msg": msg, "id_utente": id_utente, "id_inventario": id_inventario});

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
        res.status(200).send({msg: "user added"});
    } catch (error) {
        console.error({msg: error.message});
    }
})

// insert alimenti in righe_inventario if not already in the db (with the same data_scadenza), update quantity otherwise
app.post('/addFoodInventory', async (req, res) => {
    let { id_inventario, id_alimento, data_scadenza, grammi, essenziale } = req.query;
    if (!essenziale) essenziale = false;

    // check if the row is already in the db
    const result = await pool.query("select id_riga_inventario from righe_inventario where id_inventario = $1 and id_alimento = $2 and data_scadenza = $3", [id_inventario, id_alimento, data_scadenza]);
    if (result.rowCount > 0) {
        const id_riga_inventario = result.rows[0].id_riga_inventario;
        console.log("row already in the db");
        genericUpdateQuery("update righe_inventario set grammi = grammi + $1 where id_riga_inventario = $2 ", [grammi, id_riga_inventario]) (req, res);
    } else {
        genericInsertQuery("insert into righe_inventario(id_inventario, id_alimento, data_scadenza, grammi, essenziale) values ($1, $2, $3, $4, $5)", [id_inventario, id_alimento, data_scadenza, grammi, essenziale]) (req, res);

    }
})

// get main info from a user of a given id_utente
app.get('/user', async (req, res) => {
    singleRecordQuery("select id_utente, username, email, obiettivo_kcal, id_inventario from utenti where id_utente = $1 limit 1", [req.query.id_utente]) (req, res);
})


/*
 endpoint per ritonrare per quanti giorni negli ultimi 7 l'utente ha raggiunto l'obiettivo giornaliero di kcal 
*/







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


//to delete, keep for queryng the db
app.get('/temp', async (req, res) => { 
    // genericSelectQuery("delete from utenti where id_utente <> 2") (req, res);
    genericSelectQuery("select * from utenti") (req, res);

    // genericUpdateQuery("update utenti set id_inventario = 1") (req, res);

    //genericSelectQuery("select * from righe_inventario") (req, res);
    //genericInsertQuery("insert into righe_inventario(id_inventario, id_alimento, data_scadenza, grammi, essenziale) values ($1, $2, $3, $4, $5)", [1, 3, '2024-12-25', 300, false]) (req, res);
})





app.listen(port, () => console.log(`Server is running on port ${port}`));
