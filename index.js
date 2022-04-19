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
        mimeType: file.type
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

var setPermissions = (client, data) => {
  return new Promise((resolve, reject) => {
    drive.permissions.create({
      auth: client,
      fileId: data.id,
      supportsAllDrives: true,
      supportsTeamDrives: true,
      resource: {
        'type': 'anyone',
        'role': 'reader',
      },
      fields: 'id',
    }, function (err, res) {
      if (err) {
        console.error(err);
        reject(err);
      }
      resolve(res);
    });
  });
}

var get = (client, fileId, callback) => {
  drive.files.get({
    auth: client,
    fileId: fileId,
    alt: 'media'
  }, { responseType: "stream" },
    function (error, response) {
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
        console.error(err);
        reject(err);
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
            .then(resp => {
              setPermissions(client, resp.data)
                .then(res => {
                  resolve('/content/images/' + resp.data.id + '.' + resp.data.fileExtension);
              });
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
    const _this = this;
    return function serveContent(req, res, next) {
      // get the file id from url
      var fileId = req.path.replace('/', '').split('.')[0];
      auth(_this.config).then(client => {
        get(client, fileId, (err, resp) => {
            if (err) {
              console.error("fileId: " + fileId, "err: " + err);
              return next();
            }
            resp.data.pipe(res);
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
