"use strict";
/*
 * Google drive storage for ghost blog
 * @author : Robin C Samuel <hi@robinz.in> http://robinz.in
 * @date : 11th August 2015
 * @updated: 05th Aug 2017
 */

const StorageBase = require("ghost-storage-base");
const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");
const https = require("https");

const API_VERSION = "v2";
const API_SCOPES = ["https://www.googleapis.com/auth/drive"];

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
    const _this = this;
    return new Promise(function(resolve, reject) {
      const key = _this.config.key;
      const jwtClient = new google.auth.JWT(
        key.client_email,
        null,
        key.private_key,
        API_SCOPES,
        null
      );

      jwtClient.authorize(function(err, tokens) {
        if (err) {
          console.log(err);
          reject(err);
          return;
        }

        const drive = google.drive({
          version: API_VERSION,
          auth: jwtClient
        });
        drive.files.insert(
          {
            resource: {
              title: file.name,
              mimeType: file.type
            },
            media: {
              mimeType: file.type,
              body: fs.createReadStream(file.path)
            }
          },
          function(err, res) {
            if (err) {
              console.log(err);
              reject(err);
              return;
            }
            const { data } = res;
            // make the url looks like a file
            resolve("/content/images/" + data.id + "." + data.fileExtension);
          }
        );
      });
    });
  }

  exists(fileName, targetDir) {
    return true;
  }

  /**
   * For some reason send divides the max age number by 1000
   * Fallthrough: false ensures that if an image isn't found, it automatically 404s
   * Wrap server static errors
   *
   * @returns {serveStaticContent}
   */
  serve() {
    const _this = this;
    return function serveStaticContent(req, res, next) {
      // get the file id from url
      const id = req.path.replace("/", "").split(".")[0];

      const key = _this.config.key;
      const jwtClient = new google.auth.JWT(
        key.client_email,
        null,
        key.private_key,
        API_SCOPES,
        null
      );
      //auth
      jwtClient.authorize(function(err, tokens) {
        if (err) {
          console.log(err);
          return next();
        }
        const drive = google.drive({
          version: API_VERSION,
          auth: jwtClient
        });
        drive.files.get(
          {
            fileId: id
          },
          function(err, response) {
            if (!err) {
              const file = response.data;
              const newReq = https
                .request(
                  file.downloadUrl + "&access_token=" + tokens.access_token,
                  function(newRes) {
                    // Modify google headers here to cache!
                    const headers = newRes.headers;
                    headers["content-disposition"] =
                      "attachment; filename=" + file.originalFilename;
                    headers["cache-control"] = "public, max-age=1209600";
                    delete headers["expires"];

                    res.writeHead(newRes.statusCode, headers);
                    // pipe the file
                    newRes.pipe(res);
                  }
                )
                .on("error", function(err) {
                  console.log(err);
                  res.statusCode = 500;
                  res.end();
                });
              req.pipe(newReq);
            } else {
              next();
            }
          }
        );
      });
      //return next(new errors.GhostError({err: err}));
    };
  }

  /**
   * Not implemented.
   * @returns {Promise.<*>}
   */
  delete() {
    const _this = this;
    return new Promise(function(resolve, reject) {
      const key = _this.config.key;
      const jwtClient = new google.auth.JWT(
        key.client_email,
        null,
        key.private_key,
        API_SCOPES,
        null
      );

      jwtClient.authorize(function(err, tokens) {
        if (err) {
          console.log(err);
          reject(err);
          return;
        }
        const drive = google.drive({
          version: API_VERSION,
          auth: jwtClient
        });
        drive.files.delete(
          {
            fileId: id
          },
          function(err, data) {
            if (err) {
              console.log(err);
              reject(err);
              return;
            }
            resolve();
          }
        );
      });
    });
  }

  /**
   * Reads bytes from disk for a target image
   * - path of target image (without content path!)
   *
   * @param options
   */
  read(options) {
    options = options || {};

    // remove trailing slashes
    options.path = (options.path || "").replace(/\/$|\\$/, "");

    const targetPath = path.join(this.storagePath, options.path);

    return new Promise(function(resolve, reject) {
      fs.readFile(targetPath, function(err, bytes) {
        if (err) {
          return reject(
            new errors.GhostError({
              err: err,
              message: "Could not read image: " + targetPath
            })
          );
        }
        resolve(bytes);
      });
    });
  }
}

module.exports = ghostGoogleDrive;
