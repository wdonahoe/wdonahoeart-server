var express 		= require('express');
var morgan 			= require('morgan');
var bodyParser 		= require('body-parser');
var cookieParser 	= require('cookie-parser');
var session 		= require('express-session');
var cors 			= require('cors');
var httpStatus 		= require('http-status');

var logger 			= require('./config/logger');

var app 	= express();
var port 	= Number(process.env.PORT || 8080);

logger.debug("Overriding Express logger");

app.use(bodyParser.json({limit: '5mb'}));
app.use(bodyParser.urlencoded({ limit: '5mb', extended: true }));
app.use(cookieParser());
app.use(cors());
app.use(morgan('combined',{
	stream: {
		write: function(message, encoding){
			logger.info(message);
		}
	}
}));

app.use('/api',require('./routes'));
app.use('*', function(req, res){
	res.sendStatus(httpStatus[404]).end();
})

app.listen(port, function() {
	logger.info("Listening on port " + port);
});
