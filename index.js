'use strict'
/*
 * Google drive storage for ghost blog
 * @author : Robin C Samuel <hi@robinz.in> http://robinz.in
 * @date : 11th August 2015
 */
var Promise     =   require('bluebird'),
fs          =   require('fs'),
googleapis  =   require('googleapis');

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
        resolve('/content/images/'+data.id);
      });
    });
  }); 
};

ghostGoogleDrive.prototype.serve = function(){
  var _this = this;
  return function (req, res, next) {
    var id = req.path.replace('/','');

    var key = _this.config.key
    var jwtClient = new googleapis.auth.JWT(key.client_email, null, key.private_key, ['https://www.googleapis.com/auth/drive'], null);

    jwtClient.authorize(function(err, tokens) {
      if (err) {
        console.log(err);
        next()
      }
      var drive = googleapis.drive({ version: 'v2', auth: jwtClient });
      drive.files.get({fileId:id}, function(err, file){
        if(!err) {
          res.redirect(file.downloadUrl+'&access_token='+tokens.access_token);
        } else {
          next()
        }

      });
    });
  };
};


module.exports = ghostGoogleDrive