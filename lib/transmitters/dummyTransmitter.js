
var DummyTransmitter = function() {

}

DummyTransmitter.prototype.sendFile = function(file,callback) {
  console.log('Sending: ' + file.path);
  callback();
}

module.exports = DummyTransmitter;
