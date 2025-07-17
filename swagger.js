require('dotenv').config({ path: '.env', quiet: true, override: true })
const swaggerAutogen = require('swagger-autogen')();

const doc = {
    info: {
        title: 'REST API',
        description: 'Bans'
    },
    securityDefinitions: {
        bearerAuth: {
            type: 'apiKey',
            name: 'Authorization',
            scheme: 'bearer',
            in: 'header',
        },
    },
    host: process.env.SWAGGER_HOST || 'localhost:8080'
};

const outputFile = './swagger-output.json';
const routes = ['./app.js'];

swaggerAutogen(outputFile, routes, doc);