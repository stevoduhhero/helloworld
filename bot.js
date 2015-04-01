/**
 * Bot
 *
 * Credits
 * CreaturePhil - Lead Development (https://github.com/CreaturePhil)
 * TalkTakesTime - Parser (https://github.com/TalkTakesTime)
 * Stevoduhhero - Battling AI (https://github.com/stevoduhhero)
 *
 * @license MIT license
 */

var config = {
    name: 'Booty-Bot',
    userid: function () {
        return toId(this.name);
    },
    group: '@',
    join: true,
    rooms: ['lobby'],
    punishvals: {
        1: 'warn',
        2: 'mute',
        3: 'hourmute',
        4: 'roomban',
        5: 'ban'
    },
  privaterooms: ['staff'],
	gtmRevealAnswerUrl: "",
	newGTM: function(room) {
		config.rebusWinner = false;
		var gtmList = config.gtmList;
		var keys = Object.keys(gtmList);
		var gtmListKey = Math.floor(Math.random() * keys.length);
		config.rebusAnswer = keys[gtmListKey];
		config.rebusURL = gtmList[config.rebusAnswer][0];
		config.gtmRevealAnswerUrl = gtmList[config.rebusAnswer][1];
		room.addRaw('<img height="175" src="' + config.rebusURL + '" />');
		setTimeout(function() {room.add('|c|' + config.group + config.name + '|^^^New guess the movie (!gtm)');}, 1000);
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
		config.rebusWinner = false;
		var rebusables = config.rebusables,
				type = "rebus";
		if (config.status4pics1word) {
			rebusables = config.list4pics1word;
			type = "4pics1word";
		}
		var keys = Object.keys(rebusables);
		var rebusKey = Math.floor(Math.random() * keys.length);
		config.rebusAnswer = keys[rebusKey];
		config.rebusURL = rebusables[config.rebusAnswer];
		room.addRaw('<img height="175" src="' + config.rebusURL + '" />');
		setTimeout(function() {room.add('|c|' + config.group + config.name + '|^^^New ' + type + " --- " + config.rebusAnswer.length + " character answer");}, 1000);
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
		config.twistWinner = false;
		var twistables = config.twistables;
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
		config.categnum = Math.floor(Math.random() * twistables.length);
		config.categ = twistables[config.categnum].categ;
		var twistableslen = twistables[config.categnum].list.length;
		config.twisting = twistables[config.categnum].list[Math.floor(Math.random() * twistableslen)];
		config.twisted = twist(config.twisting).toUpperCase();
		config.hints = new Array();
		for (var i = 0; i < config.twisted.length; i++) config.hints.push(undefined); 
		room.add('|c|' + config.group + config.name + '|category: ' + config.categ.toLowerCase() + " ---> untwist: \"" + config.twisted + "\"");
	},
	keywords: {
		"fuck you": "i wish a bitch would",
		"asl": "23 F California, what about you big boy?",
		"beat me": "i can beat u too, im actually a trained dominatrix",
		"beat you": "i can beat u too, im actually a trained dominatrix",
	}
};

/**
 * On server start, this sets up fake user connection for bot and uses a fake ip.
 * It gets a the fake user from the users list and modifies it properties. In addition,
 * it sets up rooms that bot will join and adding the bot user to Users list and
 * removing the fake user created which already filled its purpose
 * of easily filling  in the gaps of all the user's property.
 */

function joinServer() {
    if (process.uptime() > 5) return; // to avoid running this function again when reloading
    var worker = new(require('./fake-process.js').FakeProcess)();
    Users.socketConnect(worker.server, undefined, '1', '76.19.156.198');

    for (var i in Users.users) {
        if (Users.users[i].connections[0].ip === '76.19.156.198') {

            var bot = Users.users[i];

            bot.name = config.name;
            bot.named = true;
            bot.renamePending = config.name;
            bot.authenticated = true;
            bot.userid = config.userid();
            bot.group = config.group;
            bot.avatar = 'booty.jpg';

            if (config.join === true) {
                for (var all in Rooms.rooms) {
                    if (all != 'global') {
                        bot.roomCount[all] = 1;
                    }
                }
                Users.users[bot.userid] = bot;
                for (var allRoom in Rooms.rooms) {
                    if (allRoom != 'global') {
                        Rooms.rooms[allRoom].users[Users.users[bot.userid]] = Users.users[bot.userid];
                    }
                }
            } else {
                for (var index in config.rooms) {
                    if (index != 'global') {
                        bot.roomCount[joinRooms[index]] = 1;
                    }
                }
                Users.users[bot.userid] = bot;
                for (var jIndex in config.rooms) {
                    if (jIndex != 'global') {
                        Rooms.rooms[jIndex].users[Users.users[bot.userid]] = Users.users[bot.userid];
                    }
                }
            }
            delete Users.users[i];
        }
    }
}

const ACTION_COOLDOWN = 3 * 1000;
const FLOOD_MESSAGE_NUM = 5;
const FLOOD_PER_MSG_MIN = 500; // this is the minimum time between messages for legitimate spam. It's used to determine what "flooding" is caused by lag
const FLOOD_MESSAGE_TIME = 6 * 1000;
const MIN_CAPS_LENGTH = 18;
const MIN_CAPS_PROPORTION = 0.8;

var parse = {

    chatData: {},

    processChatData: function (user, room, connection, message) {
		//wordtwist
		if (config.twisting) if (toId(message).split(toId(config.twisting)).length - 1 > 0) if (!config.twisterWinner) {
			//correct
			config.twistWinner = user.userid;
			setTimeout(function() {
				if (!config.scores[user.userid]) config.scores[user.userid] = 0;
				config.scores[user.userid] += 1;
				shop.giveMoney(user.userid, shop.gains.twistWin);
				room.add('|c|' + config.group + config.name + '|"' + config.twisting.toUpperCase() + '" ----> Correct! **' + user.name + '** won this round of wordtwist. +1 point -> **' + config.scores[user.userid] + ' points**');
				if (config.twistswitch) setTimeout(function() {config.newTwist(room);}, 2000); else config.twisting = false;
			}, 1000);
		}
		//rebus
		if (config.rebusswitch) if (toId(message).split(toId(config.rebusAnswer)).length - 1 > 0) if (!config.rebusWinner) {
			//correct
			config.rebusWinner = user.userid;
			setTimeout(function() {
				shop.giveMoney(user.userid, shop.gains.rebusWin);
				var type = "rebus",
					funk = "newRebus";
				if (config.status4pics1word) type = "4pics1word";
				if (config.gtmRevealAnswerUrl) {
					type = "guess the movie";
					funk = "newGTM";
				}
				room.addRaw('<img src="' + config.gtmRevealAnswerUrl + '" height="175" />');
				config.gtmRevealAnswerUrl = "";
				room.add('|c|' + config.group + config.name + '|"' + config.rebusAnswer.toUpperCase() + '" ----> Correct! **' + user.name + '** won this round of ' + type + '.');
				if (config.rebusswitch) setTimeout(function() {config[funk](room);}, 2000); else config.rebusAnswer = false;
			}, 1000);
		}
		//keywords
		var response = "";
		for (var i in config.keywords) if (message.split(i).length - 1 > 0) response = config.keywords[i];
		if (response) setTimeout(function() {room.add('|c|' + config.group + config.name + '|' + response)}, 1000);

		
		
		//normal
        if (user.userid === config.userid()) return;
        var cmd = this.processBotCommands(user, room, connection, message);
        if (cmd) return false;

        message = message.trim().replace(/ +/g, " "); // removes extra spaces so it doesn't trigger stretching
        this.updateSeen(user.userid, 'c', room.title);
        var time = Date.now();
        if (!this.chatData[user]) this.chatData[user] = {
            zeroTol: 0,
            lastSeen: '',
            seenAt: time
        };
        if (!this.chatData[user][room]) this.chatData[user][room] = {
            times: [],
            points: 0,
            lastAction: 0
        };

        this.chatData[user][room].times.push(time);

        var pointVal = 0;
        var muteMessage = '';

        // moderation for flooding (more than x lines in y seconds)
        var isFlooding = (this.chatData[user][room].times.length >= FLOOD_MESSAGE_NUM && (time - this.chatData[user][room].times[this.chatData[user][room].times.length - FLOOD_MESSAGE_NUM]) < FLOOD_MESSAGE_TIME && (time - this.chatData[user][room].times[this.chatData[user][room].times.length - FLOOD_MESSAGE_NUM]) > (FLOOD_PER_MSG_MIN * FLOOD_MESSAGE_NUM));
        if (isFlooding) {
            if (pointVal < 2) {
                pointVal = 2;
                muteMessage = ', flooding';
            }
        }
        // moderation for caps (over x% of the letters in a line of y characters are capital)
        var capsMatch = message.replace(/[^A-Za-z]/g, '').match(/[A-Z]/g);
        if (capsMatch && toId(message).length > MIN_CAPS_LENGTH && (capsMatch.length >= Math.floor(toId(message).length * MIN_CAPS_PROPORTION))) {
            if (pointVal < 1) {
                pointVal = 1;
                muteMessage = ', caps';
            }
        }
        // moderation for stretching (over x consecutive characters in the message are the same)
        var stretchMatch = message.toLowerCase().match(/(.)\1{7,}/g) || message.toLowerCase().match(/(..+)\1{4,}/g); // matches the same character (or group of characters) 8 (or 5) or more times in a row
        if (stretchMatch) {
            if (pointVal < 1) {
                pointVal = 1;
                muteMessage = ', stretching';
            }
        }
				if (room.id == "spamroom" || room.id == "spam") pointVal = 0;
        if (pointVal > 0 && !(time - this.chatData[user][room].lastAction < ACTION_COOLDOWN)) {
            var cmd = 'mute';
            // defaults to the next punishment in config.punishVals instead of repeating the same action (so a second warn-worthy
            // offence would result in a mute instead of a warn, and the third an hourmute, etc)
            if (this.chatData[user][room].points >= pointVal && pointVal < 4) {
                this.chatData[user][room].points++;
                cmd = config.punishvals[this.chatData[user][room].points] || cmd;
            } else { // if the action hasn't been done before (is worth more points) it will be the one picked
                cmd = config.punishvals[pointVal] || cmd;
                this.chatData[user][room].points = pointVal; // next action will be one level higher than this one (in most cases)
            }
            if (config.privaterooms.indexOf(room) >= 0 && cmd === 'warn') cmd = 'mute'; // can't warn in private rooms
            // if the bot has % and not @, it will default to hourmuting as its highest level of punishment instead of roombanning
            if (this.chatData[user][room].points >= 4 && config.group === '%') cmd = 'hourmute';
            if (this.chatData[user].zeroTol > 4) { // if zero tolerance users break a rule they get an instant roomban or hourmute
                muteMessage = ', zero tolerance user';
                cmd = config.group !== '%' ? 'roomban' : 'hourmute';
            }
            if (this.chatData[user][room].points >= 2) this.chatData[user].zeroTol++; // getting muted or higher increases your zero tolerance level (warns do not)
            this.chatData[user][room].lastAction = time;
            room.add('|c|' + user.group + user.name + '|' + message);
            CommandParser.parse(('/' + cmd + ' ' + user.userid + muteMessage), room, Users.get(config.name), Users.get(config.name).connections[0]);
            return false;
        }

        return true;
    },

    updateSeen: function (user, type, detail) {
        user = toId(user);
        type = toId(type);
        if (type in {j: 1, l: 1, c: 1} && (config.rooms.indexOf(toId(detail)) === -1 || config.privaterooms.indexOf(toId(detail)) > -1)) return;
        var time = Date.now();
        if (!this.chatData[user]) this.chatData[user] = {
            zeroTol: 0,
            lastSeen: '',
            seenAt: time
        };
        if (!detail) return;
        var msg = '';
        if (type in {j: 1, l: 1, c: 1}) {
            msg += (type === 'j' ? 'joining' : (type === 'l' ? 'leaving' : 'chatting in')) + ' ' + detail.trim() + '.';
        } else if (type === 'n') {
            msg += 'changing nick to ' + ('+%@&#~'.indexOf(detail.trim().charAt(0)) === -1 ? detail.trim() : detail.trim().substr(1)) + '.';
        }
        if (msg) {
            this.chatData[user].lastSeen = msg;
            this.chatData[user].seenAt = time;
        }
    },

    processBotCommands: function (user, room, connection, message) {
        if (room.type !== 'chat') return;

        var cmd = '',
            target = '',
            spaceIndex = message.indexOf(' '),
            botDelay = (Math.floor(Math.random() * 6) * 1000),
            now = Date.now();

        if (spaceIndex > 0) {
            cmd = message.substr(1, spaceIndex - 1);
            target = message.substr(spaceIndex + 1);
        } else {
            cmd = message.substr(1);
            target = '';
        }

        if (message.charAt(0) === '!' && Object.keys(Bot.commands).join(' ').toString().indexOf(cmd) >= 0) {

            if ((now - user.lastBotCmd) * 0.001 < 10) {
                connection.sendTo(room, 'Please wait ' + Math.floor((30 - (now - user.lastBotCmd) * 0.001)) + ' seconds until the next command.');
                return true;
            }

            user.lastBotCmd = now;
        }

        if (commands[cmd]) {
            var context = {
                sendReply: function (data) {
                    setTimeout(function () {
                        room.add('|c|' + config.group + config.name + '|' + data);
                    }, botDelay);
                },
                sendPm: function (data) {
                    var message = '|pm|' + config.group + config.name + '|' + user.group + user.name + '|' + data;
                    user.send(message);
                },
                can: function (permission, target, room) {
                    if (!user.can(permission, target, room)) {
                        setTimeout(function () {
                            user.send("!" + cmd + " - Access denied.")
                        }, botDelay);
                        return false;
                    }
                    return true;
                },
                parse: function (target) {
                    CommandParser.parse(target, room, Users.get(Bot.config.name), Users.get(Bot.config.name).connections[0]);
                },
            };

            if (typeof commands[cmd] === 'function') {
                commands[cmd].call(context, target, room, user, connection, cmd, message);
            }
        }
    },

    getTimeAgo: function (time) {
        time = Date.now() - time;
        time = Math.round(time / 1000); // rounds to nearest second
        var seconds = time % 60;
        var times = [];
        if (seconds) times.push(String(seconds) + (seconds === 1 ? ' second' : ' seconds'));
        var minutes, hours, days;
        if (time >= 60) {
            time = (time - seconds) / 60; // converts to minutes
            minutes = time % 60;
            if (minutes) times = [String(minutes) + (minutes === 1 ? ' minute' : ' minutes')].concat(times);
            if (time >= 60) {
                time = (time - minutes) / 60; // converts to hours
                hours = time % 24;
                if (hours) times = [String(hours) + (hours === 1 ? ' hour' : ' hours')].concat(times);
                if (time >= 24) {
                    days = (time - hours) / 24; // you can probably guess this one
                    if (days) times = [String(days) + (days === 1 ? ' day' : ' days')].concat(times);
                }
            }
        }
        if (!times.length) times.push('0 seconds');
        return times.join(', ');
    }

};

var commands = {
	feels: function() {
		this.sendReply("feels -> https://github.com/stevoduhhero/datfeels");
	},
	
	scoreboard: 'scores',
	scores: function(target, room, user) {
		var scores = new Object();
		for (var i in config.scores) if (scores[config.scores[i]]) scores[config.scores[i]].push(i); else scores[config.scores[i]] = [i];
		var stringy = "";
		for (var i in scores) {
			var score = i;
			var people = scores[i].join('');
			stringy += score + "pts=" + people + " || ";
		}
		this.sendReply(stringy);
	},
	
	twist: function(target, room, user) {
		if (!user.can('broadcast')) return this.sendReply('You don\'t have enough auth to use this command.');
		if (config.rebusswitch == true) return this.sendReply('do !twist off to play this first');
		if (target == "on") {
			config.twistswitch = true;
			config.scores = new Object();
		}
		if (target == "off") config.twistswitch = false;
		config.newTwist(room);
	},
	
	'guessthemovie': '4pics',
	'gtmovie': '4pics',
	'gtm': '4pics',
	'4pics1word': '4pics',
	'4pics': function(target, room, user, connection, cmd, message) {
		if (!user.can('broadcast')) return this.sendReply('You don\'t have enough auth to use this command.');
		if (config.twistswitch == true) return this.sendReply('do !twist off to play this first');
		config.status4pics1word = false;
		config.gtmRevealAnswerUrl = "";
		if (target == "on") {
			config.rebusswitch = true;
			if (cmd == "4pics1word" || cmd == "4pics") config.status4pics1word = true;
		}
		if (target == "off") config.rebusswitch = false;
		var funk = "newRebus";
		if (cmd == "gtm" || cmd == "gtmovie" || cmd == "guessthemovie") funk = "newGTM";
		config[funk](room);
	},
	rebus: function(target, room, user, connection, cmd, message) {
		if (!user.can('broadcast')) return this.sendReply('You don\'t have enough auth to use this command.');
		if (config.twistswitch == true) return this.sendReply('do !twist off to play this first');
		config.status4pics1word = false;
		config.gtmRevealAnswerUrl = "";
		if (target == "on") {
			config.rebusswitch = true;
		}
		if (target == "off") config.rebusswitch = false;
		config.newRebus(room);
	},
	
	hint: function(target, room, user) {
		//if (!this.can('broadcast')) return this.sendReply('You don\'t have enough auth to use this command.');
		if (!config.twisting) this.sendReply('No words are being twisted.');
		var stringy = new Array();
		var can = new Array();
		for (var i in config.hints) if (!config.hints[i]) {stringy.push(" _ ");can.push(i);} else stringy.push(config.hints[i]);
		var ran = can[Math.floor(Math.random() * can.length)];
		config.hints[ran] = config.twisting[ran];
		if (!config.hints[ran]) config.hints[ran] = "";
		config.hints[ran] = config.hints[ran].toUpperCase();
		stringy[ran] = config.hints[ran];
		this.sendReply('HINT: "' + stringy.join('') + '"');
		if (!can.length) {
			//all hints given, game done bcos no one could guess it
		}
	},
	
	
	
	
	//normal commands
    guide: function (target, room, user) {
        var commands = Object.keys(Bot.commands);
        commands = commands.join(', ').toString();

        this.sendReply('List of bot commands: ' + commands);
    },

    say: function (target, room, user) {
        if (!this.can('say')) return;
        this.sendReply(target);
    },

    bottell: function (target, room, user) {
        if (!this.can('bottell')) return;
        var parts = target.split(',');
        if (parts.length < 2) return;
        this.parse('/tell ' + toId(parts[0]) + ', ' + Tools.escapeHTML(parts[1]));
    },

    penislength: function (target, room, user) {
        this.sendReply('8.5 inches from the base. Perv.');
    },

    seen: function (target, room, user, connection) {
        if (!target) return;
        if (!toId(target) || toId(target).length > 18) return connection.sendTo(room, 'Invalid username.');
        if (!parse.chatData[toId(target)] || !parse.chatData[toId(target)].lastSeen) {
            return this.sendPm('The user ' + target.trim() + ' has never been seen chatting in rooms.');
        }
        return this.sendPm(target.trim() + ' was last seen ' + parse.getTimeAgo(parse.chatData[toId(target)].seenAt) + ' ago, ' + parse.chatData[toId(target)].lastSeen);
    },

    salt: function (target, room, user) {
        if (!global.salt) global.salt = 0;
        salt++;
        this.sendReply(salt + '% salty.');
    },

    who: (function () {
        var reply = [
            "Just another Pokemon Showdown user",
            "A very good competetive pokemon player",
            "A worthy opponent",
            "Generally, a bad user",
            "Generally, a good user",
            "Someone who is better than you",
            "An amazing person",
            "A beautiful person",
            "A person who is probably still a virgin",
            "A leader",
            "A lord helix follower",
            "An annoying person",
            "A person with a salty personality",
            "A Coffee Addict",
            "A Mediocre Player",
        ];

        return function (target, room, user) {
            if (!target) return;
            var message = reply[Math.floor(Math.random() * reply.length)];

            target = toId(target);

            if (target === 'creaturephil') message = 'An experienced **coder** for pokemon showdown. He has coded for over 5 servers such as kill the noise, moxie, aerdeith, nova, etc. Please follow him on github: https://github.com/CreaturePhil';
            if (target === config.userid()) message = 'That\'s me.';
            if (target === 'zarel') message = 'Pokemon Showdown Creator';

            this.sendReply(message);
        };
    })(),

    helix: (function () {
        var reply = [
            "Signs point to yes.",
            "Yes.",
            "Reply hazy, try again.",
            "Without a doubt.",
            "My sources say no.",
            "As I see it, yes.",
            "You may rely on it.",
            "Concentrate and ask again.",
            "Outlook not so good.",
            "It is decidedly so.",
            "Better not tell you now.",
            "Very doubtful.",
            "Yes - definitely.",
            "It is certain.",
            "Cannot predict now.",
            "Most likely.",
            "Ask again later.",
            "My reply is no.",
            "Outlook good.",
            "Don't count on it."
        ];

        return function (target, room, user) {
            if (!target) return;
            var message = reply[Math.floor(Math.random() * reply.length)];

            this.sendPm(message);
        };
    })(),

    maketournament: function (target, room, user) {
        if (!this.can('maketournament')) return;
        if (Tournaments.tournaments[room.id]) return this.sendReply('A tournament is already running in the room.');

        var parts = target.split(','),
            self = this,
            counter = 1;

        if (parts.length < 2 || Tools.getFormat(parts[0]).effectType !== 'Format' || !/[0-9]/.test(parts[1])) return;

        if (parts[1].indexOf('minute') >= 0) {
            var time = Number(parts[1].split('minute')[0]);

            this.parse('/tour create ' + parts[0] + ', elimination');
            this.sendReply('**You have ' + time + ' minute' + parts[1].split('minute')[1] + ' to join the tournament.**');

            var loop = function () {
                setTimeout(function () {
                    if (counter === time) {
                        if (Tournaments.tournaments[room.id].generator.users.size < 2) {
                            self.parse('/tour end');
                            return self.sendReply('**The tournament was canceled because of lack of players.**');
                        }
                        return self.parse('/tour start');
                    }
                    if ((time - counter) === 1) {
                        self.sendReply('**You have ' + (time - counter) + ' minute to sign up for the tournament.**');
                    } else {
                        self.sendReply('**You have ' + (time - counter) + ' minutes to sign up for the tournament.**');
                    }
                    counter++;
                    if (!Tournaments.tournaments[room.id].isTournamentStarted) loop();
                }, 1000 * 60);
            };
            loop();
        }
        if (Number(parts[1]) < 2) return;
        parts[1] = parts[1].replace(/[^0-9 ]+/g, '');
        this.parse('/tour create ' + parts[0] + ', elimination');
        this.sendReply('**The tournament will begin when ' + parts[1] + ' players join.**');
        var playerLoop = function () {
            setTimeout(function () {
                if (Tournaments.tournaments[room.id].generator.users.size === Number(parts[1])) {
                    self.parse('/tour start');
                }
                playerLoop();
            }, 1000 * 15);
        };
        playerLoop();
    },

};

exports.joinServer = joinServer;
exports.config = config;
exports.parse = parse;
for (var i in commands) {
	var c = commands[i];
	if (typeof c == "string") {
		commands[i] = commands[c];
	}
}
exports.commands = commands;
exports.teams = new Object();
var fs = require('fs');
fs.readFile("./config/bootyteams.txt", function(err, data) {
	if (err) return;
	data = ('' + data);
	exports.teams = JSON.parse(data);
});
exports.addTeam = function(format, team) {
	if (team && team.length && typeof team == "string") {
		if (!Bot.teams[format]) Bot.teams[format] = new Array();
		Bot.teams[format].push(team);
		fs.writeFile("./config/bootyteams.txt", JSON.stringify(Bot.teams));
	}
};
exports.randomTeam = function(format) {
	if (format.split('random').length - 1 > 0) return "";
	var t;
	if (Bot.teams[format]) t = Bot.teams[format][Math.floor(Math.random() * Bot.teams[format].length)];
	if (!t) t = "";
	return t;
};
exports.booty = {
	addBattle: function(format, opp) {
		Bot.booty.battles['battle-' + format.toLowerCase().replace(/[^a-z0-9]+/g, '') + '-' + (Rooms.global.lastBattle + 1)] = {
			booty: {
				user: Users.get(Bot.config.name),
				exposed: [{}, {}, {}, {}, {}, {}]
			},
			opp: {
				user: opp,
				exposed: [{}, {}, {}, {}, {}, {}]
			}
		};	
	},
	battles: new Object(),
	check: function() {
		global.bootytimeout = setTimeout(function() {
			if (!Bot.booty.battles) {Bot.booty.check();return;}
			for (var i in Bot.booty.battles) {
				if (Bot.booty.battles[i]) {
					var r = Rooms.rooms[i];
					if (r && r.battle && r.battle.field) {
						var b = r.battle.field;
						if (b[Bot.config.userid()]) if (b[Bot.config.userid()].side) if (b[Bot.config.userid()].side.pokemon) if (b[Bot.config.userid()].side.pokemon[0].condition.charAt(0) == '0') Bot.booty.forceSwitch(i);
						if (b[Bot.config.userid()]) if (b[Bot.config.userid()].forceSwitch) Bot.booty.forceSwitch(i);
					}
				}
			}
			Bot.booty.check();
		}, 2000);
	},
	forceSwitch: function(roomid) {
		//when done, probably will want to transfer bestSwitch() into here
		var room;
		if (Rooms.rooms[roomid]) room = Rooms.rooms[roomid];
		if (!room) return;
		//ray is an array of the pokemon slots we can pick
		var bootybattle = Bot.booty.battles[room.id];
		var field = room.battle.field, ufield = field[Bot.config.userid()].side.pokemon;
		var teamsize = ufield.length;
		if (!ray) {
			var ray = new Array();
			for (var i = 0; i < teamsize; i++) ray.push(i);
		}
		var slot = Math.floor(Math.random() * teamsize);
		while(slot == 1 && ray.indexOf(slot) == -1 && ufield[slot].condition.charAt(0) == "0") slot = Math.floor(Math.random() * teamsize);
		room.decision(Users.get(Bot.config.userid()), 'choose', 'switch ' + parseInt(slot + 1, 10));
	},
	predict: function(target, room, opp, oppaction) {
		//move           -> room.decision(user, 'choose', 'move ' + target);
		//switch         -> room.decision(user, 'choose', 'switch ' + parseInt(target, 10));
		//choose         -> room.decision(user, 'choose', target);
		//select 1st mon -> room.decision(user, 'choose', 'team ' + target);
		var youaction;
		var must = {
			change: false, //are we forced to switch pokemon?
		};
		var user = Users.get(Bot.config.name);
		if (!room.battle.field || !user) return false;
		if (!room.battle.field[user.userid]) return false;
		var field = room.battle.field, ofield = field[opp.userid].side.pokemon, ufield = field[user.userid].side.pokemon;
		if (ofield[0].condition.charAt(0) == "0" && ufield[0].condition.charAt(0) != "0") return false; //this means the opponent is just switching something in because they fainted... but we didn't faint so we don't do anything
		if (ufield[0].condition.charAt(0) == "0") must.change = true;
		var turn = field[opp.userid].rqid;
		var bootybattle = Bot.booty.battles[room.id];
		bootybattle.turn = turn;
		if (oppaction == "team") {
			//team is the only one that doesn't need to know moves and we need an active pokemon to know the moves
			//keeping team below freezes the game cas we can't have an active mon without switching something in
			//does that make sense? i hope so D:
			
			
				//we should probably just do a math.random here
				//later when we have time
					//if our lead is better than their lead, keep it
					//else switch to something good against their lead
						//if still nothing do math.random like we are right now
				var teamsize = ufield.length;
				var randomnum = Math.floor(Math.random() * teamsize);
				room.decision(user, 'choose', 'team ' + randomnum + "|" + turn);
				return false;
		}
		if (!field[user.userid]) {return false;} if (!field[user.userid].active) {return false;}
		var allmoves = field[user.userid].active[0].moves;
		var viablemoves = new Array();
		for (var i in allmoves) {
			var cmove = allmoves[i];
			if (!cmove.disabled && cmove.pp) viablemoves.push(cmove);
		}
		var oppmonspecies = ofield[0].details.split(",")[0];
		var youmonspecies = ufield[0].details.split(",")[0];
		var youmon = Tools.data.Pokedex[toId(youmonspecies)]; //.types, .abilities, .baseStats
		var oppmon = Tools.data.Pokedex[toId(oppmonspecies)];
		var youroles = guessRoles(youmon, 0);
		var opproles = guessRoles(oppmon);
		var effectivenessMultipliers = [1, 2, 0.5, 0];
		function typesVStypes(types1, types2, returntotaleffectiveness) {
			//checks if types in mon1 array are weak to any types in mon2 array
			var weakness = false;
			var totaleffectiveness = 1;
			var besteffectiveness = 0;
			for (var x in types2) {
				var effectiveness = 1;
				var ctype = types2[x];
				for (var i in types1) {
					var typeExists = Tools.data.TypeChart[types1[i]];
					if (typeExists) effectiveness = effectiveness * effectivenessMultipliers[typeExists.damageTaken[ctype]];
				}
				if (effectiveness >= 2) weakness = true;
				totaleffectiveness = totaleffectiveness * effectiveness;
				if (besteffectiveness < effectiveness) besteffectiveness = effectiveness;
			}
			if (returntotaleffectiveness) {if (returntotaleffectiveness.total) return totaleffectiveness; else if (returntotaleffectiveness.best) return besteffectiveness;}
			return weakness;
		}
		function guessRoles(mon, slot) {
			var stats = mon.baseStats;
			var totalstats = 0;
			for (var i in stats) totalstats += stats[i];
			var abilities = mon.abilities;
			var types = mon.types;
			var roles = {
				wall: false,
				frail: false,
				attacking: {
					//type of attack
					mixed: false,
					physical: false,
					special: false,
				},
				defending: {
					//type of defender
					mixed: false,
					physical: false,
					special: false,
				}
			};
			//here is where we change the roles
			if (stats.hp < 100) roles.frail = true;
			if ((stats.hp + stats.def + stats.spd) / totalstats > 0.474) roles.wall = true;
			var totoffense = stats.atk + stats.spa;
			var atkproportion = stats.atk / totoffense;
			var spaproportion = stats.spa / totoffense;
			if (12.75 > Math.abs(atkproportion - spaproportion) * 100) {
				roles.attacking.mixed = true;
				roles.attacking.physical = true;
				roles.attacking.special = true;
			} else {
				if (atkproportion > spaproportion) roles.attacking.physical = true;
				if (spaproportion > atkproportion) roles.attacking.special = true;
			}
			var totdefense = stats.def + stats.spd;
			var defproportion = stats.def / totdefense;
			var spdproportion = stats.spd / totdefense;
			if (12.75 > Math.abs(defproportion - spdproportion) * 100) {
				//i kinda think anything lower than 75def||spd is too little for it to be COMFORTABLE taking a hit
				if (stats.def >= 75) roles.defending.physical = true;
				if (stats.spd >= 75) roles.defending.special = true;
				if (stats.def >= 75 && stats.spd >= 75) roles.defending.mixed = true;
			} else {
				if (defproportion > spdproportion) if (stats.def >= 75) roles.defending.physical = true;
				if (spdproportion > defproportion) if (stats.spd >= 75) roles.defending.special = true;
			}
			
			if (roles.wall || roles.tank) roles.frail = false;
			if (slot === 0) {
				//this is for your side only (until we make an object w/ all things revealed on opponents side throughtout the battle) it tells you exactly what kind of mon u have since it has all the info filled in
				//we'll do this later for a more accurate role, eventually for both sides since we'll have some info on the mon revealed
			}
			return roles;
		}
		function bestAttack() {
			//what will do the most damage
			//if move has effect, predict how turn after will be
			//look at the mon who beats most of their team (mvp)
			//look at importance of keeping their mon alive (checks to our teams mvp) (determine if threatened)
			var movesEffectiveness = new Array();
			var movesPower = new Array();
			var move = {move: "", power: 0};
			var appealingMoves = new Object();
			for (var i in viablemoves) {
				var effectiveness = 1;
				var currentmove = Tools.data.Movedex[toId(viablemoves[i])];
				var currentmovetype = currentmove.type;
				for (var i in oppmon.types) effectiveness = effectiveness * effectivenessMultipliers[Tools.data.TypeChart[oppmon.types[i]].damageTaken[currentmovetype]];
				//take into account thick fat n shit (not done yet)
				var oppability = ofield[0].baseAbility;
				var oppitem = ofield[0].item;
				if (oppability == "thickfat" && (currentmovetype == "Fire" || currentmovetype == "Ice")) effectiveness = effectiveness * 0.5;
				if ((oppitem == "airballoon" || oppability == "levitate") && currentmovetype == "Ground") effectiveness = 0;
				
				var stab = 1;
				if (youmon.types.indexOf(currentmovetype) != -1) stab = 1.5;
				var power = effectiveness * currentmove.basePower * stab;
				movesEffectiveness.push(effectiveness);
				movesPower.push(power);
				if (power >= move.power) move = {move: currentmove.name, power: power, info: viablemoves[i]};
				if (currentmove.category == "Status") {
					appealingMoves[currentmove.id] = viablemoves[i];
				}
			}
			//^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ this'll just pick the move with the highest power after stab & effectiveness
			
			//here we determine what to do based on roles
			//also check if they're both strong and fast to see if we're threatened
			if (viablemoves.length == 0) {
				var m = Tools.data.Movedex.struggle;
				move = {move: m.move, power: m.power, info: {}};
			}
			var threatened, ismvp;
			var megaornaw = "";
			if (ufield[0].item.split("ite").length - 1 > 0 && ufield[0].details.split("-mega").length - 1 == 0) megaornaw = " mega";
			if (threatened && !ismvp) {
				//will try to switch unless my mon is mvp and they need to prevent it from going crazy
				//predict switch
				//move that'll do most on switch in
			} else {
				//pick the move that does the most damage
				//if they look like they may set up, worry about that first bcos they're not threatened yet were staying in
				
			}
			return 'move ' + move.move + megaornaw + "|" + turn;
		}
		function safestSwitch() {
			//coming into an attack
			//for sacking shit
			//check for good revenge kill
			//check if u can take the hit
			//check if u can wall the mon
			return bestSwitch();
			//this function is a lil more complex than bestswitch so were just gonna leave it blank for now and use that one instead
		}
		function bestSwitch() {
			//what will wreck shit (something fainted and we have to switch something else in)
			var livemons = 0;
			var best = {
				slot: 0,
				bestmovepower: 0, //self explanatory, the higher the better
				faster: false, //is this mon faster than theirs?
			};
			function tally(obj, movepower) {
				var tally = 0;
				if (obj.bestmovepower > movepower) tally++;
				if (obj.faster) tally++;
				return tally;
			}
			for (var i in ufield) {
				var cmon = ufield[i];
				var cmoninfo = Tools.data.Pokedex[toId(cmon.details.split(",")[0])];
				if (cmon.condition.charAt(0) != "0") {
					livemons++;
					var cmoves = new Array();
					for (var x in cmon.moves) cmoves[x] = cmon.moves[x].replace(new RegExp("[0-9]", "g"), ""); //regex replaces any numbers, just in case hidden power is in there (formats it to things like hiddenpowergrass60)
					var movetypes = new Array();
					for (var x in cmoves) movetypes.push(Tools.data.Movedex[toId(cmoves[x])].type);
					var faster = false;
					if (cmoninfo.baseStats.spe > oppmon.baseStats.spe) faster = true;
					var bestmovepower = 0;
					for (var y in cmoves) {
						var effectiveness = 1;
						var currentmove = Tools.data.Movedex[toId(cmoves[y])];
						var currentmovetype = currentmove.type;
						for (var z in oppmon.types) effectiveness = effectiveness * effectivenessMultipliers[Tools.data.TypeChart[oppmon.types[z]].damageTaken[currentmovetype]];
						
						var stab = 1;
						if (cmoninfo.types.indexOf(currentmovetype) != -1) stab = 1.5;
						var power = effectiveness * currentmove.basePower * stab;
						if (power > bestmovepower) bestmovepower = power;
					}
					var c = {
						slot: i,
						bestmovepower: bestmovepower,
						faster: faster
					};
					if (tally(best, c.bestmovepower) < tally(c, best.bestmovepower)) best = c;
				}
			}
			best.slot++; //slots are 1-6 not 0-5
			if (livemons == 1 || best.slot == 1) bestAttack(); //can't switch, all dead || best thing to do is stay in and attack
			return 'switch ' + best.slot;
		}
		function bestOption() {
			//basically this is what'll benefit booty most overall
			//bestAttack vs safestSwitch
			var indanger = false;
			var oppfaster = false;
			var oppspeed = oppmon.baseStats.spe;
			var youspeed = youmon.baseStats.spe;
			if (oppspeed > youspeed) oppfaster = true;
			var youweak2oppstabs = typesVStypes(youmon.types, oppmon.types);
			var oppweak2youstabs = typesVStypes(oppmon.types, youmon.types);
			var viablemovestypes = new Array();
			for (var i in viablemoves) viablemovestypes.push(Tools.data.Movedex[toId(viablemoves[i].move)].type);
			var havesupermove = typesVStypes(oppmon.types, viablemovestypes);
			//check if in danger here
			//if he's faster and we're frail we're in danger
			//if he's faster and we're weak to his typing we're in danger
			//if we're weak to his typing we're in danger
			//if he's slower && we're weak to his typing && we have a super effective move against him && he's frail, we're not in danger
			if (!(!oppfaster && youweak2oppstabs && havesupermove && opproles.frail)) {
				if (oppfaster && youroles.frail) indanger = true;
				if (oppfaster && youweak2oppstabs) indanger = true;
				if (youweak2oppstabs) indanger = true;
			}
							/*
								right now it switches every turn if its stats are lower which is pretty bad... maybe i wont do this after all lol
							//based on stats are we in danger?
							if (opproles.attacking.mixed && !youroles.defending.mixed) indanger = true; else {
								if (opproles.attacking.physical && !youroles.defending.physical) indanger = true;
								if (opproles.attacking.special && !youroles.defending.special) indanger = true;
							}
							*/
			//if we're wall vs wall just make it be that we're in danger otherwise they might set up on us
			if (opproles.wall && youroles.wall) indanger = 1;//we should probably switch bcos it's a wall vs a wall
			if (indanger === true) {
				//means your probably coming in on a non wall mon and it's gonna be a normal attack
				var s = safestSwitch();
				if (s.replace( /^\D+/g, '') != 1) return s; //this means that if the safest thing to do is stay in, use the mon as fodder
			} else if (indanger == 1) bestSwitch(); //means you know they won't harm you so just go to the best thing to beat their pokemon possible
			return bestAttack();
		}
		switch(oppaction) {
			case 'switch':
			case 'move':
			case 'choose':
				//react the same to all of these
				//just make it try and predict what opp will do
				//if we're disadvantaged switch, else attack i guess IDFK
				if (!must.change) {
					//intelligence normal movements go here
					var trapped = field[Bot.config.userid()].active;
					if (!trapped) trapped = false; else trapped = trapped[0].trapped;
					if (trapped) {
						youaction = bestAttack();
					} else {
						youaction = bestOption();
					}
					/*	----------------------- this is what we used to be random
					function randomSwitch(ray) {
						//ray is an array of the pokemon slots we can pick
						var teamsize = ufield.length;
						if (!ray) {
							var ray = new Array();
							for (var i = 0; i < teamsize; i++) ray.push(i);
						}
						var slot = Math.floor(Math.random() * teamsize);
						while(slot == 1 && ray.indexOf(slot) == -1 && ufield[slot].condition.charAt(0) == "0") slot = Math.floor(Math.random() * teamsize);
						return 'switch ' + parseInt(slot + 1, 10);//the +1 is bcos i guess there's no slot 0 in showdown
					}
					function randomMove() {
						if (field[user.userid]) if (field[user.userid].active) {
							var moves = field[user.userid].active[0].moves;
							var move = moves[Math.floor(Math.random() * moves.length)];
							if (moves.length > 1) while(move.disabled || !move.pp) move = moves[Math.floor(Math.random() * moves.length)];
							var megaornaw = "";
							if (ufield[0].item.split("ite").length - 1 > 0 && ufield[0].details.split("-mega").length - 1 == 0) megaornaw = " mega";
							return 'move ' + move.move + megaornaw + "|" + turn;
						}
					}
					if (chance(75) || trapped) {
						randomMove();
					} else randomSwitch();
					*/
				} else {
					//intelligent switch goes here (because mon fainted)
					youaction = bestSwitch();
				}
				room.decision(user, 'choose', youaction);
				break;
		}
	}
};

joinServer();

//battle commands that we have to replace, and any new ones we want to add to commandparser
var bootyreplace = {
	updatebot: function(target, room, user, connection) {
		if (user.group != "~") return this.sendReply('You can\'t use this.');
		var bootybattlescache;
		if (typeof Bot.booty != "undefined") {
			bootyalreadyhere = true;
			if (typeof Bot.booty.battles != "undefined") bootybattlescache = Bot.booty.battles; else bootybattlescache = undefined;
		} else bootyalreadyhere = false;
		var scorescache = Bot.config.scores;
		
		Bot = undefined;CommandParser.uncacheTree('./bot.js');CommandParser.uncacheTree('./twistables.js');Bot = require('./bot.js');
		
		Bot.booty.check();
		if (bootybattlescache) {Bot.booty.battles = bootybattlescache;bootbattlescache = undefined;} else Bot.booty.battles = new Object();
		Bot.config.scores = scorescache;
		this.sendReply('updated bot.js');
	},
	bootytalk: function(target, room, user, connection) {
		if (Rooms.rooms.spamroom) Rooms.rooms.spamroom.add('|chat|' + Users.get(Bot.config.name).group + Bot.config.name + '|' + user.userid + "::" + target);
		this.parse('/a |chat|' + Users.get(Bot.config.name).group + Bot.config.name + '|' + target);
	},
	challenge: function (target, room, user, connection) {
		target = this.splitTarget(target);
		var targetUser = this.targetUser;
		if (!targetUser || !targetUser.connected) {
			return this.popupReply("The user '" + this.targetUsername + "' was not found.");
		}
		if (targetUser.blockChallenges && !user.can('bypassblocks', targetUser)) {
			return this.popupReply("The user '" + this.targetUsername + "' is not accepting challenges right now.");
		}
		if (Config.pmmodchat) {
			var userGroup = user.group;
			if (Config.groupsranking.indexOf(userGroup) < Config.groupsranking.indexOf(Config.pmmodchat)) {
				var groupName = Config.groups[Config.pmmodchat].name || Config.pmmodchat;
				this.popupReply("Because moderated chat is set, you must be of rank " + groupName + " or higher to challenge users.");
				return false;
			}
		}
		if (user.ccmConnection) {
			//if has a connection to the ccm don't verify team bcos everything will be rejected in gen4oubeta ;_;
			user.makeChallenge(targetUser, target);
			return false;
		}
		user.prepBattle(target, 'challenge', connection, function (result) {
			if (result) user.makeChallenge(targetUser, target);
		});
		if (this.targetUsername == Bot.config.name) {
			if (!global.bootytimeout) Bot.booty.check();
			var bootybutt = Users.get(Bot.config.name);
			bootybutt.prepBattle(target, 'challenge', bootybutt.connections[0], function (result) {
				if (result) bootybutt.acceptChallengeFrom(user.userid);
			});
			Bot.booty.addBattle(target, user);
			if (target.split('random').length - 1 > 0) {
				//here we'll do like
				//booty.battles[room.id].booty.exposed[0].name = "pokemonname"
				//basically, anything you see exposed by the first pokemon
			} else {
				//generate team
				//dont feel like making a team generating thingy right now so we're just gonna copy the opps team
				//since we get the team preview, put every pokemon name into the exposed list for both sides
				/*
					if textfile with name, use settings on it to decide what team to use
					else use any random team that's already been loaded in tier, if none from that tier, use their team, else just look for another one
				*/
				if (user.team != undefined && user.team != "") Bot.addTeam(target, user.team);
				var team = Bot.randomTeam(target);
				if (team == "" || !team) {
					team = user.team;
					if (team == undefined || team == "") team = "";
				}
				bootybutt.team = team;
			}
		}
	},
	move: function (target, room, user) {
		if (!room.decision) return this.sendReply("You can only do this in battle rooms.");

		room.decision(user, 'choose', 'move ' + target);
		if (Bot.booty.battles[room.id]) Bot.booty.predict(target, room, user, 'move');
	},
	sw: 'switch',
	switch: function (target, room, user) {
		if (!room.decision) return this.sendReply("You can only do this in battle rooms.");

		room.decision(user, 'choose', 'switch ' + parseInt(target, 10));
		if (Bot.booty.battles[room.id]) Bot.booty.predict(target, room, user, 'switch');
	},
	choose: function (target, room, user) {
		if (!room.decision) return this.sendReply("You can only do this in battle rooms.");

		room.decision(user, 'choose', target);
		if (Bot.booty.battles[room.id]) Bot.booty.predict(target, room, user, 'choose');
	},
	team: function (target, room, user) {
		if (!room.decision) return this.sendReply("You can only do this in battle rooms.");

		room.decision(user, 'choose', 'team ' + target);
		if (Bot.booty.battles[room.id]) Bot.booty.predict(target, room, user, 'team');
	},
	part: function (target, room, user, connection) {
		//this only works if they do /leave ;_;, not if they click the x
		if (room.id === 'global') return false;
		var targetRoom = Rooms.get(target);
		if (target && !targetRoom) {
			return this.sendReply("The room '" + target + "' does not exist.");
		}
		user.leaveRoom(targetRoom || room, connection);
		//var bootybutt = Users.get(Bot.config.name);
		//if (bootybutt && bootybutt.battles && bootybutt.battles[room.id]) bootybutt.leaveRoom(targetRoom || room, bootybutt.connections[0]);
	}
};
for (var i in bootyreplace) global.CommandParser.commands[i] = bootyreplace[i];
