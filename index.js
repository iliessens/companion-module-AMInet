var instance_skel = require('../../instance_skel');
var dgram = require('dgram');
var debug;
var log;

function instance(system, id, config) {
	var self = this;

	// super-constructor
	instance_skel.apply(this, arguments);

	self.actions(); // export actions

	return self;
}

instance.prototype.updateConfig = function(config) {
	var self = this;
	self.config = config;
};
instance.prototype.init = function() {
	var self = this;

	self.status(self.STATUS_OK);

	debug = self.debug;
	log   = self.log;
};

// Return config fields for web config
instance.prototype.config_fields = function () {
	var self = this;
	return [
		{
			type:  'text',
			id:    'info',
			width: 12,
			label: 'Information',
			value: 'This module implements the AMInet protocol for control of media servers.'
		},
		{
			type:  'textinput',
			id:    'host',
			label: 'Target IP',
			width: 8,
			regex: self.REGEX_IP
		}
	]
};

// When module gets deleted
instance.prototype.destroy = function() {
	var self = this;
	debug("destroy");
};

instance.prototype.actions = function(system) {
	var self = this;
	self.system.emit('instance_actions', self.id, {

		'predefinedCmd':    {
			label: 'Choose Commands',
			options: [
					{
						type:    'dropdown',
						label:   'Choose Command',
						id:      'command',
						width:   12,
						default: 'PL',
						choices:	[
							{ id: 'PL',		label: 'Start Playing' },
							{ id: 'RJ',		label: 'Stop Playing' },
						]
					},
					{
						type:    'textinput',
						label:   'Choose Channel',
						id:      'channel',
						width:   6,
						default: '1',
						regex: self.REGEX_NUMBER
					},
			]
		}
	});
};

instance.prototype.calculateChecksum = function(msgBuffer) {
	var sumValue = 0;

	//Note: first byte is skipped
	for(i = 1; i < msgBuffer.length; i++) {
		sumValue += msgBuffer.readUInt8(i);
	}
	console.log("Checksum val", sumValue);

	if(sumValue >= 65536) {
		// 4 byte checksum
		var checksum = Buffer.alloc(4);
		checksum.writeUInt8(0xFE);
		checksum.writeUIntBE(sumValue,1,3);
		return checksum;
	}
	else if(sumValue >= 250) {
		// 3 byte checksum
		var checksum = Buffer.alloc(3);
		checksum.writeUInt8(0xFF);
		checksum.writeUInt16BE(sumValue,1);
		return checksum;
	}
	else {
		// 2 byte checksum 
		var checksum = Buffer.alloc(1);
		checksum.writeUInt8(sumValue);
		return checksum;
	}
}

instance.prototype.sendCommand = function(cmd) {
	self = this;

	//Fixed preamble
	var preamble = Buffer.from([0xF1,0x01, 0x04]);
	var message = Buffer.concat([preamble, Buffer.from(cmd)]);

	var checksum = self.calculateChecksum(message);
	var trailer = Buffer.from([0xF2]);

	message = Buffer.concat([message, checksum, trailer]);

	console.log(message);

	var client = dgram.createSocket('udp4');
	client.send(message, 0, message.length, 2639, self.config.host, function(err, bytes) {
		if (err) {
			self.status(self.STATUS_ERROR);
			self.log(err);
		}
		else {
			console.log('UDP message sent OK');
			client.close();
			self.status(self.STATUS_OK);
		}
	  });
};

instance.prototype.action = function(action) {
	var self = this;
	var cmd  = '';
	var opt  = action.options;
	debug('action: ', action);

	switch (action.action) {
		case 'predefinedCmd':
			cmd += action.options.channel + action.options.command;
			break;
	}

	//add line break
	cmd += '\r';

	if (cmd !== undefined) {
		self.sendCommand(cmd);
	}
};

instance_skel.extendedBy(instance);
exports = module.exports = instance;