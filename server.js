var express = require('express');
var morgan = require('morgan');

var logger 	= require('./config/logger');

var app = express();
var port = Number(process.env.PORT || 3000);

logger.debug("Overriding Express logger");
app.use(morgan('combined',{
	stream: function(message,encoding){
		logger.info(message);
	}
}));

app.listen(port, function() {
	logger.info("Listening on port " + port);
});
