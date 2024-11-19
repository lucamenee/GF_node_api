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
 *                      grammi=&essenziale=     
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

//function for executing query, returns {data: queryResult, status: statusCodeForResponse, error: errorMsg}
async function executeQuery(query, pars) {
    let resultQ = null, resultStatus = 200, resultErr = null;
    try {
        resultQ = await pool.query(query, pars);
    } catch (error) {
        resultErr = error.message;
        resultStatus = 500;
    }
    return {'data': resultQ, 'status': resultStatus, 'error': resultErr};
}

// function to implement a endpoint for a single record query
function singleRecordQuery(query, pars) {
    return async (req, res) => {
        console.log("querying...");

        const {data, status, error} = await executeQuery(query, pars);
        let toSend = error ? error : data.rows[0];
        console.log(toSend);    
        res.status(status).send(toSend)
    }
}

// function to implement a endpoint for a generic select query (pass pars in the order they are in the query)
function genericSelectEndpoint(query, pars) {
    return async (req, res) => {
        console.log("querying...");

        const {data, status, error} = await executeQuery(query, pars);
        let toSend = error ? error : data.rows;
        console.log(toSend);    
        res.status(status).send(toSend)
    }
}

// function to implement a endpoint for a generic insert query (pass pars in the order they are in the query)
function genericInsertEndpoint(query, pars) {
    return async (req, res) => {
        console.log("inserting...");

        const {data, status, error} = await executeQuery(query, pars);
        let rowsAffected = 0, msg = "";
        if (data) {
            rowsAffected = data.rowCount;
            msg = "insert succeded, rows affected: "+rowsAffected;
        } else {
            msg = "insert failed, error: "+error;
        }
        console.log(msg);    
        res.status(status).send({ "rowsAffected": rowsAffected, "msg": msg})
    }
}

// function to implement a endpoint for a generic update query (pass pars in the order they are in the query)
function genericUpdateEndpoint(query, pars) {
        return async (req, res) => {
        console.log("updating...");

        const {data, status, error} = await executeQuery(query, pars);
        let rowsAffected = 0, msg = "";
        if (data) {
            rowsAffected = data.rowCount;
            msg = "update succeded, rows affected: "+rowsAffected;
        } else {
            msg = "update failed, error: "+error;
        }
        console.log(msg);    
        res.status(status).send({ "rowsAffected": rowsAffected, "msg": msg})
    }
}


// return all the tags in the db
app.get('/tags', async (req, res) => {
    genericSelectEndpoint("select * from tags") (req, res);
})

// return all the foods in the db
app.get('/alimenti', async (req, res) => {
    genericSelectEndpoint("select * from alimenti natural join categorie") (req, res);
})

// return all the products in a invetory for a given id_inventario
app.get('/inventory', async (req, res) => {
    genericSelectEndpoint("select * from righe_inventario " +
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
        genericUpdateEndpoint("update righe_inventario set grammi = grammi + $1 where id_riga_inventario = $2 ", [grammi, id_riga_inventario]) (req, res);
    } else {
        genericInsertEndpoint("insert into righe_inventario(id_inventario, id_alimento, data_scadenza, grammi, essenziale) values ($1, $2, $3, $4, $5)", [id_inventario, id_alimento, data_scadenza, grammi, essenziale]) (req, res);

    }
})

// get main info from a user of a given id_utente
app.get('/user', async (req, res) => {
    singleRecordQuery("select id_utente, username, email, obiettivo_kcal, id_inventario from utenti where id_utente = $1 limit 1", [req.query.id_utente]) (req, res);
})


/*
 endpoint per 
 
 - updateUserInfo
 - updateFoodQt(int, qt)
 - consumeFood(int, qt) -> chiama uodateFoodqt e poi segna cibo come consumato

*/


/* endpoint non mappati in android e non aggiungti a descrizione di questo file */

// return for how many days in the last 7 the user reached the daily goal of kcal
app.get('/daysGoalReached', async (req, res) => {
    genericSelectEndpoint(`
        WITH dates AS (
            SELECT generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, '1 day'::interval) AS data_consumazione
        )
        select d.data_consumazione, 
         coalesce(obiettivo_kcal > sum(grammi * kcal/100), true) as obbiettivo_raggiunto,
         (select obiettivo_kcal from utenti where id_utente = $1), 
         coalesce(sum(grammi * kcal / 100), 0) as kcal_consumate
        from dates d
        left join alimenti_consumati ac on ac.data_consumazione = d.data_consumazione
        natural left join utenti 
        natural left join alimenti 
        where id_utente = $1 or id_utente is null
        group by d.data_consumazione, obiettivo_kcal

        
    `, [req.query.id_utente]) (req, res);

})

// suggest recipes for a given id_inventario
// TODO: add more complex query to suggest recipes based on the food in the inventory -> v2.0 suggest recipes based on the tags and exèiring date of the food in the inventory
app.get('/suggestRecipes', async (req, res) => {
    genericSelectEndpoint("select distinct id_ricetta, nome_ricetta from ricette natural join righe_ricette natural join alimenti " + 
        "where id_alimento in (select id_alimento from inventari where id_inventario = $1)", [req.query.id_inventario]) (req, res);
})

// update user info (mail, obiettivo_kcal e id_inventario)
app.post('/updateUserInfo', async (req, res) => {
    const mail = req.query.mail;
    const obiettivo_kcal = req.query.obiettivo_kcal;
    const id_inventario = req.query.id_inventario;
    const id_utente = req.query.id_utente;
    /* construisci query in base a che parametri sono passati -> IDEA: concatena stringhe per la set*/
    // if (mail) {
    //     genericUpdateQuery("update utenti set email = $1 where id_utente = $2", [mail, id_utente]) (req, res);
    // }
    // if (obiettivo_kcal) {
    //     genericUpdateQuery("update utenti set obiettivo_kcal = $1 where id_utente = $2", [obiettivo_kcal, id_utente]) (req, res);
    // }
})






// to delete, keep only for popolate the db, keep only for reference for post requests (?make a insert generic query function like for select?)
app.get('/populate', async (req, res) => {
    try {
        console.log("populating db");
        await pool.query("insert into alimenti_consumati(id_utente, id_alimento, data_consumazione, grammi) values (2, 4, '2024-11-16', 200)");
            
        res.status(200).send("data added");
    } catch (error) {
        console.error(error.message);
    }
})


//to delete, keep for queryng the db
app.get('/temp', async (req, res) => { 
    // genericSelectQuery("delete from utenti where id_utente <> 2") (req, res);
    genericSelectEndpoint("select * from alimenti_consumati") (req, res);

    //genericSelectQuery("select * from righe_inventario") (req, res);
    //genericInsertQuery("insert into righe_inventario(id_inventario, id_alimento, data_scadenza, grammi, essenziale) values ($1, $2, $3, $4, $5)", [1, 3, '2024-12-25', 300, false]) (req, res);
})





app.listen(port, () => console.log(`Server is running on port ${port}`));
