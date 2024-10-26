const {Pool} = require('pg');
const poll = new Pool({
    user: 'uitt04lj8jrrp8ffu1rz',
    password: 'iWhn9gyFCQfvLjBdeMCr8Pn3Dsc2A6',
    host: 'brpmbfp4ov0tm8p1epeh-postgresql.services.clever-cloud.com',
    port: '50013',
    database: 'brpmbfp4ov0tm8p1epeh',
});

module.exports = poll;