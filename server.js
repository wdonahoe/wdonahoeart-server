var express 		= require('express');
var morgan 			= require('morgan');
var bodyParser 		= require('body-parser');
var cookieParser 	= require('cookie-parser');
var session 		= require('express-session');
var cors 			= require('cors');
var httpStatus 		= require('http-status-codes');

var logger 			= require('./config/logger');

var app 	= express();
var port 	= Number(process.env.PORT || 8080);

logger.debug("Overriding Express logger");

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
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
	res.sendStatus(httpStatus.NOT_FOUND).end();
})

app.listen(port, function() {
	logger.info("Listening on port " + port);
});
