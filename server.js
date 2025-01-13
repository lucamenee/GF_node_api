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
 *                      grammi=  
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
 *     /daysGoalReached ?id_utente=          GET
 * 
 *     /suggestRecipes  ?id_inventario=      GET
 * 
 *     /updateUserInfo  ?mail=&              POST
 *                      obiettivo_kca=&
 *                      id_inventario=&
 *                      id_utente=
 * 
 *     /updateFoodQt    ?id_riga=&qt=        POST
 * 
 *     /updateFoodExipire ?id_riga=&data=    POST
 * 
 * 
 *     /consumeFood     ?id_utente=&qt=&     POST
 *                      id_riga=
 * 
 *     /getUsersInInventory                  GET
 *                      ?id_inventario   
 * 
 *     /userTodaysCalories                   GET
 *                      ?id_utente=
 * 
 *     /inventoryOg   ?username=           GET            return id_inventario_og for a given username
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
    res.sendStatus(200).json( { api_version: "1.0", 
        endpoints: ["/login", "/register", "/tags", "/inventory", "/alimenti", "/addFoodInventory", 
            "/user", "/daysGoalReached", "/suggestRecipes", "/updateUserInfo", "/updateFoodQt", 
            "/UpdateFoodExpire", "/consumeFood", "/getUsersInInventory"] } );
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
function singleRecordEndpoint(query, pars) {
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
    genericSelectEndpoint("select * from alimenti natural join categorie order by nome_alimento") (req, res);
})

// return all the products in a invetory for a given id_inventario
app.get('/inventory', async (req, res) => {
    genericSelectEndpoint("select *, grammi/peso_unitario as numero_prodotti from righe_inventario " +
            "natural join alimenti natural join categorie " +
            "where id_inventario = $1 and grammi > 0 " + 
            "order by data_scadenza", [req.query.id_inventario]) (req, res);
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
    let msg = "", status = 200, status_r = 200;

    const { username, password, kcal, email  } = req.query;
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);

    try {
        const queryRes = await pool.query("select id_utente from utenti where username = $1", [username]);
        if (queryRes.rowCount > 0){
            msg = "usernamae already used by another user";
            status_r = 300;
        } else {
            await pool.query("insert into utenti (username, hashed_password, salt, obiettivo_kcal, email) values ($1, $2, $3, $4, $5)", [username, hash, salt, kcal, email]);
            await pool.query("insert into inventari default values");
            const id_inventario = await pool.query("select max(id_inventario) from inventari");
            await pool.query("update utenti set id_inventario = $1, id_inventario_og = $1 where username = $2", [id_inventario.rows[0].max, username]);
            msg = "user added";
        }
       
    } catch (error) {
        msg = error.message;
        status = 500;
    }
    console.log({status: status, msg: msg});
    res.status(status).send({status: status_r, msg: msg});
})

// insert alimenti in righe_inventario if not already in the db (with the same data_scadenza), update quantity otherwise
app.post('/addFoodInventory', async (req, res) => {
    let { id_inventario, id_alimento, data_scadenza, grammi} = req.query;
    

    // check if the row is already in the db
    const result = await pool.query("select id_riga_inventario from righe_inventario where id_inventario = $1 and id_alimento = $2 and data_scadenza = $3", [id_inventario, id_alimento, data_scadenza]);
    if (result.rowCount > 0) {
        const id_riga_inventario = result.rows[0].id_riga_inventario;
        console.log("row already in the db");
        genericUpdateEndpoint("update righe_inventario set grammi = grammi + $1 where id_riga_inventario = $2 ", [grammi, id_riga_inventario]) (req, res);
    } else {
        genericInsertEndpoint("insert into righe_inventario(id_inventario, id_alimento, data_scadenza, grammi) values ($1, $2, $3, $4)", [id_inventario, id_alimento, data_scadenza, grammi]) (req, res);

    }
})

// get main info from a user of a given id_utente
app.get('/user', async (req, res) => {
    singleRecordEndpoint("select u1.id_utente as id_utente, u1.username as username, u1.email as email, " + 
        "u1.obiettivo_kcal as obiettivo_kcal, u1.id_inventario as id_inventario, u2.username as proprietario " + 
        "from utenti u1 join utenti u2 on u1.id_inventario = u2.id_inventario_og " +
        "where u1.id_utente = $1 limit 1", [req.query.id_utente]) (req, res);
})

// return for how many days in the last 7 the user reached the daily goal of kcal
app.get('/daysGoalReached', async (req, res) => {
    genericSelectEndpoint(`
        WITH dates AS (
            SELECT generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, '1 day'::interval) AS data_consumazione
        )
        SELECT 
            d.data_consumazione::date AS data_consumazione, 
            COALESCE(obiettivo_kcal > SUM(grammi * kcal / 100), true) AS obiettivo_raggiunto,
            (SELECT obiettivo_kcal FROM utenti WHERE id_utente = $1) AS obiettivo_kcal,
            COALESCE(SUM(grammi * kcal / 100), 0) AS kcal_consumate
        FROM dates d
        LEFT JOIN alimenti_consumati ac ON DATE_TRUNC('day', ac.data_consumazione) = d.data_consumazione
        NATURAL LEFT JOIN utenti 
        NATURAL LEFT JOIN alimenti 
        WHERE id_utente = $1 OR id_utente IS NULL
        GROUP BY d.data_consumazione, obiettivo_kcal
        ORDER BY d.data_consumazione         
    `, [req.query.id_utente]) (req, res);

})

// suggest recipes for a given id_inventario
// TODO: add more complex query to suggest recipes based on the food in the inventory -> v2.0 suggest recipes based on the tags and exèiring date of the food in the inventory
app.get('/suggestRecipes', async (req, res) => {
    const query = `
        SELECT DISTINCT r.id_ricetta, r.nome_ricetta
        FROM ricette r
        WHERE NOT EXISTS (
            SELECT 1
            FROM righe_ricette rr2
            WHERE rr2.id_ricetta = r.id_ricetta
            AND rr2.id_alimento IN (
                select id_alimento
                from alimenti natural left join righe_inventario
                where id_inventario = $1
                group by id_alimento
                having sum(grammi) = 0
            )
        )
        
        
    `;
    const {data, status, error} = await executeQuery(query, [req.query.id_inventario]);
    if (error) res.status(status).send(error); 
    let result = data.rows;
    for (let r_row of result) {
        const {data: data_row, status, error} = await executeQuery('select nome_alimento, grammi from righe_ricette natural join alimenti where id_ricetta = $1', [r_row.id_ricetta]);
        r_row.ingredienti = data_row.rows;
    }
    console.log(result);
    res.status(status).send(result);
})

// update user info (mail, obiettivo_kcal e id_inventario)
app.post('/updateUserInfo', async (req, res) => {
    const mail = req.query.mail;
    const obiettivo_kcal = req.query.obiettivo_kcal;
    const id_inventario = req.query.id_inventario;
    const id_utente = req.query.id_utente;
    
    let resMail, resObiettivoKcal, resIdInventario;
    let rowsAffected = 0, msg = null, status = 200;

    if (mail) {
        resMail = await executeQuery("update utenti set email = $1 where id_utente = $2", [mail, id_utente]);
        msg = resMail.error;
        status = status < resMail.status ? resMail.status : status;
    }
    if (obiettivo_kcal) {
        resObiettivoKcal = await executeQuery("update utenti set obiettivo_kcal = $1 where id_utente = $2", [obiettivo_kcal, id_utente]);
        msg += resObiettivoKcal.error;
        status = status < resObiettivoKcal.status ? resObiettivoKcal.status : status;

    }
    if (id_inventario) {
        resIdInventario = await executeQuery("update utenti set id_inventario = $1 where id_utente = $2", [id_inventario, id_utente]);
        msg += resIdInventario.error;
        status = status < resIdInventario.status ? resIdInventario.status : status;
    }

    if (!msg) {
        rowsAffected = 1;
        msg = "Update succeded, rows affected " + rowsAffected;
    }
    res.status(status).send({"rowsAffected": rowsAffected, "msg": msg});
})

// add qt grams for food of row id_riga (qt can be negative for subtractions)
app.post('/updateFoodQt', async (req, res) => {
    const id_riga = req.query.id_riga;
    const qt = req.query.qt;
    genericUpdateEndpoint("update righe_inventario set grammi = (select grammi from righe_inventario where id_riga_inventario = $2) + $1 where id_riga_inventario = $2", [qt, id_riga]) (req, res);
})

// modify expiring date for food of row id_riga
app.post('/updateFoodExpire', async (req, res) => {
    const id_riga = req.query.id_riga;
    const data = req.query.data;
    genericUpdateEndpoint("update righe_inventario set data_scadenza = $1 where id_riga_inventario = $2", [data, id_riga]) (req, res);
})

// remove qt grams from food of row id_riga from righe_inventario, adding qt grams of that food in table alimenti_consumati
// params (id_utente, qt, id_riga)
app.post('/consumeFood', async (req, res) => {
    const id_riga = req.query.id_riga;
    const qt = req.query.qt;
    const id_utente = req.query.id_utente;
    // get data from table righe_inventario
    const {data: data_get, status: status_get, error: error_get} = await executeQuery('select * from righe_inventario where id_riga_inventario = $1', [id_riga]); 
    const data_get_row = data_get.rows[0];
    const id_alimento = data_get_row.id_alimento
    
    
    // remove from table righe_inventario
    const {data: data_remove, status: status_remove, error: error_remove} = await executeQuery('update righe_inventario set grammi = (select grammi from righe_inventario where id_riga_inventario = $2) + $1 where id_riga_inventario = $2', [-qt, id_riga]);
    let msg = "update succeded", rowsAffected = 0, status = status_remove;

    if (!error_remove) {
        rowsAffected += data_remove.rowCount;
        
        // if succeded add that to table alimenti_consumati (it might be usefull to query the data first with a select for a easier insert)
        const {data: data_insert, status: status_insert, error: error_insert} = await executeQuery('insert into alimenti_consumati (id_utente, id_alimento, data_consumazione, grammi) values ($1, $2, $3, $4)', [id_utente, id_alimento, new Date().toISOString(), qt]);
        status = status_insert;
        if (error_insert) {
            msg = "error, " + error_insert;
        } else {
            rowsAffected += data_insert.rowCount;
        }
    } else {
        msg = "error, " + error_remove;
    }
    console.log(msg);
    res.status(status).send({"msg": msg, "rowsAffected": rowsAffected});
})

// return all the users who have access to inventory with a certain id_inventario
app.get('/getUsersInInventory', async (req, res) => {
    const id_inventario = req.query.id_inventario
    genericSelectEndpoint("select id_utente, username, email, id_inventario, obiettivo_kcal from utenti where id_inventario = $1", 
        [id_inventario]) (req, res);
})

// return the calories consumed by user with a certain id_user 
app.get('/userTodaysCalories', async (req, res) =>  {

    const {data, status, error} = await executeQuery("select coalesce(sum(grammi * kcal / 100), 0) as kcal_consumate  " + 
        "from alimenti_consumati natural join alimenti natural join utenti " + 
        "where id_utente = $1 and data_consumazione::date = CURRENT_DATE", 
        [req.query.id_utente]);
    const result = data.rows[0].kcal_consumate;
    console.log(result);
    res.status(status).send(result);
})

// return id_inventario_og for a given username
app.get('/inventoryOg', async (req, res) => {
    let result = {code: 400, msg: "No user found ", id_inventario_og: null};
    const username = req.query.username;
    const {data, status, error} = await executeQuery("select * from utenti where username = $1", [username]);
    if (error) {
        result.msg += error;
    } else if (data.rowCount > 0) {
        result = {code: 300, msg:"User found", id_inventario_og: data.rows[0].id_inventario_og};
    }
    console.log(result);
    res.status(200).send(result);
})








// to delete, keep only for popolate the db, keep only for reference for post requests (?make a insert generic query function like for select?)
app.get('/populate', async (req, res) => {
    // try {
    //     console.log("populating db");
    //     //await pool.query("insert into righe_ricette (id_ricetta, id_alimento, grammi) values (2, 7, 100)");
    //     const q = await pool.query("select * from ricette");
            
    //     res.status(200).send(q.rows);
    // } catch (error) {
    //     console.error(error.message);
    // }

    //genericSelectEndpoint("delete from utenti where id_inventario is null") (req, res);
})


//to delete, keep for queryng the db
app.get('/temp', async (req, res) => { 
    //genericSelectEndpoint("select * from righe_inventario") (req, res);
    //genericUpdateEndpoint("update utenti set id_inventario_og = 2 where username = 'test'") (req, res);
    //genericSelectEndpoint("select * from righe_inventario where id_inventario=1") (req, res);
    //genericInsertEndpoint("insert into categorie (nome_categoria, durata_media) values ('pesce', 3)") (req, res);
    // genericSelectEndpoint("select * from utenti;") (req, res);
    //genericSelectEndpoint("select * from categorie") (req, res);
    // genericSelectEndpoint("insert into alimenti (nome_alimento, kcal, img, peso_unitario, id_cat) "+
    //     "values ('formaggio', 402, 'formaggio.png', null, 6), "+
    //     "('carne', 143, 'carne.png', null, 2), "+
    //     "('patate', 73, 'patate.png', 160, 1), "+
    //     "('salsiccia', 350, 'salsicce.png', null, 2), " +
    //     "('carote', 40, 'carota.png', 60, 1), " +
    //     "('salmone', 208, 'salmone.png', null, 5), " +
    //     "('pesce', 150, 'pesce.png', null, 5)") (req, res);

    // genericSelectEndpoint("select * from ricette") (req,res);
    // genericSelectEndpoint("insert into ricette (nome_ricetta) values ('salsicce grigliate e patatine fritte')") (req, res);
    // genericSelectEndpoint("insert into righe_ricette (id_ricetta, id_alimento, grammi) values (4, 10, 150), (4, 11, 200)") (req, res);
    
    //genericSelectQuery("select * from righe_inventario") (req, res);
    //genericInsertQuery("insert into righe_inventario(id_inventario, id_alimento, data_scadenza, grammi, essenziale) values ($1, $2, $3, $4, $5)", [1, 3, '2024-12-25', 300, false]) (req, res);
})





app.listen(port, () => console.log(`Server is running on port ${port}`));
