/**
 * Copyright (c) 2011 Andreas Madsen
 * GPL License Version 3
 */

var fs = require('fs');
var util = require('util');
var events = require('events');

function Equilibrium(filepath) {
	this.fd = null;
	this.state = null;

  this.updated = false;
  this.draining = false;
	this.filepath = filepath;
}
util.inherits(Equilibrium, events.EventEmitter);
module.exports = function (filepath) { return new Equilibrium(filepath); };

// add query and begin draining
Equilibrium.prototype.write = function (state) {
	// add content to query
	this.state = state;
  this.updated = true;

	// begin draining if a file descriptor exist
	this.drain();
};

// execute query
Equilibrium.prototype.drain = function () {
  if (this.updated === false) return;
	if (this.state === null) return;
  if (this.fd === null) return;
  if (this.draining) return;

  // don't allow simutainiously writes
	this.draining = true;

	var self = this;
	update(this, function handle(error) {
    if (error) self.emit('error', error);

    // we are done draining
    if (self.updated === false) {
      self.drainging = false;
      return self.emit('drain');
    }

		// handle next query item
		update(self, handle);
	});
};

// update file
function update(self, callback) {
	var buffer = new Buffer(self.state);
  self.updated = false;

	fs.truncate(self.fd, 0, function (error) {
    if (error) return callback(error);

		fs.write(self.fd, buffer, 0, buffer.length, 0, function (error) {
      callback(error || null);
		});
	});
}

// open up file file descriptor
Equilibrium.prototype.open = function () {
	var self = this;

  // Ignore if the file is already opened
	if (this.fd) return;

	fs.open(this.filepath, 'w', function (error, fd) {
    if (error) return self.emit('error', error);

    // save fd
		self.fd = fd;
    self.emit('open', fd);
	});
};

// close file descriptor
Equilibrium.prototype.close = function () {
	var self = this;

  // ignore closed fd
  if (this.fd === null) return;

  fs.close(this.fd, function (error) {
    if (error) return self.emit('error', error);

    // reset fd
    self.fd = null;
    self.emit('close');
	});
};

// remove file descriptor
Equilibrium.prototype.remove = function (callback) {
	var self = this;

	// just remove file if channel is closed
	if (self.fd === null) {
		fs.unlink(self.filepath, callback);
    self.emit('removed');
		return;
	}

	this.close(function () {
		fs.unlink(self.filepath, callback);
    self.emit('removed');
	});
};
