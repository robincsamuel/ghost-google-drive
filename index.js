"use strict";
 /*
  * Google drive storage for ghost blog
  * @author : Robin C Samuel <hi@robinz.in> http://robinz.in
  * @updated : 10th April 2022
  * 
*/

const StorageBase = require("ghost-storage-base");
const fs = require("fs");
const { google } = require("googleapis");
const drive = google.drive("v3");

var auth = config => {
  var jwtClient = new google.auth.JWT(
    config.key.client_email,
    null,
    config.key.private_key,
    ['https://www.googleapis.com/auth/drive'],
    null
  );

  return new Promise((resolve, reject) => {
    jwtClient.authorize(err => {
      if (err) {
        reject(err);
      }

      resolve(jwtClient);
    });
  });
}

var upload = (client, file) => {
  return new Promise((resolve, reject) => {
    drive.files.create({
      auth: client,
      resource: {
        name: file.name,
        parents: []
      },
      media: {
        mimeType: file.type,
        body: fs.createReadStream(file.path)
      },
      fields: 'id, fileExtension'
    }, (err, uploadedFile) => {
      if (err) {
        reject(err);
      }

      // Promise is resolved with the result of create call
      resolve(uploadedFile);
    });
  });
}

var get = (client, fileId, callback) => {
  drive.files.get({
    auth: client,
    fileId: fileId,
    alt: 'media'
  }, (error, response) => {
    callback(error, response);
  });
}

var remove = (client, file) => {
  return new Promise(function (resolve, reject) {
    drive.files.delete({
      auth: client,
      fileId: file
    },
    function (err, data) {
      if (err) {
        console.log(err);
        return reject(err);
      }
      resolve();
    });
  });
}

class ghostGoogleDrive extends StorageBase {
  constructor(config) {
    super();
    this.config = config;
  }

  /**
   * Saves the image to storage (the file system)
   * - image is the express image object
   * - returns a promise which ultimately returns the full url to the uploaded image
   *
   * @param image
   * @param targetDir
   * @returns {*}
   */
  save(file, targetDir) {
    return new Promise((resolve, reject) => {
      auth(this.config)
        .then(client => {
          upload(client, file)
            .then(data => {
              resolve('/content/images/' + data.id + '.' + data.fileExtension);
            });
        });
    });
  }

  /**
   * checks for existance of file (handle 404's proper)
   * @param {*} fileName 
   * @param {*} targetDir 
   * @returns Promise.<*>
   */
  exists(fileName, targetDir) {
    return new Promise((resolve, reject) => {
      auth(this.config)
        .then(client => {
          get(client, fileName, (error, response) => {
            if (error) {
              console.error(fileName, " not found");
              resolve(false);
            }

            resolve(true);
          })
        });
    });
  }

  /**
   * TODO: implement 404 functionality
   * @returns {serveStaticContent}
   */
  serve() {
    let _this = this;
    return function serveContent(req, res, next) {
      // get the file id from url
      var fileId = req.path.replace('/', '').split('.')[0];
      _this.exists(fileId).then(() => {
        auth(_this.config).then(client => {
          drive.files.get({ auth: client, fileId: fileId, alt: "media" }, { responseType: "stream" },
            function (err, resp) {
              if (err) {
                console.error(err);
              }
              resp.data.on("end", () => {
                console.log("Done");
              }).on("error", err => {
                console.log("Error", err);
              })
              .pipe(res);
          });
        });
      });
    }
  }

  /**
   * @returns {Promise.<*>}
   */
  delete() {
    return function deleteContent(req, res, next) {
      var fileId = req.path.replace('/', '').split('.')[0];
      auth(this.config)
        .then(client => {
          remove(client, fileId)
        });
    };
  }

  /**
   * Reads bytes from disk for a target image
   * - path of target image (without content path!)
   *
   * @param options
   */
  read(options) {
    var fileId = options.path.replace('/', '').split('.')[0];
    console.log(fileId,options);
    return new Promise((resolve, reject) => {
      auth(this.config)
        .then(client => {
          get(client, fileId, (error, response) => {
            if (error) {
              reject(error);
            }

            resolve(response);
          });
        });
    });
  }
}

module.exports = ghostGoogleDrive;
