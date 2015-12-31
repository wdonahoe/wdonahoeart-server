var express 		= require('express');
var morgan 			= require('morgan');
var mongoose 		= require('mongoose');
var bodyParser 		= require('body-parser');
var cookieParser 	= require('cookie-parser');
var session 		= require('express-session');
var cors 			= require('cors');
var httpStatus 		= require('http-status');

var logger 			= require('./config/logger');
var config 			= require('./config/config');

var app 	= express();
var port 	= Number(process.env.PORT || 8080);

logger.debug("Overriding Express logger");

app.use(bodyParser.json({limit: '5mb'}));
app.use(bodyParser.urlencoded({ limit: '5mb', extended: true }));
app.use(cookieParser());
app.use(cors({
	origin: ['*'],
	allowedHeaders: ['origin', 'Authorization', 'x-requested-with'],
	maxAge: -1,
	preflightContinue: true
}));
app.use(morgan('combined', { stream: {write: (message, encoding) => logger.info(message)}}));

mongoose.connect(config.mongo.url);
var db = mongoose.connection;
db.once('open', open => logger.info("✔ connected to " + db.name + ' at ' + db.host + ' on port ' + db.port));
db.on('error', err => logger.error(err));

app.use('/api',cors(), require('./routes'));
app.use('*', (req, res) => res.sendStatus(httpStatus[404]).end());

app.listen(port, () => logger.info("✔ Listening on port " + port));
