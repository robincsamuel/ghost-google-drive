'use strict'

var Promise 	=	require('bluebird'),
	fs 			=	require('fs'),
	googleapis	=	require('googleapis');

function ghostGoogleDrive(config){
	this.config = config || {};
};

ghostGoogleDrive.prototype.save = function(file){
	var _this = this;
	return new Promise(function (resolve, reject) {
		var key = _this.config.key
		var jwtClient = new googleapis.auth.JWT(key.client_email, null, key.private_key, ['https://www.googleapis.com/auth/drive'], null);

		jwtClient.authorize(function(err, tokens) {
		  if (err) {
		    console.log(err);
		    reject(err)
		    return;
		  }

		  var drive = googleapis.drive({ version: 'v2', auth: jwtClient });
			drive.files.insert({
			  resource: {
			    title: file.name,
			    mimeType: file.type
			  },
			  media: {
			    mimeType: file.type,
			    body: fs.createReadStream(file.path)
			  }
			}, function(err,data){
				if(err){
					console.log(err)
					reject(err)
					return;
				}
				resolve(data.thumbnailLink)
			});
		});
	});	
};

ghostGoogleDrive.prototype.serve = function(){
	return function (req, res, next) {
		next()
    };
};


module.exports = ghostGoogleDrive