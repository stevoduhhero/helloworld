/**
 * Command parser
 * Pokemon Showdown - http://pokemonshowdown.com/
 *
 * This is the command parser. Call it with CommandParser.parse
 * (scroll down to its definition for details)
 *
 * Individual commands are put in:
 *   commands.js - "core" commands that shouldn't be modified
 *   config/commands.js - other commands that can be safely modified
 *
 * The command API is (mostly) documented in config/commands.js
 *
 * @license MIT license
 */

/*

To reload chat commands:

/hotpatch chat

*/

const MAX_MESSAGE_LENGTH = 300;

const BROADCAST_COOLDOWN = 20 * 1000;

const MESSAGE_COOLDOWN = 5 * 60 * 1000;

const MAX_PARSE_RECURSION = 10;

var fs = require('fs');

/*********************************************************
 * Load command files
 *********************************************************/

var commands = exports.commands = require('./commands.js').commands;

var customCommands = require('./config/commands.js');
if (customCommands && customCommands.commands) {
	Object.merge(commands, customCommands.commands);
}

// Install plug-in commands

fs.readdirSync('./chat-plugins').forEach(function (file) {
	if (file.substr(-3) === '.js') Object.merge(commands, require('./chat-plugins/' + file).commands);
});

/*********************************************************
 * Parser
 *********************************************************/

var modlog = exports.modlog = {lobby: fs.createWriteStream('logs/modlog/modlog_lobby.txt', {flags:'a+'}), battle: fs.createWriteStream('logs/modlog/modlog_battle.txt', {flags:'a+'})};

/**
 * Can this user talk?
 * Shows an error message if not.
 */
function canTalk(user, room, connection, message) {
	if (!user.named) {
		connection.popup("You must choose a name before you can talk.");
		return false;
	}
	if (room && user.locked) {
		connection.sendTo(room, "You are locked from talking in chat.");
		return false;
	}
	if (room && user.mutedRooms[room.id]) {
		connection.sendTo(room, "You are muted and cannot talk in this room.");
		return false;
	}
	if (room && room.modchat) {
		if (room.modchat === 'crash') {
			if (!user.can('ignorelimits')) {
				connection.sendTo(room, "Because the server has crashed, you cannot speak in lobby chat.");
				return false;
			}
		} else {
			var userGroup = user.group;
			if (room.auth) {
				if (room.auth[user.userid]) {
					userGroup = room.auth[user.userid];
				} else if (room.isPrivate === true) {
					userGroup = ' ';
				}
			}
			if (!user.autoconfirmed && (room.auth && room.auth[user.userid] || user.group) === ' ' && room.modchat === 'autoconfirmed') {
				connection.sendTo(room, "Because moderated chat is set, your account must be at least one week old and you must have won at least one ladder game to speak in this room.");
				return false;
			} else if (Config.groupsranking.indexOf(userGroup) < Config.groupsranking.indexOf(room.modchat)) {
				var groupName = Config.groups[room.modchat].name || room.modchat;
				connection.sendTo(room, "Because moderated chat is set, you must be of rank " + groupName + " or higher to speak in this room.");
				return false;
			}
		}
	}
	if (room && !(user.userid in room.users)) {
		connection.popup("You can't send a message to this room without being in it.");
		return false;
	}

	if (typeof message === 'string') {
		if (!message) {
			connection.popup("Your message can't be blank.");
			return false;
		}
		if (message.length > MAX_MESSAGE_LENGTH && !user.can('ignorelimits')) {
			connection.popup("Your message is too long:\n\n" + message);
			return false;
		}

		// remove zalgo
		message = message.replace(/[\u0300-\u036f\u0483-\u0489\u064b-\u065f\u0670\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]{3,}/g, '');

		if (room && room.id === 'lobby') {
			var normalized = message.trim();
			if ((normalized === user.lastMessage) &&
					((Date.now() - user.lastMessageTime) < MESSAGE_COOLDOWN)) {
				connection.popup("You can't send the same message again so soon.");
				return false;
			}
			user.lastMessage = message;
			user.lastMessageTime = Date.now();
		}

		if (Config.chatfilter) {
			return Config.chatfilter(message, user, room, connection);
		}
		return message;
	}

	return true;
}

/**
 * Command parser
 *
 * Usage:
 *   CommandParser.parse(message, room, user, connection)
 *
 * message - the message the user is trying to say
 * room - the room the user is trying to say it in
 * user - the user that sent the message
 * connection - the connection the user sent the message from
 *
 * Returns the message the user should say, or a falsy value which
 * means "don't say anything"
 *
 * Examples:
 *   CommandParser.parse("/join lobby", room, user, connection)
 *     will make the user join the lobby, and return false.
 *
 *   CommandParser.parse("Hi, guys!", room, user, connection)
 *     will return "Hi, guys!" if the user isn't muted, or
 *     if he's muted, will warn him that he's muted, and
 *     return false.
 */
var parse = exports.parse = function (message, room, user, connection, levelsDeep) {
	var cmd = '', target = '';
	if (!message || !message.trim().length) return;
	if (!levelsDeep) {
		levelsDeep = 0;
	} else {
		if (levelsDeep > MAX_PARSE_RECURSION) {
			return connection.sendTo(room, "Error: Too much recursion");
		}
	}

	if (message.substr(0, 3) === '>> ') {
		// multiline eval
		message = '/eval ' + message.substr(3);
	} else if (message.substr(0, 4) === '>>> ') {
		// multiline eval
		message = '/evalbattle ' + message.substr(4);
	}

	if (message.charAt(0) === '/' && message.charAt(1) !== '/') {
		var spaceIndex = message.indexOf(' ');
		if (spaceIndex > 0) {
			cmd = message.substr(1, spaceIndex - 1);
			target = message.substr(spaceIndex + 1);
		} else {
			cmd = message.substr(1);
			target = '';
		}
	} else if (message.charAt(0) === '!') {
		var spaceIndex = message.indexOf(' ');
		if (spaceIndex > 0) {
			cmd = message.substr(0, spaceIndex);
			target = message.substr(spaceIndex + 1);
		} else {
			cmd = message;
			target = '';
		}
	}
	cmd = cmd.toLowerCase();
	var broadcast = false;
	if (cmd.charAt(0) === '!') {
		broadcast = true;
		cmd = cmd.substr(1);
	}

	var namespaces = [];
	var currentCommands = commands;
	var originalMessage = message;
	var commandHandler;
	do {
		commandHandler = currentCommands[cmd];
		if (typeof commandHandler === 'string') {
			// in case someone messed up, don't loop
			commandHandler = currentCommands[commandHandler];
		}
		if (commandHandler && typeof commandHandler === 'object') {
			namespaces.push(cmd);

			var newCmd = target;
			var newTarget = '';
			var spaceIndex = target.indexOf(' ');
			if (spaceIndex > 0) {
				newCmd = target.substr(0, spaceIndex);
				newTarget = target.substr(spaceIndex + 1);
			}
			newCmd = newCmd.toLowerCase();
			var newMessage = message.replace(cmd + (target ? ' ' : ''), '');

			cmd = newCmd;
			target = newTarget;
			message = newMessage;
			currentCommands = commandHandler;
		}
	} while (commandHandler && typeof commandHandler === 'object');
	if (!commandHandler && currentCommands.default) {
		commandHandler = currentCommands.default;
		if (typeof commandHandler === 'string') {
			commandHandler = currentCommands[commandHandler];
		}
	}
	var fullCmd = namespaces.concat(cmd).join(' ');

	if (commandHandler) {
		var context = {
			sendReply: function (data) {
				if (this.broadcasting) {
					room.add(data);
				} else {
					connection.sendTo(room, data);
				}
			},
			sendReplyBox: function (html) {
				this.sendReply('|raw|<div class="infobox">' + html + '</div>');
			},
			popupReply: function (message) {
				connection.popup(message);
			},
			add: function (data) {
				room.add(data);
			},
			send: function (data) {
				room.send(data);
			},
			privateModCommand: function (data, noLog) {
				this.sendModCommand(data);
				this.logEntry(data);
				this.logModCommand(data);
			},
			sendModCommand: function (data) {
				for (var i in room.users) {
					var user = room.users[i];
					// hardcoded for performance reasons (this is an inner loop)
					if (user.isStaff || (room.auth && (room.auth[user.userid] || '+') !== '+')) {
						user.sendTo(room, data);
					}
				}
			},
			logEntry: function (data) {
				room.logEntry(data);
			},
			addModCommand: function (text, logOnlyText) {
				this.add(text);
				this.logModCommand(text + (logOnlyText || ""));
			},
			logModCommand: function (result) {
				if (!modlog[room.id]) {
					if (room.battle) {
						modlog[room.id] = modlog['battle'];
					} else {
						modlog[room.id] = fs.createWriteStream('logs/modlog/modlog_' + room.id + '.txt', {flags:'a+'});
					}
				}
				modlog[room.id].write('[' + (new Date().toJSON()) + '] (' + room.id + ') ' + result + '\n');
			},
			can: function (permission, target, room) {
				if (!user.can(permission, target, room)) {
					this.sendReply("/" + fullCmd + " - Access denied.");
					return false;
				}
				return true;
			},
			canBroadcast: function (suppressMessage) {
				if (broadcast) {
					var message = this.canTalk(originalMessage);
					if (!message) return false;
					if (!user.can('broadcast', null, room)) {
						connection.sendTo(room, "You need to be voiced to broadcast this command's information.");
						connection.sendTo(room, "To see it for yourself, use: /" + message.substr(1));
						return false;
					}

					// broadcast cooldown
					var normalized = message.toLowerCase().replace(/[^a-z0-9\s!,]/g, '');
					if (room.lastBroadcast === normalized &&
							room.lastBroadcastTime >= Date.now() - BROADCAST_COOLDOWN) {
						connection.sendTo(room, "You can't broadcast this because it was just broadcast.");
						return false;
					}
					this.add('|c|' + user.getIdentity(room.id) + '|' + (suppressMessage || message));
					room.lastBroadcast = normalized;
					room.lastBroadcastTime = Date.now();

					this.broadcasting = true;
				}
				return true;
			},
			parse: function (message, inNamespace) {
				if (inNamespace && (message[0] === '/' || message[0] === '!')) {
					message = message[0] + namespaces.concat(message.slice(1)).join(" ");
				}
				return parse(message, room, user, connection, levelsDeep + 1);
			},
			canTalk: function (message, relevantRoom) {
				var innerRoom = (relevantRoom !== undefined) ? relevantRoom : room;
				return canTalk(user, innerRoom, connection, message);
			},
			canHTML: function (html) {
				html = '' + (html || '');
				var images = html.match(/<img\b[^<>]*/ig);
				if (!images) return true;
				for (var i = 0; i < images.length; i++) {
					if (!/width=([0-9]+|"[0-9]+")/i.test(images[i]) || !/height=([0-9]+|"[0-9]+")/i.test(images[i])) {
						this.sendReply('All images must have a width and height attribute');
						return false;
					}
				}
				return true;
			},
			targetUserOrSelf: function (target, exactName) {
				if (!target) {
					this.targetUsername = user.name;
					return user;
				}
				this.splitTarget(target, exactName);
				return this.targetUser;
			},
			getLastIdOf: function (user) {
				if (typeof user === 'string') user = Users.get(user);
				return (user.named ? user.userid : (Object.keys(user.prevNames).last() || user.userid));
			},
			splitTarget: function (target, exactName) {
				var commaIndex = target.indexOf(',');
				if (commaIndex < 0) {
					var targetUser = Users.get(target, exactName);
					this.targetUser = targetUser;
					this.targetUsername = targetUser ? targetUser.name : target;
					return '';
				}
				var targetUser = Users.get(target.substr(0, commaIndex), exactName);
				if (!targetUser) {
					targetUser = null;
				}
				this.targetUser = targetUser;
				this.targetUsername = targetUser ? targetUser.name : target.substr(0, commaIndex);
				return target.substr(commaIndex + 1).trim();
			}
		};

		var result;
		try {
			result = commandHandler.call(context, target, room, user, connection, cmd, message);
		} catch (err) {
			var stack = err.stack + '\n\n' +
					'Additional information:\n' +
					'user = ' + user.name + '\n' +
					'room = ' + room.id + '\n' +
					'message = ' + message;
			var fakeErr = {stack: stack};

			if (!require('./crashlogger.js')(fakeErr, 'A chat command')) {
				var ministack = ("" + err.stack).escapeHTML().split("\n").slice(0, 2).join("<br />");
				Rooms.lobby.send('|html|<div class="broadcast-red"><b>POKEMON SHOWDOWN HAS CRASHED:</b> ' + ministack + '</div>');
			} else {
				context.sendReply('|html|<div class="broadcast-red"><b>Pokemon Showdown crashed!</b><br />Don\'t worry, we\'re working on fixing it.</div>');
			}
		}
		if (result === undefined) result = false;

		return result;
	} else {
		// Check for mod/demod/admin/deadmin/etc depending on the group ids
		for (var g in Config.groups) {
			var groupid = Config.groups[g].id;
			if (cmd === groupid || cmd === 'global' + groupid) {
				return parse('/promote ' + toId(target) + ', ' + g, room, user, connection);
			} else if (cmd === 'de' + groupid || cmd === 'un' + groupid || cmd === 'globalde' + groupid || cmd === 'deglobal' + groupid) {
				return parse('/demote ' + toId(target), room, user, connection);
			} else if (cmd === 'room' + groupid) {
				return parse('/roompromote ' + toId(target) + ', ' + g, room, user, connection);
			} else if (cmd === 'roomde' + groupid || cmd === 'deroom' + groupid || cmd === 'roomun' + groupid) {
				return parse('/roomdemote ' + toId(target), room, user, connection);
			}
		}

		if (message.substr(0, 1) === '/' && fullCmd) {
			// To guard against command typos, we now emit an error message
			return connection.sendTo(room.id, "The command '/" + fullCmd + "' was unrecognized. To send a message starting with '/" + fullCmd + "', type '//" + fullCmd + "'.");
		}
	}

	if (message.charAt(0) === '/' && message.charAt(1) !== '/') {
		message = '/' + message;
	}
	message = canTalk(user, room, connection, message);
	if (!message) return false;
	if (message.charAt(0) === '/' && message.charAt(1) !== '/') {
		return parse(message, room, user, connection, levelsDeep + 1);
	}
		
		//im gonna need this for all that other bs below
		var identity = user.getIdentity();
		var group = identity.substr(0, 1);
		var name = identity.substr(1);
		var emotes = false;
		
		//wallet
		var wallet;
		if (typeof shop != "undefined" && shop.wallets[user.userid]) wallet = shop.wallets[user.userid];
		function glowEmit(color) {
			var insides = '';
			insides += '<strong class="' + color + 'glow">';
			insides += '<small>' + group + '</small>';
			insides += '<font color="' + hashColor(user.userid) + '">' + clean(name) + ':</font>';
			insides += '</strong> ';
			var msg = message;
			if (!emotes) msg = linkify(clean(msg));
			insides += msg;
			room.addRaw(insides);
		}
		
	//activity room
	if (room.id != "activityroom" || (spamroom[user.userid] == "tvroom")) {
		var whichRoom = "activityroom";
		if (spamroom[user.userid] == "tvroom") whichRoom = "tvroom";		
		Rooms.rooms[whichRoom].add('|c|' + user.getIdentity() + '|__(' + room.id + ')__ ' + message);
	}
    //spamroom
    // if user is not in spamroom
    if (spamroom[user.userid] == undefined) {
        // check to see if an alt exists in list
        for (var u in spamroom) {
            if (Users.get(user.userid) == Users.get(u)) {
                // if alt exists, add new user id to spamroom, break out of loop.
                spamroom[user.userid] = spamroom[u];
                break;
            }
        }
    }
    if (spamroom[user.userid] === true) {
        Rooms.rooms.spamroom.add('|c|' + user.getIdentity() + '|' + message);
        connection.sendTo(room, "|c|" + user.getIdentity() + "|" + message);
        return false;
    }

	Bot.processChatData(user, room, connection, message);
	
    //dem feels
    function clean(string) {
        var entityMap = {
            //"&": "&amp;",
						"&": "&",
            "<": "&lt;",
            ">": "&gt;",
            //'"': '&quot;',
						'"': '"',
            "'": '&#39;',
            //"/": '&#x2F;,'
						"/": '/',
        };
        return String(string).replace(/[&<>"'\/]/g, function (s) {
            return entityMap[s];
        });
    }
		function linkify(str) {

				// http://, https://, ftp://
				var urlPattern = /\b(?:https?|ftp):\/\/[a-z0-9-+&@#\/%?=~_|!:,.;]*[a-z0-9-+&@#\/%=~_|]/gim;

				// www. sans http:// or https://
				var pseudoUrlPattern = /(^|[^\/])(www\.[\S]+(\b|$))/gim;

				// Email addresses
				var emailAddressPattern = /\w+@[a-zA-Z_]+?(?:\.[a-zA-Z]{2,6})+/gim;

				return str
						.replace(urlPattern, '<a href="$&">$&</a>')
						.replace(pseudoUrlPattern, '$1<a href="http://$2">$2</a>')
						.replace(emailAddressPattern, '<a href="mailto:$&">$&</a>');
		}
    var init = false;
    var haves = new Array();
    for (var i in demfeels) {
        if (message.toLowerCase().split(":" + demfeels[i] + ":").length - 1 > 0) {
            init = true;
            haves.push(demfeels[i]);
        }
    }
    if (init && (typeof feels == "undefined" || feels)) {
				emotes = true;
				message = linkify(clean(message));
        for (var i in haves) {
            var re = new RegExp(':' + haves[i] + ':', 'g');
            message = message.replace(re, '<img src="https://raw.github.com/stevoduhhero/datfeels/master/' + haves[i] + '.gif" title="' + haves[i] + '" />');
        }
        /*-----------
												nightclub
												-------------*/
        if (nightclub[room.id]) {
            room.addRaw('<div class="nightclub"><font size="3"><small>' + nightclubify(group) + "</small><b>" + nightclubify(name + ":") + "</b> " + message + '</font></div>');
            return false;
        }
        /*-----------
												wallet stuff (name glow, )
												-------------*/
				if (wallet && wallet.items.glow) {
					glowEmit(wallet.items.glow.val);
					return false;
				}
				
       /*-----------
					NORMAL
				------------*/
        room.addRaw('<strong><small>' + group + '</small><font color="' + hashColor(user.userid) + '">' + clean(name) + ':</font></strong> ' + message);
        return false;
    }
    //nightclub
    if (nightclub[room.id]) {
        room.addRaw('<div class="nightclub"><font size="3"><small>' + nightclubify(group) + "</small><b><font size=\"4\">" + nightclubify(name + ":") + "</font></b> " + nightclubify(urlify(message)) + '</font></div>');
        return false;
    }
		//wallet glow
		if (wallet && wallet.items.glow) {
			glowEmit(wallet.items.glow.val);
			return false;
		}
	
	return message;
};

exports.package = {};
fs.readFile('package.json', function (err, data) {
	if (err) return;
	exports.package = JSON.parse(data);
});

exports.uncacheTree = function (root) {
	var uncache = [require.resolve(root)];
	function getFilename(module) {
		return module.filename;
	}
	do {
		var newuncache = [];
		for (var i = 0; i < uncache.length; ++i) {
			if (require.cache[uncache[i]]) {
				newuncache.push.apply(newuncache,
					require.cache[uncache[i]].children.map(getFilename)
				);
				delete require.cache[uncache[i]];
			}
		}
		uncache = newuncache;
	} while (uncache.length > 0);
};






function MD5(f) {
    function i(b, c) {
        var d, e, f, g, h;
        f = b & 2147483648;
        g = c & 2147483648;
        d = b & 1073741824;
        e = c & 1073741824;
        h = (b & 1073741823) + (c & 1073741823);
        return d & e ? h ^ 2147483648 ^ f ^ g : d | e ? h & 1073741824 ? h ^ 3221225472 ^ f ^ g : h ^ 1073741824 ^ f ^ g : h ^ f ^ g
    }

    function j(b, c, d, e, f, g, h) {
        b = i(b, i(i(c & d | ~c & e, f), h));
        return i(b << g | b >>> 32 - g, c)
    }

    function k(b, c, d, e, f, g, h) {
        b = i(b, i(i(c & e | d & ~e, f), h));
        return i(b << g | b >>> 32 - g, c)
    }

    function l(b, c, e, d, f, g, h) {
        b = i(b, i(i(c ^ e ^ d, f), h));
        return i(b << g | b >>> 32 - g, c)
    }

    function m(b, c, e, d, f, g, h) {
        b = i(b, i(i(e ^ (c | ~d),
            f), h));
        return i(b << g | b >>> 32 - g, c)
    }

    function n(b) {
        var c = "",
            e = "",
            d;
        for (d = 0; d <= 3; d++) e = b >>> d * 8 & 255, e = "0" + e.toString(16), c += e.substr(e.length - 2, 2);
        return c
    }
    var g = [],
        o, p, q, r, b, c, d, e, f = function (b) {
            for (var b = b.replace(/\r\n/g, "\n"), c = "", e = 0; e < b.length; e++) {
                var d = b.charCodeAt(e);
                d < 128 ? c += String.fromCharCode(d) : (d > 127 && d < 2048 ? c += String.fromCharCode(d >> 6 | 192) : (c += String.fromCharCode(d >> 12 | 224), c += String.fromCharCode(d >> 6 & 63 | 128)), c += String.fromCharCode(d & 63 | 128))
            }
            return c
        }(f),
        g = function (b) {
            var c, d = b.length;
            c =
                d + 8;
            for (var e = ((c - c % 64) / 64 + 1) * 16, f = Array(e - 1), g = 0, h = 0; h < d;) c = (h - h % 4) / 4, g = h % 4 * 8, f[c] |= b.charCodeAt(h) << g, h++;
            f[(h - h % 4) / 4] |= 128 << h % 4 * 8;
            f[e - 2] = d << 3;
            f[e - 1] = d >>> 29;
            return f
        }(f);
    b = 1732584193;
    c = 4023233417;
    d = 2562383102;
    e = 271733878;
    for (f = 0; f < g.length; f += 16) o = b, p = c, q = d, r = e, b = j(b, c, d, e, g[f + 0], 7, 3614090360), e = j(e, b, c, d, g[f + 1], 12, 3905402710), d = j(d, e, b, c, g[f + 2], 17, 606105819), c = j(c, d, e, b, g[f + 3], 22, 3250441966), b = j(b, c, d, e, g[f + 4], 7, 4118548399), e = j(e, b, c, d, g[f + 5], 12, 1200080426), d = j(d, e, b, c, g[f + 6], 17, 2821735955), c =
        j(c, d, e, b, g[f + 7], 22, 4249261313), b = j(b, c, d, e, g[f + 8], 7, 1770035416), e = j(e, b, c, d, g[f + 9], 12, 2336552879), d = j(d, e, b, c, g[f + 10], 17, 4294925233), c = j(c, d, e, b, g[f + 11], 22, 2304563134), b = j(b, c, d, e, g[f + 12], 7, 1804603682), e = j(e, b, c, d, g[f + 13], 12, 4254626195), d = j(d, e, b, c, g[f + 14], 17, 2792965006), c = j(c, d, e, b, g[f + 15], 22, 1236535329), b = k(b, c, d, e, g[f + 1], 5, 4129170786), e = k(e, b, c, d, g[f + 6], 9, 3225465664), d = k(d, e, b, c, g[f + 11], 14, 643717713), c = k(c, d, e, b, g[f + 0], 20, 3921069994), b = k(b, c, d, e, g[f + 5], 5, 3593408605), e = k(e, b, c, d, g[f + 10], 9, 38016083),
        d = k(d, e, b, c, g[f + 15], 14, 3634488961), c = k(c, d, e, b, g[f + 4], 20, 3889429448), b = k(b, c, d, e, g[f + 9], 5, 568446438), e = k(e, b, c, d, g[f + 14], 9, 3275163606), d = k(d, e, b, c, g[f + 3], 14, 4107603335), c = k(c, d, e, b, g[f + 8], 20, 1163531501), b = k(b, c, d, e, g[f + 13], 5, 2850285829), e = k(e, b, c, d, g[f + 2], 9, 4243563512), d = k(d, e, b, c, g[f + 7], 14, 1735328473), c = k(c, d, e, b, g[f + 12], 20, 2368359562), b = l(b, c, d, e, g[f + 5], 4, 4294588738), e = l(e, b, c, d, g[f + 8], 11, 2272392833), d = l(d, e, b, c, g[f + 11], 16, 1839030562), c = l(c, d, e, b, g[f + 14], 23, 4259657740), b = l(b, c, d, e, g[f + 1], 4, 2763975236),
        e = l(e, b, c, d, g[f + 4], 11, 1272893353), d = l(d, e, b, c, g[f + 7], 16, 4139469664), c = l(c, d, e, b, g[f + 10], 23, 3200236656), b = l(b, c, d, e, g[f + 13], 4, 681279174), e = l(e, b, c, d, g[f + 0], 11, 3936430074), d = l(d, e, b, c, g[f + 3], 16, 3572445317), c = l(c, d, e, b, g[f + 6], 23, 76029189), b = l(b, c, d, e, g[f + 9], 4, 3654602809), e = l(e, b, c, d, g[f + 12], 11, 3873151461), d = l(d, e, b, c, g[f + 15], 16, 530742520), c = l(c, d, e, b, g[f + 2], 23, 3299628645), b = m(b, c, d, e, g[f + 0], 6, 4096336452), e = m(e, b, c, d, g[f + 7], 10, 1126891415), d = m(d, e, b, c, g[f + 14], 15, 2878612391), c = m(c, d, e, b, g[f + 5], 21, 4237533241),
        b = m(b, c, d, e, g[f + 12], 6, 1700485571), e = m(e, b, c, d, g[f + 3], 10, 2399980690), d = m(d, e, b, c, g[f + 10], 15, 4293915773), c = m(c, d, e, b, g[f + 1], 21, 2240044497), b = m(b, c, d, e, g[f + 8], 6, 1873313359), e = m(e, b, c, d, g[f + 15], 10, 4264355552), d = m(d, e, b, c, g[f + 6], 15, 2734768916), c = m(c, d, e, b, g[f + 13], 21, 1309151649), b = m(b, c, d, e, g[f + 4], 6, 4149444226), e = m(e, b, c, d, g[f + 11], 10, 3174756917), d = m(d, e, b, c, g[f + 2], 15, 718787259), c = m(c, d, e, b, g[f + 9], 21, 3951481745), b = i(b, o), c = i(c, p), d = i(d, q), e = i(e, r);
    return (n(b) + n(c) + n(d) + n(e)).toLowerCase()
};
var colorCache = {};
var hashColor = function (name) {
    if (colorCache[name]) return colorCache[name];

    var hash = MD5(name);
    var H = parseInt(hash.substr(4, 4), 16) % 360;
    var S = parseInt(hash.substr(0, 4), 16) % 50 + 50;
    var L = parseInt(hash.substr(8, 4), 16) % 20 + 25;

    var rgb = hslToRgb(H, S, L);
    colorCache[name] = "#" + rgbToHex(rgb.r, rgb.g, rgb.b);
    return colorCache[name];
}

function hslToRgb(h, s, l) {
    var r, g, b, m, c, x

    if (!isFinite(h)) h = 0
    if (!isFinite(s)) s = 0
    if (!isFinite(l)) l = 0

    h /= 60
    if (h < 0) h = 6 - (-h % 6)
    h %= 6

    s = Math.max(0, Math.min(1, s / 100))
    l = Math.max(0, Math.min(1, l / 100))

    c = (1 - Math.abs((2 * l) - 1)) * s
    x = c * (1 - Math.abs((h % 2) - 1))

    if (h < 1) {
        r = c
        g = x
        b = 0
    } else if (h < 2) {
        r = x
        g = c
        b = 0
    } else if (h < 3) {
        r = 0
        g = c
        b = x
    } else if (h < 4) {
        r = 0
        g = x
        b = c
    } else if (h < 5) {
        r = x
        g = 0
        b = c
    } else {
        r = c
        g = 0
        b = x
    }

    m = l - c / 2
    r = Math.round((r + m) * 255)
    g = Math.round((g + m) * 255)
    b = Math.round((b + m) * 255)

    return {
        r: r,
        g: g,
        b: b
    }
}

function rgbToHex(R, G, B) {
    return toHex(R) + toHex(G) + toHex(B)
}

function toHex(N) {
    if (N == null) return "00";
    N = parseInt(N);
    if (N == 0 || isNaN(N)) return "00";
    N = Math.max(0, N);
    N = Math.min(N, 255);
    N = Math.round(N);
    return "0123456789ABCDEF".charAt((N - N % 16) / 16) + "0123456789ABCDEF".charAt(N % 16);
}


gamesConfig = {
	//bot
	name: "Pixie-Bot",
	group: "~",
	
	gtmRevealAnswerUrl: "",
	newGTM: function(room) {
		gamesConfig.rebusWinner = false;
		var gtmList = gamesConfig.gtmList;
		var keys = Object.keys(gtmList);
		var gtmListKey = Math.floor(Math.random() * keys.length);
		gamesConfig.rebusAnswer = keys[gtmListKey];
		gamesConfig.rebusURL = gtmList[gamesConfig.rebusAnswer][0];
		gamesConfig.gtmRevealAnswerUrl = gtmList[gamesConfig.rebusAnswer][1];
		room.addRaw('<img height="175" src="' + gamesConfig.rebusURL + '" />');
		setTimeout(function() {room.add('|c|' + gamesConfig.group + gamesConfig.name + '|^^^New guess the movie (!gtm)');}, 1000);
	},
	gtmList: require('./gtmovie.js').list,
	rebusables: require('./rebus.js').rebus,
	list4pics1word: require('./4pics1word.js').list4pics1word,
	status4pics1word: false,
	rebusswitch: false,
	rebusAnswer: false,
	rebusWinner: false,
	rebusURL: false,
	newRebus: function(room) {
		gamesConfig.rebusWinner = false;
		var rebusables = gamesConfig.rebusables,
				type = "rebus";
		if (gamesConfig.status4pics1word) {
			rebusables = gamesConfig.list4pics1word;
			type = "4pics1word";
		}
		var keys = Object.keys(rebusables);
		var rebusKey = Math.floor(Math.random() * keys.length);
		gamesConfig.rebusAnswer = keys[rebusKey];
		gamesConfig.rebusURL = rebusables[gamesConfig.rebusAnswer];
		room.addRaw('<img height="175" src="' + gamesConfig.rebusURL + '" />');
		setTimeout(function() {room.add('|c|' + gamesConfig.group + gamesConfig.name + '|^^^New ' + type + " --- " + gamesConfig.rebusAnswer.length + " character answer");}, 1000);
	},
	twisting: false,
	twisted: "",
	hints: new Array(),
	categnum: 0,
	categ: "",
	scores: new Object(),
	twistswitch: false,
	twistables: require('./twistables.js').twistables,
	twistWinner: false,
	newTwist: function(room) {
		gamesConfig.twistWinner = false;
		var twistables = gamesConfig.twistables;
		function twist(word) {
			var scrambled = "";
			var wordLength = word.length;
			for (var i = 0; i < wordLength; i++) {
				var charIndex = Math.floor(Math.random() * word.length);
				scrambled += word.charAt(charIndex);
				word = word.substr(0, charIndex) + word.substr(charIndex + 1);
			}
			return scrambled;
		}
		gamesConfig.categnum = Math.floor(Math.random() * twistables.length);
		gamesConfig.categ = twistables[gamesConfig.categnum].categ;
		var twistableslen = twistables[gamesConfig.categnum].list.length;
		gamesConfig.twisting = twistables[gamesConfig.categnum].list[Math.floor(Math.random() * twistableslen)];
		gamesConfig.twisted = twist(gamesConfig.twisting).toUpperCase();
		gamesConfig.hints = new Array();
		for (var i = 0; i < gamesConfig.twisted.length; i++) gamesConfig.hints.push(undefined); 
		room.add('|c|' + gamesConfig.group + gamesConfig.name + '|category: ' + gamesConfig.categ.toLowerCase() + " ---> untwist: \"" + gamesConfig.twisted + "\"");
	},
	processChatData: function (user, room, connection, message) {
		//wordtwist
		if (gamesConfig.twisting) if (toId(message).split(toId(gamesConfig.twisting)).length - 1 > 0) if (!gamesConfig.twisterWinner) {
			//correct
			gamesConfig.twistWinner = user.userid;
			setTimeout(function() {
				if (!gamesConfig.scores[user.userid]) gamesConfig.scores[user.userid] = 0;
				gamesConfig.scores[user.userid] += 1;
				shop.giveMoney(user.userid, shop.gains.twistWin);
				room.add('|c|' + gamesConfig.group + gamesConfig.name + '|"' + gamesConfig.twisting.toUpperCase() + '" ----> Correct! **' + user.name + '** won this round of wordtwist. +1 point -> **' + gamesConfig.scores[user.userid] + ' points**');
				if (gamesConfig.twistswitch) setTimeout(function() {gamesConfig.newTwist(room);}, 2000); else gamesConfig.twisting = false;
			}, 1000);
		}
		//rebus
		if (gamesConfig.rebusswitch) if (toId(message).split(toId(gamesConfig.rebusAnswer)).length - 1 > 0) if (!gamesConfig.rebusWinner) {
			//correct
			gamesConfig.rebusWinner = user.userid;
			setTimeout(function() {
				shop.giveMoney(user.userid, shop.gains.rebusWin);
				var type = "rebus",
					funk = "newRebus";
				if (gamesConfig.status4pics1word) type = "4pics1word";
				if (gamesConfig.gtmRevealAnswerUrl) {
					type = "guess the movie";
					funk = "newGTM";
				}
				room.addRaw('<img src="' + gamesConfig.gtmRevealAnswerUrl + '" height="175" />');
				gamesConfig.gtmRevealAnswerUrl = "";
				room.add('|c|' + gamesConfig.group + gamesConfig.name + '|"' + gamesConfig.rebusAnswer.toUpperCase() + '" ----> Correct! **' + user.name + '** won this round of ' + type + '.');
				if (gamesConfig.rebusswitch) setTimeout(function() {gamesConfig[funk](room);}, 2000); else gamesConfig.rebusAnswer = false;
			}, 1000);
		}
	},
};
