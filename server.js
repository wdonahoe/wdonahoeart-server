var express 		= require('express');
var morgan 			= require('morgan');
var bodyParser 		= require('body-parser');
var cookieParser 	= require('cookie-parser');
var session 		= require('express-session');
var logger 			= require('./config/logger');

var app 	= express();
var port 	= Number(process.env.PORT || 3000);

logger.debug("Overriding Express logger");

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({ secret: "nicoleisawesome", resave: true, saveUninitialized: true }));
app.use(morgan('combined',{
	stream: {
		write: function(message, encoding){
			logger.info(message);
		}
	}
}));

app.use('/api',require('./routes'));

app.listen(port, function() {
	logger.info("Listening on port " + port);
});
