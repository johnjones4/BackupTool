
var DummyTransmitter = function() {

}

DummyTransmitter.prototype.sendFile = function(file,callback) {
  console.log('Sending: ' + file);
  callback();
}

module.exports = DummyTransmitter;
