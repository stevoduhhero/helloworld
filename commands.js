/**
 * System commands
 * Pokemon Showdown - http://pokemonshowdown.com/
 *
 * These are system commands - commands required for Pokemon Showdown
 * to run. A lot of these are sent by the client.
 *
 * If you'd like to modify commands, please go to config/commands.js,
 * which also teaches you how to use commands.
 *
 * @license MIT license
 */

var crypto = require('crypto');
var fs = require('fs');

const MAX_REASON_LENGTH = 300;
setTimeout(function() {
	trivia = require('./trivia.js').trivia((typeof trivia == "undefined") ? undefined : trivia);
	hangman = require('./hangman.js').hangman((typeof hangman == "undefined") ? undefined : hangman);
	Clans = require('./clans.js');
	dice = require('./casino.js').dice;
}, 3000);

/* psmmo */
var mmoObj = function() {
	var parts = {
		emit: function(map, stringy, exception, noloop) {
			for (var uid in this.users) {
				var user = Users.get(uid),
					mmoConnections;
				if (user) {
					for (var i in user.connections) {
						var connection = user.connections[i];
						if (!connection.mmo) continue;
						mmoConnections = true;
						if (this.users[uid].map != map) continue;
						if (exception && user.userid == exception) break;
						if (connection && connection.send) connection.send(stringy);
					}
				}
				if (!mmoConnections && !noloop) this.disconnectPlayer(uid);
			}
		},
		disconnectPlayer: function(uid) {
			if (!this.users[uid]) return;
			this.emit(this.users[uid].map, '|e|' + uid, uid, true);
			delete this.users[uid];
		},
		playersList: function(map) {
			var buff = '';
			for (var uid in this.users) {
				var user = this.users[uid];
				if (user.map != map) continue;
				buff += user.x + '[' + user.y + '[' + user.name + ']';
			}
			buff = buff.slice(0, -1);
			return buff;
		},
		newPlayer: function(user, map, connection) {
			if (this.users[user.userid]) this.disconnectPlayer(user.userid); //disconnect from old map
			connection.mmo = true;
			connection.send('|players|' + this.playersList(map));
			this.users[user.userid] = {
				x: -1, //starting position
				y: -1, //starting position
				map: map,
				name: user.name
			};
			this.emit(map, '|newPlayer|' + user.name);
		},
	};
	if (typeof mmo == "undefined") mmo = new Object();
	for (var i in parts) mmo[i] = parts[i];
	return mmo;
};
var replaceUsers;
if (typeof mmo == "undefined") replaceUsers = true;
mmo = mmoObj();
if (replaceUsers) mmo.users = new Object();

setTimeout(function() {
	commands.start = function(target, room, user, connection, cmd, message) {
		mmo.newPlayer(user, target, connection);
	};
	commands.mmo = function(target, room, user, connection, cmd, message) {
		var tar = target.split('.');
		var e = toId(tar[0]);
		if (e == "start") {
			var dirs = {left: 1, up: 1, down: 1, right: 1};
			var dir = ((dirs[tar[1]]) ? tar[1] : false);
			if (!dir) return;
			var u = mmo.users[user.userid];
			mmo.emit(u.map, '|m|' + user.userid + '|' + dir, user.userid);
		} else if (e == "stop") {
			var x = Math.floor(tar[1]),
				y = Math.floor(tar[2]),
				u = mmo.users[user.userid];
			if (isNaN(x) || isNaN(y)) return;
			u.x = x;
			u.y = y;
			mmo.emit(u.map, '|s|' + user.userid + '|' + x + '|' + y, user.userid);
		} else if (e == "msg") {
			var u = mmo.users[user.userid];
			if (!u || !u.map) return;
			tar.splice(0, 1);
			tar.join('.');
			mmo.emit(u.map, '|b|' + user.userid + '|' + tar);
		} else if (e == "catchpokemon") {
			var pokemon = user.encounterMons[tar[1]];
			if (!pokemon) return;
			connection.send('|cp|' + pokemon);
		} else if (e == "encounter") {
			if (!user.encounterMons) user.encounterMons = new Object();
			var minimumLevel = 0,
				encounteredMon = "";
			if (tar.length - 1 > 0) {
				minimumLevel = Math.abs(tar[2]);
				encounteredMon = tar[1];
			}
			if (Tools.data.Pokedex[encounteredMon] && !isNaN(minimumLevel)) {
				var pokemon = Tools.data.Pokedex[encounteredMon];
				var ability = Math.floor(Math.random() * Object.keys(pokemon.abilities).length),
					moves = new Array(),
					level = Math.floor(Math.random() * 5) + minimumLevel,
					hasMove = new Object(),
					hasAttackingMove = false,
					learnset = Tools.data.Learnsets[encounteredMon].learnset;
				for (var i in learnset) {
					var move = Tools.data.Movedex[i];
					var whenLearned = learnset[i];
					var canLearnNow = false;
					if (whenLearned.length) {
						for (var x in whenLearned) {
							var learnByLevel = whenLearned[x].split('L');
							if (learnByLevel.length - 1 > 0) {
								var levelLearned = Math.abs(learnByLevel[1]);
								if (!isNaN(levelLearned) && (levelLearned <= level)) {
									//if levelLearned is a number && if we meet the level requirements to learn said move
									canLearnNow = true;
								}
								if (whenLearned[x].slice(-1) == "a") {
									//learns as soon as its born (start move)
									canLearnNow = true;
								}
							}
						}
					}
					if (!hasMove[move] && canLearnNow) {
						if (moves.length == 3 && move.category == "Status" && !hasAttackingMove) {} else {
							moves.push(move.name);
							hasMove[move.name] = true;
							if (move.category != "Status") hasAttackingMove = true;
						}
					}
					if (moves.length == 4) break;
				}
				var shinyRate = 1 / 1000;
				function chance(percent) {
					var random = Math.floor(Math.random() * 100) + 1;
					if (random > percent) return false;
					return true;
				}
				//the pokemon will be the minimumLevel  + or - 5
				var natureKeys = ["Adamant", "Bashful", "Bold", "Brave", "Calm", "Careful", "Docile", "Gentle", "Hardy", "Hasty", "Impish", "Jolly", "Lax", "Lonely", "Mild", "Modest", "Naive", "Naughty", "Quiet", "Quirky", "Rash", "Relaxed", "Sassy", "Serious", "Timid"];
				var team = [{
					species: pokemon.species,
					nature: natureKeys[Math.floor(Math.random() * natureKeys.length)],
					ability: pokemon.abilities[Object.keys(pokemon.abilities)[ability]],
					level: level,
					moves: moves,
					shiny: ((chance(shinyRate * 100)) ? true : false)
				}];
				var tier = "psmmo",
					packagedMon = Tools.packTeam(team);
				Bot.booty.addBattle(tier, user);
				Rooms.global.startBattle(user, Users.get(Bot.config.name), tier, user.team, packagedMon);
				user.encounterMons[encounteredMon] = packagedMon;
				shop.giveMoney(user.name, 0.1, connection);
			}
		}
	};
}, 1000)

if (typeof shop == "undefined") setTimeout(function() {shop = require('./shop.js').shop;}, 3000);
/*--------------
	nightclub
  --------------*/
urlify = function(str) {return str.replace(/(https?\:\/\/[a-z0-9-.]+(\/([^\s]*[^\s?.,])?)?|[a-z0-9]([a-z0-9-\.]*[a-z0-9])?\.(com|org|net|edu|tk)((\/([^\s]*[^\s?.,])?)?|\b))/ig, '<a href="$1" target="_blank">$1</a>').replace(/<a href="([a-z]*[^a-z:])/g, '<a href="http://$1').replace(/(\bgoogle ?\[([^\]<]+)\])/ig, '<a href="http://www.google.com/search?ie=UTF-8&q=$2" target="_blank">$1</a>').replace(/(\bgl ?\[([^\]<]+)\])/ig, '<a href="http://www.google.com/search?ie=UTF-8&btnI&q=$2" target="_blank">$1</a>').replace(/(\bwiki ?\[([^\]<]+)\])/ig, '<a href="http://en.wikipedia.org/w/index.php?title=Special:Search&search=$2" target="_blank">$1</a>').replace(/\[\[([^< ]([^<`]*?[^< ])?)\]\]/ig, '<a href="http://www.google.com/search?ie=UTF-8&btnI&q=$1" target="_blank">$1</a>');}
nightclub = new Object();
function colorify(given_text){
	var sofar = "";
	var splitting = given_text.split("");
	var text_length = given_text.length;
	var colorification = true;
	var beginningofend = false;
	for (var i in splitting) {
		if (splitting[i] == "<" && splitting[i + 1] != "/") {
			//open tag <>
			colorification = false;
		}
		if (splitting[i] == "/" && splitting[i -  1] == "<") {
			//closing tag </>
			//find exact spot
			beginningofend = i;
		}
		if (beginningofend && splitting[i - 1] == ">") {
			colorification = true;
			beginningofend = false;
		}
		var letters = 'ABCDE'.split('');
		var color = "";
		for (var f = 0; f < 6; f++) {
			color += letters[Math.floor(Math.random() * letters.length)];
		}
		if (colorification) {
			if (splitting[i] == " ") sofar += " "; else sofar += "<font color='" + "#" + color + "'>" + splitting[i] + "</font>";
		} else sofar += splitting[i];

	}
	return sofar;
}
 
function colorify_absolute(given_text){
	var sofar = "";
	var splitting = given_text.split("");
	var text_length = given_text.length;
	for (i = 0; i < text_length; i++) {
		var color = (Math.random()*(0xFFFFFF+1)<<0).toString(16);
		if (splitting[i] == " ") sofar += " "; else sofar += "<font color='" + "#" + color + "'>" + splitting[i] + "</font>";
	}
	return sofar;
}
nightclubify = colorify;
/*--------------
	demfeels
  --------------*/
demfeels = ["batming","blu","china","coo","creep","cry","dad1","dad2","dafuq","datass","dazza1","dd","deal","dealw","disgust","drow","duckwat","duclol","Dx","eleming","evild","excite","falone","feel","feelsal","feelsbd","feelsbeard","feelsbn","feelsbr","feelsbu","feelscanada","feelsce","feelscommy","feelscr","feelscute","feelsdd","feelsde","feelsdr","feelsduke","feelseye","feelsgd","feelsgn","feelsgt","feelshitler","feelshp","feelshr","feelsht","feelsjew","feelsmario","feelsmd","feelsmoke","feelsms","feelsmug","feelsnv","feelsok","feelsold","feelspink","feelsq","feelsrs","feelssc","feelsscr","feelssp","feelsusa","feelsvp","feelswg","feelswp","feelsws","feelsww","feelszb","fliptbl","foreveralone","fuu","fuu2","fuumar","fyeah","g","goatse","gtfo","hellyeah","hface","hipnig","hmm","how","how3","how4","kid1","ling","lolnig","man","maybe","megusta","ming","mit","mit3","mit4","mog","nface","nface2","nggawat","nggwat","nicetit","nigcook","nigcry","nigglet","nighuh","nigig","niglad","nigleaf","niglol","nigmar","nigmonk","nignig","nignod","nigoof","nigrin","nigwho","nigya","ning","no","nomegusta","notbad","notsure","ohgod","okay","okay2","omd","omg","oshit","pedo","pface","pff","pirate","pirate2","santa","santrl","seewat","serious","sir","smellsgd","smugob","srs","srsno","taylor","ting","trldrum","trlfing","trollface","w","wat","who","win1","wtf","wtf2","wut","xa","XD","xd2","xe","yay","yds","yeayou","yes","yface","yuno","2cute","ahuevo","aing","alakno","allfeel","awd","babed","fukya",/* these are all the crappy new emotes pixieworld has added */"fakesloth","banana","cottonball","cottoncandy","craydada","daavey2","dada","dada1","davey","davey1","davey3","david","dogie","garde","garde1","garde2","garde3","garde4","lolli","mvlution","mvlution1","nyan","ohyeah","osha","pika","pika2","pix","pixie","pixie1","stevo","swalot","sylveon","sylveon1","sylveon2","sylveon3","sylveon4","sylveon5","sylveon6","troll","windy","windy1","windy2","windy3","windy4","pyon","cortex"];
/*--------------
	spamroom
  --------------*/
if (typeof spamroom == "undefined") spamroom = new Object();
if (!Rooms.rooms.spamroom) {
	Rooms.rooms.spamroom = new Rooms.ChatRoom("spamroom", "spamroom");
	Rooms.rooms.spamroom.staffRoom = true;
	Rooms.rooms.spamroom.isPrivate = true;
}
/*--------------
	top10
  --------------*/
if (typeof top10obj == "undefined") top10obj = new Object();
top10 = function() {
	//check for changes
	//if changes make image
	if (typeof http == "undefined") http = require("http");
	if (typeof url == "undefined") url = require('url');
	var llaves = Object.keys(leaderboard);
	var backwards = new Array();
	for (var i = llaves.length - 1; i > -1; i--) backwards.push(llaves[i]);
	var counter = 0;
	var maximo = 10;
	var ppl = new Object();
	var datastring = "";
	for (var i in backwards) {
		var rating = backwards[i];
		var names = leaderboard[rating];
		for (var name in names) {
			if (counter == maximo) break;
			if (ppl[name]) {
				//name is already there
				//try to fix
				delete leaderboard[rating][name];
			} else {
				ppl[name] = rating;
				datastring += name + "[" + rating + "]";
				counter++;
			}
		}
	}
	var top10changed = false;
	if (JSON.stringify(Object.keys(top10obj)) != JSON.stringify(Object.keys(ppl))) top10changed = true;
	if (top10changed) top10obj = ppl;
	if (top10changed) {
		//maybe make it so that it says who was removed, who went on it
		//user moved up a place and is now ahead of user at no. 1 (same users, different order)
		//user replaced user at no. 1 (different users)
		var req = http.get(url.parse('http://localhost/leaderboard.php?top10=' + datastring), function (res) {
			var buffer = '';
			res.setEncoding('utf8');
			res.on('data', function (chunk) {
				buffer += chunk;
			});
			res.on('end', function () {
				var data = null;
				try {
					data = parseJSON(buffer);
				} catch (e) {}
				//callback(data, res.statusCode);
				//this.openRequests--;
				Rooms.rooms.lobby.addRaw('<img src="http://elloworld.noip.me/leaderboard.jpg?t=' + (new Date() / 1) + '" align="left" />');//update line
			});
		});
		req.on('error', function (error) {
			//callback(null, null, error);
			//this.openRequests--;
		});
		req.end();
		fs.writeFile('leaderboard.txt', JSON.stringify(leaderboard));
	}
};
if (typeof leaderboard == "undefined") {
	leaderboard = new Object();
	fs.readFile('leaderboard.txt', function(err, data) {
		if (err) return;
		data = ('' + data);
		leaderboard = JSON.parse(data);
	});
}
var announcement = "";
fs.readFile('./announcement.html', function(err, data) {
	if (err) return;
	data = ('' + data).split("\n").join("");
	announcement = data;
});

var broadcast = {
	url: ""
};

var commands = exports.commands = {
					//bot
					feels: function() {
						if (!this.canBroadcast()) return;
						this.sendReply("feels -> https://github.com/stevoduhhero/datfeels");
					},
					
					scoreboard: 'scores',
					scores: function(target, room, user) {
						if (!this.canBroadcast()) return;
						var scores = new Object();
						for (var i in gamesConfig.scores) if (scores[gamesConfig.scores[i]]) scores[gamesConfig.scores[i]].push(i); else scores[gamesConfig.scores[i]] = [i];
						var stringy = "";
						for (var i in scores) {
							var score = i;
							var people = scores[i].join('');
							stringy += score + "pts=" + people + " || ";
						}
						this.sendReply(stringy);
					},
					
					twist: function(target, room, user) {
						if (!this.canBroadcast()) return;
						if (!user.can('broadcast')) return this.sendReply('You don\'t have enough auth to use this command.');
						if (gamesConfig.rebusswitch == true) return this.sendReply('do !twist off to play this first');
						if (target == "on") {
							gamesConfig.twistswitch = true;
							gamesConfig.scores = new Object();
						}
						if (target == "off") gamesConfig.twistswitch = false;
						gamesConfig.newTwist(room);
					},
					
					'guessthemovie': '4pics',
					'gtmovie': '4pics',
					'gtm': '4pics',
					'4pics1word': '4pics',
					'4pics': function(target, room, user, connection, cmd, message) {
						if (!this.canBroadcast()) return;
						if (!user.can('broadcast')) return this.sendReply('You don\'t have enough auth to use this command.');
						if (gamesConfig.twistswitch == true) return this.sendReply('do !twist off to play this first');
						gamesConfig.status4pics1word = false;
						gamesConfig.gtmRevealAnswerUrl = "";
						if (target == "on") {
							gamesConfig.rebusswitch = true;
							if (cmd == "4pics1word" || cmd == "4pics") gamesConfig.status4pics1word = true;
						}
						if (target == "off") gamesConfig.rebusswitch = false;
						var funk = "newRebus";
						if (cmd == "gtm" || cmd == "gtmovie" || cmd == "guessthemovie") funk = "newGTM";
						gamesConfig[funk](room);
					},
					rebus: function(target, room, user, connection, cmd, message) {
						if (!this.canBroadcast()) return;
						if (!user.can('broadcast')) return this.sendReply('You don\'t have enough auth to use this command.');
						if (gamesConfig.twistswitch == true) return this.sendReply('do !twist off to play this first');
						gamesConfig.status4pics1word = false;
						gamesConfig.gtmRevealAnswerUrl = "";
						if (target == "on") {
							gamesConfig.rebusswitch = true;
						}
						if (target == "off") gamesConfig.rebusswitch = false;
						gamesConfig.newRebus(room);
					},
					
					hint: function(target, room, user) {
						if (!this.can('broadcast')) return;
						if (!gamesConfig.twisting) this.sendReply('No words are being twisted.');
						var stringy = new Array();
						var can = new Array();
						for (var i in gamesConfig.hints) if (!gamesConfig.hints[i]) {stringy.push(" _ ");can.push(i);} else stringy.push(gamesConfig.hints[i]);
						var ran = can[Math.floor(Math.random() * can.length)];
						gamesConfig.hints[ran] = gamesConfig.twisting[ran];
						if (!gamesConfig.hints[ran]) gamesConfig.hints[ran] = "";
						gamesConfig.hints[ran] = gamesConfig.hints[ran].toUpperCase();
						stringy[ran] = gamesConfig.hints[ran];
						this.sendReply('HINT: "' + stringy.join('') + '"');
						if (!can.length) {
							//all hints given, game done bcos no one could guess it
						}
					},
					
	clearall: function (target, room, user) {
        if (!this.can('clearall')) return;
        var len = room.log.length,
            users = [];
        while (len--) {
            room.log[len] = '';
        }
        for (var user in room.users) {
            users.push(user);
            Users.get(user).leaveRoom(room, Users.get(user).connections[0]);
        }
        len = users.length;
        setTimeout(function() {
            while (len--) {
                Users.get(users[len]).joinRoom(room, Users.get(users[len]).connections[0]);
            }
        }, 1000);
    },
    ud: 'urbandefine',
    urbandefine: function (target, room, user) {
				if (typeof request == "undefined") request = require('request');
        if (!this.canBroadcast()) return;
        if (!target) return this.parse('/help urbandefine')
        if (target > 50) return this.sendReply('Phrase can not be longer than 50 characters.');

        var self = this;
        var options = {
            url: 'http://www.urbandictionary.com/iphone/search/define',
            term: target,
            headers: {
                'Referer': 'http://m.urbandictionary.com'
            },
            qs: {
                'term': target
            }
        };

        function callback(error, response, body) {
            if (!error && response.statusCode == 200) {
                var page = JSON.parse(body);
                var definitions = page['list'];
                if (page['result_type'] == 'no_results') {
                    self.sendReplyBox('No results for <b>"' + Tools.escapeHTML(target) + '"</b>.');
                    return room.update();
                } else {
                    if (!definitions[0]['word'] || !definitions[0]['definition']) {
                        self.sendReplyBox('No results for <b>"' + Tools.escapeHTML(target) + '"</b>.');
                        return room.update();
                    }
                    var output = '<b>' + Tools.escapeHTML(definitions[0]['word']) + ':</b> ' + Tools.escapeHTML(definitions[0]['definition']).replace(/\r\n/g, '<br />').replace(/\n/g, ' ');
                    if (output.length > 400) output = output.slice(0, 400) + '...';
                    self.sendReplyBox(output);
                    return room.update();
                }
            }
        }
        request(options, callback);
    },

    def: 'define',
    define: function (target, room, user) {
				if (typeof request == "undefined") request = require('request');
        if (!this.canBroadcast()) return;
        if (!target) return this.parse('/help define');
        target = toId(target);
        if (target > 50) return this.sendReply('Word can not be longer than 50 characters.');

        var self = this;
        var options = {
            url: 'http://api.wordnik.com:80/v4/word.json/' + target + '/definitions?limit=3&sourceDictionaries=all' +
                '&useCanonical=false&includeTags=false&api_key=a2a73e7b926c924fad7001ca3111acd55af2ffabf50eb4ae5',
        };

        function callback(error, response, body) {
            if (!error && response.statusCode == 200) {
                var page = JSON.parse(body);
                var output = '<font color="blueviolet"><b>Definitions for ' + target + ':</b></font><br />';
                if (!page[0]) {
                    self.sendReplyBox('No results for <b>"' + target + '"</b>.');
                    return room.update();
                } else {
                    var count = 1;
                    for (var u in page) {
                        if (count > 3) break;
                        output += '(' + count + ') ' + page[u]['text'] + '<br />';
                        count++;
                    }
                    self.sendReplyBox(output);
                    return room.update();
                }
            }
        }
        request(options, callback);
    },

	update: function(target, room, user) {
		if (!this.can('hotpatch')) return false;
		
		this.parse('/hotpatch chat');
		this.parse('/updateshop');
		//this.parse('/tour update');
		this.parse('/updatebot');
		return this.sendReply("Updated chat commands, booty-bot, the shop, and stevies tour scripts.");
	},
	broadcast: function(target, room, user, connection, cmd, message) {
		var videoid = target.split("?v=");
		if (videoid.length - 1 == 0) return false;
		videoid = videoid[1].substr(0, 11);
		if (videoid.length != 11) return false;
		var url = "http://youtube.com/embed/" + videoid + "?autoplay=1";
		broadcast.url = url;
		room.addRaw("For those of you on the <a href='http://elloworld.noip.me/client/' target='_BLANK'>custom client</a>, " + user.name + " just broadcasted " + target + ". OK? OK.");
		for (var i in room.users) if (room.users[i].customClient) for (var x in room.users[i].connections) room.users[i].connections[x].send('|broadcast|' + url);
	},
	customclient: function(target, room, user, connection, cmd, message) {
		user.customClient = true;
		if (broadcast.url) for (var i in user.connections) user.connections[i].send('|broadcast|' + broadcast.url);
	},
	customclients: 'ccs',
	cccount: 'ccs',
	ccs: function(target, room, user, connection, cmd, message) {
		var insides = '';
		var count = 0;
		for (var i in room.users) {
			if (room.users[i].customClient) {
				insides += room.users[i].name + ", ";
				count++;
			}
		}
		this.sendReply('|raw|<b>Custom Client Users:</b> ' + insides + '<br /><b>Users on custom client:</b> ' + count);
	},
	announcement: function(target, room, user, connection, cmd, message) {
		if (!user.hasConsoleAccess(connection)) {
				return this.sendReply('Access denied.');
		}
		if (!target) return this.sendReply(announcement);
		announcement = target;
		fs.writeFile('./announcement.html', target);
		this.sendReply('Announcement updated.');
	},
	debug: function (target, room, user, connection, cmd, message) {
			if (!user.hasConsoleAccess(connection)) {
					return this.sendReply('/debug - Access denied.');
			}
			if (!this.canBroadcast()) return;

			if (!this.broadcasting) this.sendReply('||>> ' + target);
			try {
					var battle = room.battle;
					var me = user;
					if (target.indexOf('-h') >= 0 || target.indexOf('-help') >= 0) {
							return this.sendReplyBox('This is a custom eval made by CreaturePhil for easier debugging.<br/>' +
									'<b>-h</b> OR <b>-help</b>: show all options<br/>' +
									'<b>-k</b>: object.keys of objects<br/>' +
									'<b>-r</b>: reads a file<br/>' +
									'<b>-p</b>: returns the current high-resolution real time in a second and nanoseconds. This is for speed/performance tests.');
					}
					if (target.indexOf('-k') >= 0) {
							target = 'Object.keys(' + target.split('-k ')[1] + ');';
					}
					if (target.indexOf('-r') >= 0) {
							this.sendReply('||<< Reading... ' + target.split('-r ')[1]);
							return this.popupReply(eval('fs.readFileSync("' + target.split('-r ')[1] + '","utf-8");'));
					}
					if (target.indexOf('-p') >= 0) {
							target = 'var time = process.hrtime();' + target.split('-p')[1] + 'var diff = process.hrtime(time);this.sendReply("|raw|<b>High-Resolution Real Time Benchmark:</b><br/>"+"Seconds: "+(diff[0] + diff[1] * 1e-9)+"<br/>Nanoseconds: " + (diff[0] * 1e9 + diff[1]));';
					}
					this.sendReply('||<< ' + eval(target));
			} catch (e) {
					this.sendReply('||<< error: ' + e.message);
					var stack = '||' + ('' + e.stack).replace(/\n/g, '\n||');
					connection.sendTo(room, stack);
			}
	},
	img: function(target, room, user, connection) {
		if (!this.can('broadcast')) return this.sendReply('YOU cant use this command because of phil >.>');
		if (user === Users.get("creaturephil")) return false;
		target = target.split(',');
		var extra = "",
			url = target[0].split('"').join(''),
			w = toId(target[1]) || "25%",
			h = toId(target[2]) || "";
		if (target.length == 1) {
			target.push(w);
			target.push(h);
		}
		if (target[1].split('%').length - 1 > 0 && h.split('%').length - 1 == 0) w += "%";
		if (target[2] && target[2].split('%').length - 1 > 0 && h.split('%').length - 1 == 0) h += "%";
		extra += " width='" + w + "'";
		extra += " height='" + h + "'";
		room.addRaw(user.name + ': <img src="' + url + '"' + extra + ' />');
	},
	/*--------------
		nightclub
	  --------------*/
	nightclub: function(target, room, user, connection) {
		if (!this.can('broadcast')) return this.sendReply('You must at least be voice in order to force us all to be disco dancing freakazoids.');
		if (nightclub[room.id]) return this.sendReply('This room is already engulfed in nightclubness.');
		nightclub[room.id] = true;
		room.addRaw('<div class="nightclub"><font size=6>' + nightclubify('LETS GET FITZY!! nightclub mode: ON!!!') + '</font><font size="2"> started by: ' + user.userid + '</font></div>');
	},
	dayclub: function(target, room, user, connection) {
		if (!this.can('broadcast')) return this.sendReply('You must at least be voice in order to force us all to stop dancin\'.');
		if (!nightclub[room.id]) return this.sendReply('This room is already in broad daylight.');
		delete nightclub[room.id];
		room.addRaw('<div class="nightclub"><font size=6>' + nightclubify('sizzle down now... nightclub mode: off.') + '</font><font size="2"> ended by: ' + user.userid + '</font></font>');
	},
	/*--------------
		spamroom
	  --------------*/
	tv: 'spamroom',
	tvroom: 'spamroom',
	spam: 'spamroom',
	spammer: 'spamroom',
	spamroom: function(target, room, user, connection, cmd) {
		var target = this.splitTarget(target);
		var targetUser = this.targetUser;
		if (!targetUser || !targetUser.connected) {
			return this.sendReply('The user \'' + this.targetUsername + '\' does not exist.');
		}
		if (!this.can('mute', targetUser)) {
			return false;
		}
		if (spamroom[targetUser]) {
			return this.sendReply('That user\'s messages are already being redirected to the spamroom.');
		}
		var val = true;
		if (cmd == "tv" || cmd == "tvroom") val = "tvroom";
		spamroom[targetUser] = val;
		
		Rooms.rooms[((val == "tvroom") ? "tvroom" : 'spamroom')].add('|raw|<b>' + this.targetUsername + ' was added to the spamroom list.</b>');
		if (val != "tvroom") this.logModCommand(targetUser + ' was added to spamroom by ' + user.name);
		return this.sendReply(this.targetUsername + ' was successfully added to the spamroom list.');
	},

	untv: 'unspamroom',
	untvroom: 'unspamroom',
	unspam: 'unspamroom',
	unspammer: 'unspamroom',
	unspamroom: function(target, room, user, connection, cmd) {
		var target = this.splitTarget(target);
		var targetUser = this.targetUser;
		if (!targetUser || !targetUser.connected) {
			return this.sendReply('The user \'' + this.targetUsername + '\' does not exist.');
		}
		if (!this.can('mute', targetUser)) {
			return false;
		}
		if (!spamroom[targetUser]) {
			return this.sendReply('That user is not in the spamroom list.');
		}
		for(var u in spamroom) if(targetUser == Users.get(u)) delete spamroom[u];
		Rooms.rooms[((cmd == "untvroom" || cmd == "untv") ? "tvroom" : 'spamroom')].add('|raw|<b>' + this.targetUsername + ' was removed from the spamroom list.</b>');
		if (cmd == "untv" || cmd == "untvroom") this.logModCommand(targetUser + ' was removed from spamroom by ' + user.name);
		return this.sendReply(this.targetUsername + ' and their alts were successfully removed from the spamroom list.');
	},
	
	prayers: function(target, room, user) {
		if (user.group == "~") this.parse('/debug -r prayers.txt');
	},
	
    mimi: 'afk',
    mimis: 'afk',
    away: 'afk',
    asleep: 'afk',
    sleep: 'afk',
    gaming: 'afk',
    busy: 'afk',
    afk: function(target, room, user, connection, cmd) {
        if (!this.canTalk()) return;
        if (user.name.length > 18) return this.sendReply('Your username exceeds the length limit.');
        if (!user.isAway) {
            user.originalName = user.name;
            switch (cmd) {
				case 'mimis':
				case 'mimi':
                case 'sleep':
					cmd = 'going mimis';
                    var awayName = user.name + ' - ⓂⒾⓂⒾⓈ';
                    break;
                case 'gaming':
                    var awayName = user.name + ' - ⒼⒶⓂⒾⓃⒼ';
                    break;
                case 'busy':
                    var awayName = user.name + ' - Ⓑⓤⓢⓨ';
                    break;
                default:
                    var awayName = user.name + ' - Ⓐⓦⓐⓨ';
            }
            //delete the user object with the new name in case it exists - if it does it can cause issues with forceRename
            delete Users.get(awayName);
            user.forceRename(awayName, undefined, true);
            user.isAway = true;
            if (!(!this.can('broadcast'))) {
                var color = hashColor('' + toId(user.originalName) + '');
                if (user.userid == 'panpawn') color = '#DA9D01';
                this.add('|raw|<b>--</b> <button class="astext" name="parseCommand" value="/user ' + user.name + '" target="_blank"><b><font color="' + color + '">' + user.originalName + '</font></b></button> is now ' + cmd + '. ' + (target ? " (" + Tools.escapeHTML(target) + ")" : ""));
            }
        } else {
            return this.sendReply('You are already set as away, type /back if you are now back.');
        }
    },

    back: function(target, room, user, connection) {
        if (!this.canTalk()) return;
        if (user.isAway) {
            if (user.name === user.originalName) {
                user.isAway = false;
                return this.sendReply('Your name has been left unaltered and no longer marked as away.');
            }
            var newName = user.originalName;
            //delete the user object with the new name in case it exists - if it does it can cause issues with forceRename
            delete Users.get(newName);
            user.forceRename(newName, undefined, true);
            //user will be authenticated
            user.authenticated = true;
            user.isAway = false;
            if (!(!this.can('broadcast'))) {
                var color = hashColor('' + toId(user.name) + '');
                if (user.userid == 'panpawn') color = '#DA9D01';
                this.add('|raw|<b>--</b> <button class="astext" name="parseCommand" value="/user ' + user.name + '" target="_blank"><b><font color="' + color + '">' + newName + '</font></b></button> is no longer away.');
                user.originalName = '';
            }
        } else {
            return this.sendReply('You are not set as away.');
        }
        user.updateIdentity();
    },

	poof: 'd',
	d: function(target, room, user) {
		if (room.id !== 'lobby') return false;
		var btags = '<strong><font color=' + hashColor(Math.random().toString()) + '" >';
		var etags = '</font></strong>'
		var targetid = toId(user);
		if (!user.muted && target) {
			var tar = toId(target);
			var targetUser = Users.get(tar);
			if (user.can('poof', targetUser)) {
				if (!targetUser) {
					user.emit('console', 'Cannot find user ' + target + '.', socket);
				} else {
					Rooms.rooms.lobby.addRaw(btags + '~~ ' + targetUser.name + ' was slaughtered by ' + user.name + '! ~~' + etags);
					targetUser.disconnectAll();
					return this.logModCommand(targetUser.name + ' was poofed by ' + user.name);
				}
			} else {
				return this.sendReply('/poof target - Access denied.');
			}
		}
		if (!user.muted && !user.locked) {
			Rooms.rooms.lobby.addRaw(btags + getRandMessage(user) + etags);
			user.disconnectAll();
		} else {
			return this.sendReply('poof is currently disabled.');
		}
	},
	
	/*********************************************************
	 * Clan commands
	 *********************************************************/

	clanhelp: function () {
		if (!this.canBroadcast()) return false;
		this.sendReplyBox(
			"Basic Commands<br />" +
			"/clan [clan name] - Shows the clans info.<br />" +
			"/clans - Shows all the info of every registered clan.<br />" +
			"Administrative Commands<br />" +
			"/createclan &lt;name> - Creates a clan.<br />" +
			"/removeclan &lt;name> - Removes a clan.<br />" +
			"/addmember &lt;clan>, &lt;user> - adds a member to the clan.<br />" +
			"/removemember &lt;clan>, &lt;user> - removes a member from the clan.<br />" +
			"Clan War Commands<br />" +
			"/clanavailable - Marks you as available to participate in a clan match.<br />" +
			"/createwar &lt;clan 1>, &lt;clan 2> - Starts a war between two clans.<br />" +
			"/endwar &lt;clan> - Forces a clan war to end.<br />" +
			"/clanbattles &lt;clan> - Shows a list of clan battles that have not started.<br />"
		);
	},
	
	addclan: 'createclan',
	createclan: function (target) {
		if (!this.can('clans')) return false;
		if (target.length < 2)
			this.sendReply("Clan name is too short.");
		else if (!Clans.createClan(target))
			this.sendReply("It isn't possible to create a clan with that name. A clan may exist with this name?");
		else
			this.sendReply("The clan \"" + target + "\" has been created.");
	},
	
	removeclan: 'deleteclan',
	deleteclan: function (target) {
		if (!this.can('clans')) return false;
		if (!Clans.deleteClan(target))
			this.sendReply("The clan was not deleted. Is the clan in a war?");
		else
			this.sendReply("The clan \"" + target + "\" has been deleted.");
	},

	clan: 'getclans',
	clans: 'getclans',
	getclan: 'getclans',
	getclans: function (target) {
		if (!this.canBroadcast()) return false;

		var clan = Clans.getRating(target);
		if (!clan) {
			target = Clans.findClanFromMember(target);
			if (target)
				clan = Clans.getRating(target);
		}
		if (!clan) {
			this.sendReplyBox(
				"<strong>Clans:</strong><br />" +
				Clans.getClans().map(function (clan) {
					var result = Clans.getRating(clan);
					result.name = clan;
					return result;
				}).sort(function (a, b) {
					return b.rating - a.rating;
				}).map(function (clan) {
					return '<strong>' + Tools.escapeHTML(clan.name) + ':</strong> ' + clan.ratingName + " (" + clan.rating + ") " + clan.wins + "/" + clan.losses + "/" + clan.draws;
				}).join('<br />')
			);
			return;
		}

		this.sendReplyBox(
			'<h3>' + Tools.escapeHTML(Clans.getClanName(target)) + '</h3><hr />' +
			"<strong>Ranking:</strong> " + clan.ratingName + "<br />" +
			"<strong>Points:</strong> " + clan.rating + "<br />" +
			"<strong>Victories: " + clan.wins + " / Losses: " + clan.losses + " / Ties: " + clan.draws + '<br />' +
			"<strong>Members:</strong> " + Tools.escapeHTML(Clans.getMembers(target).sort().join(", "))
		);
	},

	addmember: function (target) {
		if (!this.can('clans')) return false;
		var params = target.split(',');
		if (params.length !== 2) return this.sendReply("Parameters: /addmember clan name, user name");

		var user = Users.getExact(params[1]);
		if (!user || !user.connected) return this.sendReply("User: " + params[1] + " is not online.");

		if (!Clans.addMember(params[0], params[1]))
			this.sendReply("Could not add the user to the clan. Does the clan exist or is the user already in another clan?");
		else {
			this.sendReply("User: " + user.name + " successfully added to the clan.");
			Rooms.rooms.lobby.add('|raw|<div class="clans-user-join">' + Tools.escapeHTML(user.name) + " has joined the clan: " + Tools.escapeHTML(Clans.getClanName(params[0])) + '</div>');
		}
	},
	
	deletemember: 'removemember',
	removemember: function (target) {
		if (!this.can('clans')) return false;
		var params = target.split(',');
		if (params.length !== 2) return this.sendReply("Parameters: /removemember clan name, user name");

		if (!Clans.removeMember(params[0], params[1]))
			this.sendReply("Could not remove the user from the clan. Does the clan exist or has the user already been removed from it?");
		else {
			this.sendReply("User: " + params[1] + " successfully removed from the clan.");
			Rooms.rooms.lobby.add('|raw|<div class="clans-user-join">' + Tools.escapeHTML(params[1]) + " has left the clan: " + Tools.escapeHTML(Clans.getClanName(params[0])) + '</div>');
		}
	},

	clanavailable: function (target, room, user) {
		user.isClanWarAvailable = Date.now();
		this.sendReply("You're now accepting war battles.");
	},

	createwar: function (target, room) {
		if (!this.can('clans')) return false;
		var params = target.split(',');
		if (params.length !== 2) return this.sendReply("Parameters: /createwar clan 1, clan 2");

		var matchups = Clans.startWar(params[0], params[1], room);
		if (!matchups) return this.sendReply("War could not be started. All participants must have used /clanavailable.");

		room.add('|raw|' +
			"<div class=\"clans-war-start\">Clan War between " + Tools.escapeHTML(Clans.getClanName(params[0])) + " and " + Tools.escapeHTML(Clans.getClanName(params[1])) + " has started!</div>" +
			Object.keys(matchups).map(function (m) { return "<strong>" + Tools.escapeHTML(matchups[m].from) + "</strong> VS <strong>" + Tools.escapeHTML(matchups[m].to); }).join('<br />')
		);
	},

	endwar: function (target) {
		if (!this.can('clans')) return false;
		var war = Clans.findWarFromClan(target);
		if (!war) return this.sendReply("This clan has no existing war, perhaps it finished?");

		var room = Clans.getWarRoom(target);
		Clans.endWar(target);
		room.add("|raw|<div class=\"clans-war-end\">The clan war between " + Tools.escapeHTML(war[0]) + " and " + Tools.escapeHTML(war[1]) + " has been terminated.</div>");
		this.sendReply("Clan war ended.");
	},

	clanbattles: function (target) {
		if (!this.canBroadcast()) return false;
		var war = Clans.findWarFromClan(target);
		if (!war) return this.sendReply("The clan war does not exist.");

		var matchups = Clans.getWarMatchups(target);
		this.sendReplyBox(
			"<strong>Clan war matchups between " + Tools.escapeHTML(war[0]) + " and " + Tools.escapeHTML(war[1]) + ':</strong><br />' +
			Object.keys(matchups).map(function (m) { return matchups[m].isEnded ? "" : '<strong>' + Tools.escapeHTML(matchups[m].from) + "</strong> vs <strong>" + Tools.escapeHTML(matchups[m].to); }).join('<br />')
		);
	},

	/*--------------
		normal commands
	  --------------*/
	version: function (target, room, user) {
		if (!this.canBroadcast()) return;
		this.sendReplyBox("Server version: <b>" + CommandParser.package.version + "</b>");
	},

	me: function (target, room, user, connection) {
		// By default, /me allows a blank message
		if (target) target = this.canTalk(target);
		if (!target) return;

		return '/me ' + target;
	},

	mee: function (target, room, user, connection) {
		// By default, /mee allows a blank message
		if (target) target = this.canTalk(target);
		if (!target) return;

		return '/mee ' + target;
	},

	avatar: function (target, room, user) {
		if (!target) return this.parse('/avatars');
		var parts = target.split(',');
		var avatar = parseInt(parts[0]);
		if (!avatar || avatar > 294 || avatar < 1) {
			if (!parts[1]) {
				this.sendReply("Invalid avatar.");
			}
			return false;
		}

		user.avatar = avatar;
		if (!parts[1]) {
			this.sendReply("Avatar changed to:\n" +
				'|raw|<img src="//play.pokemonshowdown.com/sprites/trainers/' + avatar + '.png" alt="" width="80" height="80" />');
		}
	},

	logout: function (target, room, user) {
		user.resetName();
	},

	requesthelp: 'report',
	report: function (target, room, user) {
		this.sendReply("Use the Help room.");
	},

	r: 'reply',
	reply: function (target, room, user) {
		if (!target) return this.parse('/help reply');
		if (!user.lastPM) {
			return this.sendReply("No one has PMed you yet.");
		}
		return this.parse('/msg ' + (user.lastPM || '') + ', ' + target);
	},

	pm: 'msg',
	tell: 'msg',
	whisper: 'msg',
	w: 'msg',
	msg: function (target, room, user, connection) {
		if (!target) return this.parse('/help msg');
		target = this.splitTarget(target);
		var targetUser = this.targetUser;
		if (!target) {
			this.sendReply("You forgot the comma.");
			return this.parse('/help msg');
		}
        	// offline messaging
		if (!targetUser || !targetUser.connected) {
		    if (user.locked) return this.popupReply("User " + this.targetUsername + " is currently offline. You may not send offline messages when locked.");
		    if (target.length > 255) return this.popupReply("User " + this.targetUsername + " is currently offline. Your message is too long to be sent " +
		        "as an offline message (>255 characters).");
		
		    if (Config.tellrank === 'autoconfirmed' && !user.autoconfirmed) {
		        return this.popupReply("You must be autoconfirmed to send an offline message.");
		    } else if (!Config.tellrank || Config.groupsranking.indexOf(user.group) < Config.groupsranking.indexOf(Config.tellrank)) {
		        return this.popupReply("User " + this.targetUsername + " is currently offline. You cannot send an offline message because offline messaging is " +
		            (!Config.tellrank ? "disabled" : "only available to users of rank " + Config.tellrank + " and above") + ".");
		    }
		
		    var userid = toId(this.targetUsername);
		    if (userid.length > 18) return this.popupReply("\"" + this.targetUsername + "\" is not a legal username.");
		
		    var sendSuccess = Tells.addTell(user, userid, target);
		    if (!sendSuccess) {
		        if (sendSuccess === false) return this.popupReply("User " + this.targetUsername + " has too many offline messages queued.");
		        else return this.popupReply("You have too many outgoing offline messages queued. Please wait until some have been received or have expired.");
		    }
		    return connection.send('|pm|' + user.getIdentity() + '|' + ' ' + this.targetUsername + "|/text This user is currently offline. Your message will be delivered when they are next online.");
		}
        	/*
		if (!targetUser || !targetUser.connected) {
			if (targetUser && !targetUser.connected) {
				this.popupReply("User " + this.targetUsername + " is offline.");
			} else if (!target) {
				this.popupReply("User " + this.targetUsername + " not found. Did you forget a comma?");
			} else {
				this.popupReply("User "  + this.targetUsername + " not found. Did you misspell their name?");
			}
			return this.parse('/help msg');
		}
		*/

		if (Config.pmmodchat) {
			var userGroup = user.group;
			if (Config.groupsranking.indexOf(userGroup) < Config.groupsranking.indexOf(Config.pmmodchat)) {
				var groupName = Config.groups[Config.pmmodchat].name || Config.pmmodchat;
				this.popupReply("Because moderated chat is set, you must be of rank " + groupName + " or higher to PM users.");
				return false;
			}
		}

		if (user.locked && !targetUser.can('lock')) {
			return this.popupReply("You can only private message members of the moderation team (users marked by %, @, &, or ~) when locked.");
		}
		if (targetUser.locked && !user.can('lock')) {
			return this.popupReply("This user is locked and cannot PM.");
		}
		if (targetUser.ignorePMs && targetUser.ignorePMs !== user.group && !user.can('lock')) {
			if (!targetUser.can('lock')) {
				return this.popupReply("This user is blocking private messages right now.");
			} else if (targetUser.can('bypassall')) {
				return this.popupReply("This admin is too busy to answer private messages right now. Please contact a different staff member.");
			}
		}
		if (user.ignorePMs && user.ignorePMs !== targetUser.group && !targetUser.can('lock')) {
			return this.popupReply("You are blocking private messages right now.");
		}

		target = this.canTalk(target, null);
		if (!target) return false;

		if (target.charAt(0) === '/' && target.charAt(1) !== '/') {
			// PM command
			var innerCmdIndex = target.indexOf(' ');
			var innerCmd = (innerCmdIndex >= 0 ? target.slice(1, innerCmdIndex) : target.slice(1));
			var innerTarget = (innerCmdIndex >= 0 ? target.slice(innerCmdIndex + 1) : '');
			switch (innerCmd) {
			case 'me':
			case 'mee':
			case 'announce':
				break;
			case 'invite':
			case 'inv':
				var targetRoom = Rooms.search(innerTarget);
				if (!targetRoom || targetRoom === Rooms.global) return connection.send('|pm|' + user.getIdentity() + '|' + targetUser.getIdentity() + '|/text The room "' + innerTarget + '" does not exist.');
				if (targetRoom.staffRoom && !targetUser.isStaff) return connection.send('|pm|' + user.getIdentity() + '|' + targetUser.getIdentity() + '|/text User "' + this.targetUsername + '" requires global auth to join room "' + targetRoom.id + '".');
				if (targetRoom.isPrivate === true && targetRoom.modjoin && targetRoom.auth) {
					if (Config.groupsranking.indexOf(targetRoom.auth[targetUser.userid] || ' ') < Config.groupsranking.indexOf(targetRoom.modjoin) && !targetUser.can('bypassall')) {
						return connection.send('|pm|' + user.getIdentity() + '|' + targetUser.getIdentity() + '|/text The room "' + innerTarget + '" does not exist.');
					}
				}

				target = '/invite ' + targetRoom.id;
				break;
			default:
				return connection.send('|pm|' + user.getIdentity() + '|' + targetUser.getIdentity() + "|/text The command '/" + innerCmd + "' was unrecognized or unavailable in private messages. To send a message starting with '/" + innerCmd + "', type '//" + innerCmd + "'.");
			}
		}

		var message = '|pm|' + user.getIdentity() + '|' + targetUser.getIdentity() + '|' + target;
		user.send(message);
		if (targetUser !== user) targetUser.send(message);
		targetUser.lastPM = user.userid;
		user.lastPM = targetUser.userid;
	},

	blockpm: 'ignorepms',
	blockpms: 'ignorepms',
	ignorepm: 'ignorepms',
	ignorepms: function (target, room, user) {
		if (user.ignorePMs === (target || true)) return this.sendReply("You are already blocking private messages!");
		if (user.can('lock') && !user.can('bypassall')) return this.sendReply("You are not allowed to block private messages.");
		user.ignorePMs = true;
		if (target in Config.groups) {
			user.ignorePMs = target;
			return this.sendReply("You are now blocking private messages, except from staff and " + target + ".");
		}
		return this.sendReply("You are now blocking private messages, except from staff.");
	},

	unblockpm: 'unignorepms',
	unblockpms: 'unignorepms',
	unignorepm: 'unignorepms',
	unignorepms: function (target, room, user) {
		if (!user.ignorePMs) return this.sendReply("You are not blocking private messages!");
		user.ignorePMs = false;
		return this.sendReply("You are no longer blocking private messages.");
	},

	makechatroom: function (target, room, user) {
		if (!this.can('makeroom')) return;

		// `,` is a delimiter used by a lot of /commands
		// `|` and `[` are delimiters used by the protocol
		// `-` has special meaning in roomids
		if (target.indexOf(',') >= 0 || target.indexOf('|') >= 0 || target.indexOf('[') >= 0 || target.indexOf('-') >= 0) {
			return this.sendReply("Room titles can't contain any of: ,|[-");
		}

		var id = toId(target);
		if (!id) return this.parse('/help makechatroom');
		if (Rooms.rooms[id]) return this.sendReply("The room '" + target + "' already exists.");
		if (Rooms.global.addChatRoom(target)) {
			return this.sendReply("The room '" + target + "' was created.");
		}
		return this.sendReply("An error occurred while trying to create the room '" + target + "'.");
	},

	deregisterchatroom: function (target, room, user) {
		if (!this.can('makeroom')) return;
		var id = toId(target);
		if (!id) return this.parse('/help deregisterchatroom');
		var targetRoom = Rooms.search(id);
		if (!targetRoom) return this.sendReply("The room '" + target + "' doesn't exist.");
		target = targetRoom.title || targetRoom.id;
		if (Rooms.global.deregisterChatRoom(id)) {
			this.sendReply("The room '" + target + "' was deregistered.");
			this.sendReply("It will be deleted as of the next server restart.");
			return;
		}
		return this.sendReply("The room '" + target + "' isn't registered.");
	},

	hideroom: 'privateroom',
	hiddenroom: 'privateroom',
	privateroom: function (target, room, user, connection, cmd) {
		var setting;
		switch (cmd) {
		case 'privateroom':
			if (!this.can('makeroom')) return;
			setting = true;
			break;
		default:
			if (!this.can('privateroom', null, room)) return;
			if (room.isPrivate === true) {
				if (this.can('makeroom'))
					this.sendReply("This room is a secret room. Use /privateroom to toggle instead.");
				return;
			}
			setting = 'hidden';
			break;
		}

		if (target === 'off') {
			delete room.isPrivate;
			this.addModCommand("" + user.name + " made this room public.");
			if (room.chatRoomData) {
				delete room.chatRoomData.isPrivate;
				Rooms.global.writeChatRoomData();
			}
			if (room.type === 'chat') {
				if (Rooms.global.chatRooms.indexOf(room) < 0) {
					Rooms.global.chatRooms.push(room);
				}
			}
		} else {
			room.isPrivate = setting;
			this.addModCommand("" + user.name + " made this room " + (setting === true ? 'secret' : setting) + ".");
			if (room.chatRoomData) {
				room.chatRoomData.isPrivate = setting;
				Rooms.global.writeChatRoomData();
			}
		}
	},

	modjoin: function (target, room, user) {
		if (!this.can('privateroom', null, room)) return;
		if (target === 'off' || target === 'false') {
			delete room.modjoin;
			this.addModCommand("" + user.name + " turned off modjoin.");
			if (room.chatRoomData) {
				delete room.chatRoomData.modjoin;
				Rooms.global.writeChatRoomData();
			}
		} else {
			if ((target === 'on' || target === 'true' || !target) || !user.can('privateroom')) {
				room.modjoin = true;
				this.addModCommand("" + user.name + " turned on modjoin.");
			} else if (target in Config.groups) {
				room.modjoin = target;
				this.addModCommand("" + user.name + " set modjoin to " + target + ".");
			} else {
				this.sendReply("Unrecognized modjoin setting.");
				return false;
			}
			if (room.chatRoomData) {
				room.chatRoomData.modjoin = room.modjoin;
				Rooms.global.writeChatRoomData();
			}
			if (!room.modchat) this.parse('/modchat ' + Config.groupsranking[1]);
			if (!room.isPrivate) this.parse('/hiddenroom');
		}
	},

	officialchatroom: 'officialroom',
	officialroom: function (target, room, user) {
		if (!this.can('makeroom')) return;
		if (!room.chatRoomData) {
			return this.sendReply("/officialroom - This room can't be made official");
		}
		if (target === 'off') {
			delete room.isOfficial;
			this.addModCommand("" + user.name + " made this chat room unofficial.");
			delete room.chatRoomData.isOfficial;
			Rooms.global.writeChatRoomData();
		} else {
			room.isOfficial = true;
			this.addModCommand("" + user.name + " made this chat room official.");
			room.chatRoomData.isOfficial = true;
			Rooms.global.writeChatRoomData();
		}
	},

	roomdesc: function (target, room, user) {
		if (!target) {
			if (!this.canBroadcast()) return;
			var re = /(https?:\/\/(([-\w\.]+)+(:\d+)?(\/([\w/_\.]*(\?\S+)?)?)?))/g;
			if (!room.desc) return this.sendReply("This room does not have a description set.");
			this.sendReplyBox("The room description is: " + room.desc.replace(re, '<a href="$1">$1</a>'));
			return;
		}
		if (!this.can('declare')) return false;
		if (target.length > 80) return this.sendReply("Error: Room description is too long (must be at most 80 characters).");
		var normalizedTarget = ' ' + target.toLowerCase().replace('[^a-zA-Z0-9]+', ' ').trim() + ' ';

		if (normalizedTarget.indexOf(' welcome ') >= 0) {
			return this.sendReply("Error: Room description must not contain the word 'welcome'.");
		}
		if (normalizedTarget.slice(0, 9) === ' discuss ') {
			return this.sendReply("Error: Room description must not start with the word 'discuss'.");
		}
		if (normalizedTarget.slice(0, 12) === ' talk about ' || normalizedTarget.slice(0, 17) === ' talk here about ') {
			return this.sendReply("Error: Room description must not start with the phrase 'talk about'.");
		}

		room.desc = target;
		this.sendReply("(The room description is now: " + target + ")");

		this.privateModCommand("(" + user.name + " changed the roomdesc to: \"" + target + "\".)");

		if (room.chatRoomData) {
			room.chatRoomData.desc = room.desc;
			Rooms.global.writeChatRoomData();
		}
	},

	topic: 'roomintro',
	roomintro: function (target, room, user) {
		if (!target) {
			if (!this.canBroadcast()) return;
			if (!room.introMessage) return this.sendReply("This room does not have an introduction set.");
			this.sendReplyBox(room.introMessage);
			if (!this.broadcasting && user.can('declare', null, room)) {
				this.sendReply('Source:');
				this.sendReplyBox('<code>' + Tools.escapeHTML(room.introMessage) + '</code>');
			}
			return;
		}
		if (!this.can('declare', null, room)) return false;
		if (!this.canHTML(target)) return;
		if (!/</.test(target)) {
			// not HTML, do some simple URL linking
			var re = /(https?:\/\/(([-\w\.]+)+(:\d+)?(\/([\w/_\.]*(\?\S+)?)?)?))/g;
			target = target.replace(re, '<a href="$1">$1</a>');
		}

		if (!target.trim()) target = '';
		room.introMessage = target;
		this.sendReply("(The room introduction has been changed to:)");
		this.sendReplyBox(target);

		this.privateModCommand("(" + user.name + " changed the roomintro.)");

		if (room.chatRoomData) {
			room.chatRoomData.introMessage = room.introMessage;
			Rooms.global.writeChatRoomData();
		}
	},

	roomalias: function (target, room, user) {
		if (!room.chatRoomData) return this.sendReply("This room isn't designed for aliases.");
		if (!target) {
			if (!room.chatRoomData.aliases || !room.chatRoomData.aliases.length) return this.sendReplyBox("This room does not have any aliases.");
			return this.sendReplyBox("This room has the following aliases: " + room.chatRoomData.aliases.join(", ") + "");
		}
		if (!this.can('setalias')) return false;
		var alias = toId(target);
		if (!alias.length) return this.sendReply("Only alphanumeric characters are valid in an alias.");
		if (Rooms.get(alias) || Rooms.aliases[alias]) return this.sendReply("You cannot set an alias to an existing room or alias.");

		this.privateModCommand("(" + user.name + " added the room alias '" + target + "'.)");

		if (!room.chatRoomData.aliases) room.chatRoomData.aliases = [];
		room.chatRoomData.aliases.push(alias);
		Rooms.aliases[alias] = room;
		Rooms.global.writeChatRoomData();
	},

	removeroomalias: function (target, room, user) {
		if (!room.chatRoomData) return this.sendReply("This room isn't designed for aliases.");
		if (!room.chatRoomData.aliases) return this.sendReply("This room does not have any aliases.");
		if (!this.can('setalias')) return false;
		var alias = toId(target);
		if (!alias.length || !Rooms.aliases[alias]) return this.sendReply("Please specify an existing alias.");
		if (Rooms.aliases[alias] !== room) return this.sendReply("You may only remove an alias from the current room.");

		this.privateModCommand("(" + user.name + " removed the room alias '" + target + "'.)");

		var aliasIndex = room.chatRoomData.aliases.indexOf(alias);
		if (aliasIndex >= 0) {
			room.chatRoomData.aliases.splice(aliasIndex, 1);
			delete Rooms.aliases[alias];
			Rooms.global.writeChatRoomData();
		}
	},

	roomowner: function (target, room, user) {
		if (!room.chatRoomData) {
			return this.sendReply("/roomowner - This room isn't designed for per-room moderation to be added");
		}
		target = this.splitTarget(target, true);
		var targetUser = this.targetUser;

		if (!targetUser) return this.sendReply("User '" + this.targetUsername + "' is not online.");

		if (!this.can('makeroom', targetUser, room)) return false;

		if (!room.auth) room.auth = room.chatRoomData.auth = {};

		var name = targetUser.name;

		room.auth[targetUser.userid] = '#';
		this.addModCommand("" + name + " was appointed Room Owner by " + user.name + ".");
		room.onUpdateIdentity(targetUser);
		Rooms.global.writeChatRoomData();
	},

	roomdeowner: 'deroomowner',
	deroomowner: function (target, room, user) {
		if (!room.auth) {
			return this.sendReply("/roomdeowner - This room isn't designed for per-room moderation");
		}
		target = this.splitTarget(target, true);
		var targetUser = this.targetUser;
		var name = this.targetUsername;
		var userid = toId(name);
		if (!userid || userid === '') return this.sendReply("User '" + name + "' does not exist.");

		if (room.auth[userid] !== '#') return this.sendReply("User '" + name + "' is not a room owner.");
		if (!this.can('makeroom', null, room)) return false;

		delete room.auth[userid];
		this.sendReply("(" + name + " is no longer Room Owner.)");
		if (targetUser) targetUser.updateIdentity();
		if (room.chatRoomData) {
			Rooms.global.writeChatRoomData();
		}
	},

	roomdemote: 'roompromote',
	roompromote: function (target, room, user, connection, cmd) {
		if (!room.auth) {
			this.sendReply("/roompromote - This room isn't designed for per-room moderation");
			return this.sendReply("Before setting room mods, you need to set it up with /roomowner");
		}
		if (!target) return this.parse('/help roompromote');

		target = this.splitTarget(target, true);
		var targetUser = this.targetUser;
		var userid = toId(this.targetUsername);
		var name = targetUser ? targetUser.name : this.targetUsername;

		if (!userid) return this.parse('/help roompromote');
		if (!targetUser && (!room.auth || !room.auth[userid])) {
			return this.sendReply("User '" + name + "' is offline and unauthed, and so can't be promoted.");
		}

		var currentGroup = ((room.auth && room.auth[userid]) || ' ')[0];
		var nextGroup = target || Users.getNextGroupSymbol(currentGroup, cmd === 'roomdemote', true);
		if (target === 'deauth') nextGroup = Config.groupsranking[0];
		if (!Config.groups[nextGroup]) {
			return this.sendReply("Group '" + nextGroup + "' does not exist.");
		}

		if (Config.groups[nextGroup].globalonly) {
			return this.sendReply("Group 'room" + Config.groups[nextGroup].id + "' does not exist as a room rank.");
		}

		var groupName = Config.groups[nextGroup].name || "regular user";
		if (currentGroup === nextGroup) {
			return this.sendReply("User '" + name + "' is already a " + groupName + " in this room.");
		}
		if (currentGroup !== ' ' && !user.can('room' + (Config.groups[currentGroup] ? Config.groups[currentGroup].id : 'voice'), null, room)) {
			return this.sendReply("/" + cmd + " - Access denied for promoting from " + (Config.groups[currentGroup] ? Config.groups[currentGroup].name : "an undefined group") + ".");
		}
		if (nextGroup !== ' ' && !user.can('room' + Config.groups[nextGroup].id, null, room)) {
			return this.sendReply("/" + cmd + " - Access denied for promoting to " + Config.groups[nextGroup].name + ".");
		}

		if (nextGroup === ' ') {
			delete room.auth[userid];
		} else {
			room.auth[userid] = nextGroup;
		}

		if (Config.groups[nextGroup].rank < Config.groups[currentGroup].rank) {
			this.privateModCommand("(" + name + " was demoted to Room " + groupName + " by " + user.name + ".)");
			if (targetUser && Rooms.rooms[room.id].users[targetUser.userid]) targetUser.popup("You were demoted to Room " + groupName + " by " + user.name + ".");
		} else if (nextGroup === '#') {
			this.addModCommand("" + name + " was promoted to " + groupName + " by " + user.name + ".");
		} else {
			this.addModCommand("" + name + " was promoted to Room " + groupName + " by " + user.name + ".");
		}

		if (targetUser) targetUser.updateIdentity(room.id);
		if (room.chatRoomData) Rooms.global.writeChatRoomData();
	},

	roomauth: function (target, room, user, connection) {
		var targetRoom = room;
		if (target) targetRoom = Rooms.search(target);
		if (!targetRoom || (targetRoom !== room && targetRoom.modjoin && !user.can('bypassall'))) return this.sendReply("The room '" + target + "' does not exist.");
		if (!targetRoom.auth) return this.sendReply("/roomauth - The room '" + (targetRoom.title ? targetRoom.title : target) + "' isn't designed for per-room moderation and therefore has no auth list.");

		var rankLists = {};
		for (var u in targetRoom.auth) {
			if (!rankLists[targetRoom.auth[u]]) rankLists[targetRoom.auth[u]] = [];
			rankLists[targetRoom.auth[u]].push(u);
		}

		var buffer = [];
		Object.keys(rankLists).sort(function (a, b) {
			return (Config.groups[b] || {rank:0}).rank - (Config.groups[a] || {rank:0}).rank;
		}).forEach(function (r) {
			buffer.push((Config.groups[r] ? Config.groups[r] .name + "s (" + r + ")" : r) + ":\n" + rankLists[r].sort().join(", "));
		});

		if (!buffer.length) {
			connection.popup("The room '" + targetRoom.title + "' has no auth.");
			return;
		}
		if (targetRoom !== room) buffer.unshift("" + targetRoom.title + " room auth:");
		connection.popup(buffer.join("\n\n"));
	},

	userauth: function (target, room, user, connection) {
		var targetId = toId(target) || user.userid;
		var targetUser = Users.getExact(targetId);
		var targetUsername = (targetUser ? targetUser.name : target);

		var buffer = [];
		var innerBuffer = [];
		var group = Users.usergroups[targetId];
		if (group) {
			buffer.push('Global auth: ' + group.charAt(0));
		}
		for (var i = 0; i < Rooms.global.chatRooms.length; i++) {
			var curRoom = Rooms.global.chatRooms[i];
			if (!curRoom.auth || curRoom.isPrivate) continue;
			group = curRoom.auth[targetId];
			if (!group) continue;
			innerBuffer.push(group + curRoom.id);
		}
		if (innerBuffer.length) {
			buffer.push('Room auth: ' + innerBuffer.join(', '));
		}
		if (targetId === user.userid || user.can('makeroom')) {
			innerBuffer = [];
			for (var id in Rooms.rooms) {
				var curRoom = Rooms.rooms[id];
				if (!curRoom.auth || !curRoom.isPrivate) continue;
				var auth = curRoom.auth[targetId];
				if (!auth) continue;
				innerBuffer.push(auth + curRoom.id);
			}
			if (innerBuffer.length) {
				buffer.push('Private room auth: ' + innerBuffer.join(', '));
			}
		}
		if (!buffer.length) {
			buffer.push("No global or room auth.");
		}

		buffer.unshift("" + targetUsername + " user auth:");
		connection.popup(buffer.join("\n\n"));
	},

	rb: 'roomban',
	roomban: function (target, room, user, connection) {
		if (!target) return this.parse('/help roomban');
		if ((user.locked || user.mutedRooms[room.id]) && !user.can('bypassall')) return this.sendReply("You cannot do this while unable to talk.");

		target = this.splitTarget(target, true);
		var targetUser = this.targetUser;
		var name = this.targetUsername;
		var userid = toId(name);

		if (!userid || !targetUser) return this.sendReply("User '" + name + "' does not exist.");
		if (!this.can('ban', targetUser, room)) return false;
		if (!room.bannedUsers || !room.bannedIps) {
			return this.sendReply("Room bans are not meant to be used in room " + room.id + ".");
		}
		if (room.bannedUsers[userid] && room.bannedIps[targetUser.latestIp]) return this.sendReply("User " + targetUser.name + " is already banned from room " + room.id + ".");
		targetUser.popup("" + user.name + " has banned you from the room " + room.id + "." + (target ? "\n\nReason: " + target + ""  : "") + "\n\nTo appeal the ban, PM the staff member that banned you or a room owner. If you are unsure who the room owners are, type this into any room: /roomauth " + room.id);
		this.addModCommand("" + targetUser.name + " was banned from room " + room.id + " by " + user.name + "." + (target ? " (" + target + ")" : ""));
		var alts = room.roomBan(targetUser);
		if (alts.length) {
			this.privateModCommand("(" + targetUser.name + "'s alts were also banned from room " + room.id + ": " + alts.join(", ") + ")");
			for (var i = 0; i < alts.length; ++i) {
				this.add('|unlink|' + toId(alts[i]));
			}
		}
		this.add('|unlink|' + this.getLastIdOf(targetUser));
	},

	unroomban: 'roomunban',
	roomunban: function (target, room, user, connection) {
		if (!target) return this.parse('/help roomunban');
		if (!room.bannedUsers || !room.bannedIps) {
			return this.sendReply("Room bans are not meant to be used in room " + room.id + ".");
		}
		if ((user.locked || user.mutedRooms[room.id]) && !user.can('bypassall')) return this.sendReply("You cannot do this while unable to talk.");

		this.splitTarget(target, true);
		var targetUser = this.targetUser;
		var userid = room.isRoomBanned(targetUser) || toId(target);

		if (!userid) return this.sendReply("User '" + target + "' is an invalid username.");
		if (!this.can('ban', targetUser, room)) return false;
		var unbannedUserid = room.unRoomBan(userid);
		if (!unbannedUserid) return this.sendReply("User " + userid + " is not banned from room " + room.id + ".");

		if (targetUser) targetUser.popup("" + user.name + " has unbanned you from the room " + room.id + ".");
		this.addModCommand("" + unbannedUserid + " was unbanned from room " + room.id + " by " + user.name + ".");
	},

	autojoin: function (target, room, user, connection) {
		Rooms.global.autojoinRooms(user, connection);
	},

	joim: 'join',
	join: function (target, room, user, connection) {
		if (!target) return false;
		var targetRoom = Rooms.search(target);
		if (!targetRoom) {
			return connection.sendTo(target, "|noinit|nonexistent|The room '" + target + "' does not exist.");
		}
		if (targetRoom.modjoin && !user.can('bypassall')) {
			var userGroup = user.group;
			if (targetRoom.auth) {
				if (targetRoom.isPrivate === true) {
					userGroup = ' ';
				}
				userGroup = targetRoom.auth[user.userid] || userGroup;
			}
			if (Config.groupsranking.indexOf(userGroup) < Config.groupsranking.indexOf(targetRoom.modjoin !== true ? targetRoom.modjoin : targetRoom.modchat)) {
				return connection.sendTo(target, "|noinit|nonexistent|The room '" + target + "' does not exist.");
			}
		}
		if (targetRoom.isPrivate) {
			if (!user.named) {
				return connection.sendTo(target, "|noinit|namerequired|You must have a name in order to join the room '" + target + "'.");
			}
		}

		var joinResult = user.joinRoom(targetRoom, connection);
		if (!joinResult) {
			if (joinResult === null) {
				return connection.sendTo(target, "|noinit|joinfailed|You are banned from the room '" + target + "'.");
			}
			return connection.sendTo(target, "|noinit|joinfailed|You do not have permission to join '" + target + "'.");
		}
	},

	leave: 'part',
	part: function (target, room, user, connection) {
		if (room.id === 'global') return false;
		var targetRoom = Rooms.search(target);
		if (target && !targetRoom) {
			return this.sendReply("The room '" + target + "' does not exist.");
		}
		user.leaveRoom(targetRoom || room, connection);
	},

	/*********************************************************
	 * Moderating: Punishments
	 *********************************************************/

	kick: 'warn',
	k: 'warn',
	warn: function (target, room, user) {
		if (!target) return this.parse('/help warn');
		if ((user.locked || user.mutedRooms[room.id]) && !user.can('bypassall')) return this.sendReply("You cannot do this while unable to talk.");

		target = this.splitTarget(target);
		var targetUser = this.targetUser;
		if (!targetUser || !targetUser.connected) return this.sendReply("User '" + this.targetUsername + "' does not exist.");
		if (room.isPrivate === true && room.auth) {
			return this.sendReply("You can't warn here: This is a privately-owned room not subject to global rules.");
		}
		if (!Rooms.rooms[room.id].users[targetUser.userid]) {
			return this.sendReply("User " + this.targetUsername + " is not in the room " + room.id + ".");
		}
		if (target.length > MAX_REASON_LENGTH) {
			return this.sendReply("The reason is too long. It cannot exceed " + MAX_REASON_LENGTH + " characters.");
		}
		if (!this.can('warn', targetUser, room)) return false;

		this.addModCommand("" + targetUser.name + " was warned by " + user.name + "." + (target ? " (" + target + ")" : ""));
		targetUser.send('|c|~|/warn ' + target);
		this.add('|unlink|' + this.getLastIdOf(targetUser));
	},

	redirect: 'redir',
	redir: function (target, room, user, connection) {
		if (!target) return this.parse('/help redirect');
		if ((user.locked || user.mutedRooms[room.id]) && !user.can('bypassall')) return this.sendReply("You cannot do this while unable to talk.");
		target = this.splitTarget(target);
		var targetUser = this.targetUser;
		var targetRoom = Rooms.search(target);
		if (!targetRoom) {
			return this.sendReply("The room '" + target + "' does not exist.");
		}
		if (!this.can('warn', targetUser, room) || !this.can('warn', targetUser, targetRoom)) return false;
		if (!targetUser || !targetUser.connected) {
			return this.sendReply("User " + this.targetUsername + " not found.");
		}
		if (targetRoom.id === "global") return this.sendReply("Users cannot be redirected to the global room.");
		if (Rooms.rooms[targetRoom.id].users[targetUser.userid]) {
			return this.sendReply("User " + targetUser.name + " is already in the room " + targetRoom.title + "!");
		}
		if (!Rooms.rooms[room.id].users[targetUser.userid]) {
			return this.sendReply("User " + this.targetUsername + " is not in the room " + room.id + ".");
		}
		if (targetUser.joinRoom(targetRoom.id) === false) return this.sendReply("User " + targetUser.name + " could not be joined to room " + targetRoom.title + ". They could be banned from the room.");
		var roomName = (targetRoom.isPrivate) ? "a private room" : "room " + targetRoom.title;
		this.addModCommand("" + targetUser.name + " was redirected to " + roomName + " by " + user.name + ".");
		targetUser.leaveRoom(room);
	},

	m: 'mute',
	mute: function (target, room, user) {
		if (!target) return this.parse('/help mute');
		if ((user.locked || user.mutedRooms[room.id]) && !user.can('bypassall')) return this.sendReply("You cannot do this while unable to talk.");

		target = this.splitTarget(target);
		var targetUser = this.targetUser;
		if (!targetUser) return this.sendReply("User '" + this.targetUsername + "' does not exist.");
		if (target.length > MAX_REASON_LENGTH) {
			return this.sendReply("The reason is too long. It cannot exceed " + MAX_REASON_LENGTH + " characters.");
		}
		if (!this.can('mute', targetUser, room)) return false;
		if (targetUser.mutedRooms[room.id] || targetUser.locked || !targetUser.connected) {
			var problem = " but was already " + (!targetUser.connected ? "offline" : targetUser.locked ? "locked" : "muted");
			if (!target) {
				return this.privateModCommand("(" + targetUser.name + " would be muted by " + user.name + problem + ".)");
			}
			return this.addModCommand("" + targetUser.name + " would be muted by " + user.name + problem + "." + (target ? " (" + target + ")" : ""));
		}

		targetUser.popup("" + user.name + " has muted you for 7 minutes. " + (target ? "\n\nReason: " + target : ""));
		this.addModCommand("" + targetUser.name + " was muted by " + user.name + " for 7 minutes." + (target ? " (" + target + ")" : ""));
		var alts = targetUser.getAlts();
		if (alts.length) this.privateModCommand("(" + targetUser.name + "'s alts were also muted: " + alts.join(", ") + ")");
		this.add('|unlink|' + this.getLastIdOf(targetUser));

		targetUser.mute(room.id, 7 * 60 * 1000);
	},

	hm: 'hourmute',
	hourmute: function (target, room, user) {
		if (!target) return this.parse('/help hourmute');
		if ((user.locked || user.mutedRooms[room.id]) && !user.can('bypassall')) return this.sendReply("You cannot do this while unable to talk.");

		target = this.splitTarget(target);
		var targetUser = this.targetUser;
		if (!targetUser) return this.sendReply("User '" + this.targetUsername + "' does not exist.");
		if (target.length > MAX_REASON_LENGTH) {
			return this.sendReply("The reason is too long. It cannot exceed " + MAX_REASON_LENGTH + " characters.");
		}
		if (!this.can('mute', targetUser, room)) return false;

		if (((targetUser.mutedRooms[room.id] && (targetUser.muteDuration[room.id] || 0) >= 50 * 60 * 1000) || targetUser.locked) && !target) {
			var problem = " but was already " + (!targetUser.connected ? "offline" : targetUser.locked ? "locked" : "muted");
			return this.privateModCommand("(" + targetUser.name + " would be muted by " + user.name + problem + ".)");
		}

		targetUser.popup("" + user.name + " has muted you for 60 minutes. " + (target ? "\n\nReason: " + target : ""));
		this.addModCommand("" + targetUser.name + " was muted by " + user.name + " for 60 minutes." + (target ? " (" + target + ")" : ""));
		var alts = targetUser.getAlts();
		if (alts.length) this.privateModCommand("(" + targetUser.name + "'s alts were also muted: " + alts.join(", ") + ")");
		this.add('|unlink|' + this.getLastIdOf(targetUser));

		targetUser.mute(room.id, 60 * 60 * 1000, true);
	},

	um: 'unmute',
	unmute: function (target, room, user) {
		if (!target) return this.parse('/help unmute');
		if ((user.locked || user.mutedRooms[room.id]) && !user.can('bypassall')) return this.sendReply("You cannot do this while unable to talk.");
		var targetUser = Users.get(target);
		if (!targetUser) return this.sendReply("User '" + target + "' does not exist.");
		if (!this.can('mute', targetUser, room)) return false;

		if (!targetUser.mutedRooms[room.id]) {
			return this.sendReply("" + targetUser.name + " is not muted.");
		}

		this.addModCommand("" + targetUser.name + " was unmuted by " + user.name + ".");

		targetUser.unmute(room.id);
	},

	l: 'lock',
	ipmute: 'lock',
	lock: function (target, room, user) {
		if (!target) return this.parse('/help lock');
		if ((user.locked || user.mutedRooms[room.id]) && !user.can('bypassall')) return this.sendReply("You cannot do this while unable to talk.");

		target = this.splitTarget(target);
		var targetUser = this.targetUser;
		if (!targetUser) return this.sendReply("User '" + this.targetUsername + "' does not exist.");
		if (target.length > MAX_REASON_LENGTH) {
			return this.sendReply("The reason is too long. It cannot exceed " + MAX_REASON_LENGTH + " characters.");
		}
		if (!this.can('lock', targetUser)) return false;

		if ((targetUser.locked || Users.checkBanned(targetUser.latestIp)) && !target) {
			var problem = " but was already " + (targetUser.locked ? "locked" : "banned");
			return this.privateModCommand("(" + targetUser.name + " would be locked by " + user.name + problem + ".)");
		}

		if (targetUser.confirmed) {
			var from = targetUser.deconfirm();
			ResourceMonitor.log("[CrisisMonitor] " + targetUser.name + " was locked by " + user.name + " and demoted from " + from.join(", ") + ".");
		}

		targetUser.popup("" + user.name + " has locked you from talking in chats, battles, and PMing regular users." + (target ? "\n\nReason: " + target : "") + "\n\nIf you feel that your lock was unjustified, you can still PM staff members (%, @, &, and ~) to discuss it" + (Config.appealurl ? " or you can appeal:\n" + Config.appealurl : ".") + "\n\nYour lock will expire in a few days.");

		this.addModCommand("" + targetUser.name + " was locked from talking by " + user.name + "." + (target ? " (" + target + ")" : ""));
		var alts = targetUser.getAlts();
		var acAccount = (targetUser.autoconfirmed !== targetUser.userid && targetUser.autoconfirmed);
		if (alts.length) {
			this.privateModCommand("(" + targetUser.name + "'s " + (acAccount ? " ac account: " + acAccount + ", " : "") + "locked alts: " + alts.join(", ") + ")");
		} else if (acAccount) {
			this.privateModCommand("(" + targetUser.name + "'s ac account: " + acAccount + ")");
		}
		this.add('|unlink|hide|' + this.getLastIdOf(targetUser));

		targetUser.lock();
	},

	unlock: function (target, room, user) {
		if (!target) return this.parse('/help unlock');
		if ((user.locked || user.mutedRooms[room.id]) && !user.can('bypassall')) return this.sendReply("You cannot do this while unable to talk.");
		if (!this.can('lock')) return false;

		var unlocked = Users.unlock(target);

		if (unlocked) {
			var names = Object.keys(unlocked);
			this.addModCommand(names.join(", ") + " " +
				((names.length > 1) ? "were" : "was") +
				" unlocked by " + user.name + ".");
		} else {
			this.sendReply("User '" + target + "' is not locked.");
		}
	},

	b: 'ban',
	ban: function (target, room, user) {
		if (!target) return this.parse('/help ban');
		if ((user.locked || user.mutedRooms[room.id]) && !user.can('bypassall')) return this.sendReply("You cannot do this while unable to talk.");

		target = this.splitTarget(target);
		var targetUser = this.targetUser;
		if (!targetUser) return this.sendReply("User '" + this.targetUsername + "' does not exist.");
		if (target.length > MAX_REASON_LENGTH) {
			return this.sendReply("The reason is too long. It cannot exceed " + MAX_REASON_LENGTH + " characters.");
		}
		if (!this.can('ban', targetUser)) return false;

		if (Users.checkBanned(targetUser.latestIp) && !target && !targetUser.connected) {
			var problem = " but was already banned";
			return this.privateModCommand("(" + targetUser.name + " would be banned by " + user.name + problem + ".)");
		}

		if (targetUser.confirmed) {
			var from = targetUser.deconfirm();
			ResourceMonitor.log("[CrisisMonitor] " + targetUser.name + " was banned by " + user.name + " and demoted from " + from.join(", ") + ".");
		}

		targetUser.popup("" + user.name + " has banned you." + (target ? "\n\nReason: " + target : "") + (Config.appealurl ? "\n\nIf you feel that your ban was unjustified, you can appeal:\n" + Config.appealurl : "") + "\n\nYour ban will expire in a few days.");

		this.addModCommand("" + targetUser.name + " was banned by " + user.name + "." + (target ? " (" + target + ")" : ""), " (" + targetUser.latestIp + ")");
		var alts = targetUser.getAlts();
		var acAccount = (targetUser.autoconfirmed !== targetUser.userid && targetUser.autoconfirmed);
		if (alts.length) {
			this.privateModCommand("(" + targetUser.name + "'s " + (acAccount ? " ac account: " + acAccount + ", " : "") + "banned alts: " + alts.join(", ") + ")");
			for (var i = 0; i < alts.length; ++i) {
				this.add('|unlink|' + toId(alts[i]));
			}
		} else if (acAccount) {
			this.privateModCommand("(" + targetUser.name + "'s ac account: " + acAccount + ")");
		}

		this.add('|unlink|hide|' + this.getLastIdOf(targetUser));
		targetUser.ban();
	},

	unban: function (target, room, user) {
		if (!target) return this.parse('/help unban');
		if ((user.locked || user.mutedRooms[room.id]) && !user.can('bypassall')) return this.sendReply("You cannot do this while unable to talk.");
		if (!this.can('ban')) return false;

		var name = Users.unban(target);

		if (name) {
			this.addModCommand("" + name + " was unbanned by " + user.name + ".");
		} else {
			this.sendReply("User '" + target + "' is not banned.");
		}
	},

	unbanall: function (target, room, user) {
		if (!this.can('rangeban')) return false;
		if ((user.locked || user.mutedRooms[room.id]) && !user.can('bypassall')) return this.sendReply("You cannot do this while unable to talk.");
		// we have to do this the hard way since it's no longer a global
		for (var i in Users.bannedIps) {
			delete Users.bannedIps[i];
		}
		for (var i in Users.lockedIps) {
			delete Users.lockedIps[i];
		}
		this.addModCommand("All bans and locks have been lifted by " + user.name + ".");
	},

	banip: function (target, room, user) {
		if ((user.locked || user.mutedRooms[room.id]) && !user.can('bypassall')) return this.sendReply("You cannot do this while unable to talk.");
		target = target.trim();
		if (!target) {
			return this.parse('/help banip');
		}
		if (!this.can('rangeban')) return false;
		if (Users.bannedIps[target] === '#ipban') return this.sendReply("The IP " + (target.charAt(target.length - 1) === '*' ? "range " : "") + target + " has already been temporarily banned.");

		Users.bannedIps[target] = '#ipban';
		this.addModCommand("" + user.name + " temporarily banned the " + (target.charAt(target.length - 1) === '*' ? "IP range" : "IP") + ": " + target);
	},

	unbanip: function (target, room, user) {
		if ((user.locked || user.mutedRooms[room.id]) && !user.can('bypassall')) return this.sendReply("You cannot do this while unable to talk.");
		target = target.trim();
		if (!target) {
			return this.parse('/help unbanip');
		}
		if (!this.can('rangeban')) return false;
		if (!Users.bannedIps[target]) {
			return this.sendReply("" + target + " is not a banned IP or IP range.");
		}
		delete Users.bannedIps[target];
		this.addModCommand("" + user.name + " unbanned the " + (target.charAt(target.length - 1) === '*' ? "IP range" : "IP") + ": " + target);
	},

	rangelock: function (target, room, user) {
		if ((user.locked || user.mutedRooms[room.id]) && !user.can('bypassall')) return this.sendReply("You cannot do this while unable to talk.");
		if (!target) return this.sendReply("Please specify a range to lock.");
		if (!this.can('rangeban')) return false;

		var isIp = (target.slice(-1) === '*' ? true : false);
		var range = (isIp ? target : Users.shortenHost(target));
		if (Users.lockedRanges[range]) return this.sendReply("The range " + range + " has already been temporarily locked.");

		Users.lockRange(range, isIp);
		this.addModCommand("" + user.name + " temporarily locked the range " + range + ".");
	},

	rangeunlock: function (target, room, user) {
		if ((user.locked || user.mutedRooms[room.id]) && !user.can('bypassall')) return this.sendReply("You cannot do this while unable to talk.");
		if (!target) return this.sendReply("Please specify a range to unlock.");
		if (!this.can('rangeban')) return false;

		var range = (target.slice(-1) === '*' ? target : Users.shortenHost(target));
		if (!Users.lockedRanges[range]) return this.sendReply("The range " + range + " is not locked.");

		Users.unlockRange(range);
		this.addModCommand("" + user.name + " unlocked the range " + range + ".");
	},

	/*********************************************************
	 * Moderating: Other
	 *********************************************************/

	mn: 'modnote',
	modnote: function (target, room, user, connection) {
		if (!target) return this.parse('/help modnote');
		if ((user.locked || user.mutedRooms[room.id]) && !user.can('bypassall')) return this.sendReply("You cannot do this while unable to talk.");

		if (target.length > MAX_REASON_LENGTH) {
			return this.sendReply("The note is too long. It cannot exceed " + MAX_REASON_LENGTH + " characters.");
		}
		if (!this.can('receiveauthmessages', null, room)) return false;
		return this.privateModCommand("(" + user.name + " notes: " + target + ")");
	},

	globaldemote: 'promote',
	globalpromote: 'promote',
	demote: 'promote',
	promote: function (target, room, user, connection, cmd) {
		if (!target) return this.parse('/help promote');

		target = this.splitTarget(target, true);
		var targetUser = this.targetUser;
		var userid = toId(this.targetUsername);
		var name = targetUser ? targetUser.name : this.targetUsername;

		if (!userid) return this.parse('/help promote');

		var currentGroup = ((targetUser && targetUser.group) || Users.usergroups[userid] || ' ')[0];
		var nextGroup = target ? target : Users.getNextGroupSymbol(currentGroup, cmd === 'demote', true);
		if (target === 'deauth') nextGroup = Config.groupsranking[0];
		if (!Config.groups[nextGroup]) {
			return this.sendReply("Group '" + nextGroup + "' does not exist.");
		}
		if (Config.groups[nextGroup].roomonly) {
			return this.sendReply("Group '" + nextGroup + "' does not exist as a global rank.");
		}

		var groupName = Config.groups[nextGroup].name || "regular user";
		if (currentGroup === nextGroup) {
			return this.sendReply("User '" + name + "' is already a " + groupName);
		}
		if (!user.canPromote(currentGroup, nextGroup)) {
			return this.sendReply("/" + cmd + " - Access denied.");
		}

		if (!Users.setOfflineGroup(name, nextGroup)) {
			return this.sendReply("/promote - WARNING: This user is offline and could be unregistered. Use /forcepromote if you're sure you want to risk it.");
		}
		if (Config.groups[nextGroup].rank < Config.groups[currentGroup].rank) {
			this.privateModCommand("(" + name + " was demoted to " + groupName + " by " + user.name + ".)");
			if (targetUser) targetUser.popup("You were demoted to " + groupName + " by " + user.name + ".");
		} else {
			this.addModCommand("" + name + " was promoted to " + groupName + " by " + user.name + ".");
		}

		if (targetUser) targetUser.updateIdentity();
	},

	forcepromote: function (target, room, user) {
		// warning: never document this command in /help
		if (!this.can('forcepromote')) return false;
		target = this.splitTarget(target, true);
		var name = this.targetUsername;
		var nextGroup = target || Users.getNextGroupSymbol(' ', false);
		if (!Config.groups[nextGroup]) return this.sendReply("Group '" + nextGroup + "' does not exist.");

		if (!Users.setOfflineGroup(name, nextGroup, true)) {
			return this.sendReply("/forcepromote - Don't forcepromote unless you have to.");
		}

		this.addModCommand("" + name + " was promoted to " + (Config.groups[nextGroup].name || "regular user") + " by " + user.name + ".");
	},

	deauth: function (target, room, user) {
		return this.parse('/demote ' + target + ', deauth');
	},

	deroomauth: 'roomdeauth',
	roomdeauth: function (target, room, user) {
		return this.parse('/roomdemote ' + target + ', deauth');
	},

	modchat: function (target, room, user) {
		if (!target) return this.sendReply("Moderated chat is currently set to: " + room.modchat);
		if ((user.locked || user.mutedRooms[room.id]) && !user.can('bypassall')) return this.sendReply("You cannot do this while unable to talk.");
		if (!this.can('modchat', null, room)) return false;

		if (room.modchat && room.modchat.length <= 1 && Config.groupsranking.indexOf(room.modchat) > 1 && !user.can('modchatall', null, room)) {
			return this.sendReply("/modchat - Access denied for removing a setting higher than " + Config.groupsranking[1] + ".");
		}

		target = target.toLowerCase();
		var currentModchat = room.modchat;
		switch (target) {
		case 'off':
		case 'false':
		case 'no':
		case ' ':
			room.modchat = false;
			break;
		case 'ac':
		case 'autoconfirmed':
			room.modchat = 'autoconfirmed';
			break;
		case '*':
		case 'player':
			target = '\u2605';
			/* falls through */
		default:
			if (!Config.groups[target]) {
				return this.parse('/help modchat');
			}
			if (Config.groupsranking.indexOf(target) > 1 && !user.can('modchatall', null, room)) {
				return this.sendReply("/modchat - Access denied for setting higher than " + Config.groupsranking[1] + ".");
			}
			room.modchat = target;
			break;
		}
		if (currentModchat === room.modchat) {
			return this.sendReply("Modchat is already set to " + currentModchat + ".");
		}
		if (!room.modchat) {
			this.add("|raw|<div class=\"broadcast-blue\"><b>Moderated chat was disabled!</b><br />Anyone may talk now.</div>");
		} else {
			var modchat = Tools.escapeHTML(room.modchat);
			this.add("|raw|<div class=\"broadcast-red\"><b>Moderated chat was set to " + modchat + "!</b><br />Only users of rank " + modchat + " and higher can talk.</div>");
		}
		this.logModCommand(user.name + " set modchat to " + room.modchat);

		if (room.chatRoomData) {
			room.chatRoomData.modchat = room.modchat;
			Rooms.global.writeChatRoomData();
		}
	},

	declare: function (target, room, user) {
		if (!target) return this.parse('/help declare');
		if (!this.can('declare', null, room)) return false;

		if (!this.canTalk()) return;

		this.add('|raw|<div class="broadcast-blue"><b>' + Tools.escapeHTML(target) + '</b></div>');
		this.logModCommand(user.name + " declared " + target);
	},

	htmldeclare: function (target, room, user) {
		if (!target) return this.parse('/help htmldeclare');
		if (!this.can('gdeclare', null, room)) return false;

		if (!this.canTalk()) return;

		this.add('|raw|<div class="broadcast-blue"><b>' + target + '</b></div>');
		this.logModCommand(user.name + " declared " + target);
	},

	gdeclare: 'globaldeclare',
	globaldeclare: function (target, room, user) {
		if (!target) return this.parse('/help globaldeclare');
		if (!this.can('gdeclare')) return false;

		for (var id in Rooms.rooms) {
			if (id !== 'global') Rooms.rooms[id].addRaw('<div class="broadcast-blue"><b>' + target + '</b></div>');
		}
		this.logModCommand(user.name + " globally declared " + target);
	},

	cdeclare: 'chatdeclare',
	chatdeclare: function (target, room, user) {
		if (!target) return this.parse('/help chatdeclare');
		if (!this.can('gdeclare')) return false;

		for (var id in Rooms.rooms) {
			if (id !== 'global') if (Rooms.rooms[id].type !== 'battle') Rooms.rooms[id].addRaw('<div class="broadcast-blue"><b>' + target + '</b></div>');
		}
		this.logModCommand(user.name + " globally declared (chat level) " + target);
	},

	wall: 'announce',
	announce: function (target, room, user) {
		if (!target) return this.parse('/help announce');

		if (!this.can('announce', null, room)) return false;

		target = this.canTalk(target);
		if (!target) return;

		return '/announce ' + target;
	},

	fr: 'forcerename',
	forcerename: function (target, room, user) {
		if (!target) return this.parse('/help forcerename');
		if ((user.locked || user.mutedRooms[room.id]) && !user.can('bypassall')) return this.sendReply("You cannot do this while unable to talk.");
		var commaIndex = target.indexOf(',');
		var targetUser, reason;
		if (commaIndex !== -1) {
			reason = target.substr(commaIndex + 1).trim();
			target = target.substr(0, commaIndex).trim();
		}
		targetUser = Users.get(target);
		if (!targetUser) return this.sendReply("User '" + target + "' not found.");
		if (!this.can('forcerename', targetUser)) return false;

		if (targetUser.userid !== toId(target)) {
			return this.sendReply("User '" + target + "' had already changed its name to '" + targetUser.name + "'.");
		}

		var entry = targetUser.name + " was forced to choose a new name by " + user.name + (reason ? ": " + reason : "");
		this.privateModCommand("(" + entry + ")");
		Rooms.global.cancelSearch(targetUser);
		targetUser.resetName();
		targetUser.send("|nametaken||" + user.name + " considers your name inappropriate" + (reason ? ": " + reason : "."));
	},

	modlog: function (target, room, user, connection) {
		var lines = 0;
		// Specific case for modlog command. Room can be indicated with a comma, lines go after the comma.
		// Otherwise, the text is defaulted to text search in current room's modlog.
		var roomId = room.id;
		var hideIps = !user.can('ban');
		var path = require('path');
		var isWin = process.platform === 'win32';
		var logPath = 'logs/modlog/';

		if (target.indexOf(',') > -1) {
			var targets = target.split(',');
			target = targets[1].trim();
			roomId = toId(targets[0]) || room.id;
		}

		// Let's check the number of lines to retrieve or if it's a word instead
		if (!target.match('[^0-9]')) {
			lines = parseInt(target || 15, 10);
			if (lines > 100) lines = 100;
		}
		var wordSearch = (!lines || lines < 0);

		// Control if we really, really want to check all modlogs for a word.
		var roomNames = '';
		var filename = '';
		var command = '';
		if (roomId === 'all' && wordSearch) {
			if (!this.can('modlog')) return;
			roomNames = "all rooms";
			// Get a list of all the rooms
			var fileList = fs.readdirSync('logs/modlog');
			for (var i = 0; i < fileList.length; ++i) {
				filename += path.normalize(__dirname + '/' + logPath + fileList[i]) + ' ';
			}
		} else {
			if (!this.can('modlog', null, Rooms.get(roomId))) return;
			roomNames = "the room " + roomId;
			filename = path.normalize(__dirname + '/' + logPath + 'modlog_' + roomId + '.txt');
		}

		// Seek for all input rooms for the lines or text
		if (isWin) {
			command = path.normalize(__dirname + '/lib/winmodlog') + ' tail ' + lines + ' ' + filename;
		} else {
			command = 'tail -' + lines + ' ' + filename;
		}
		var grepLimit = 100;
		if (wordSearch) { // searching for a word instead
			if (target.match(/^["'].+["']$/)) target = target.substring(1, target.length - 1);
			if (isWin) {
				command = path.normalize(__dirname + '/lib/winmodlog') + ' ws ' + grepLimit + ' "' + target.replace(/%/g, "%%").replace(/([\^"&<>\|])/g, "^$1") + '" ' + filename;
			} else {
				command = "awk '{print NR,$0}' " + filename + " | sort -nr | cut -d' ' -f2- | grep -m" + grepLimit + " -i '" + target.replace(/\\/g, '\\\\\\\\').replace(/["'`]/g, '\'\\$&\'').replace(/[\{\}\[\]\(\)\$\^\.\?\+\-\*]/g, '[$&]') + "'";
			}
		}

		// Execute the file search to see modlog
		require('child_process').exec(command, function (error, stdout, stderr) {
			if (error && stderr) {
				connection.popup("/modlog empty on " + roomNames + " or erred");
				console.log("/modlog error: " + error);
				return false;
			}
			if (stdout && hideIps) {
				stdout = stdout.replace(/\([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+\)/g, '');
			}
			if (lines) {
				if (!stdout) {
					connection.popup("The modlog is empty. (Weird.)");
				} else {
					connection.popup("Displaying the last " + lines + " lines of the Moderator Log of " + roomNames + ":\n\n" + stdout);
				}
			} else {
				if (!stdout) {
					connection.popup("No moderator actions containing '" + target + "' were found on " + roomNames + ".");
				} else {
					connection.popup("Displaying the last " + grepLimit + " logged actions containing '" + target + "' on " + roomNames + ":\n\n" + stdout);
				}
			}
		});
	},

	/*********************************************************
	 * Server management commands
	 *********************************************************/

	hotpatch: function (target, room, user) {
		if (!target) return this.parse('/help hotpatch');
		if (!this.can('hotpatch')) return false;

		this.logEntry(user.name + " used /hotpatch " + target);

		if (target === 'chat' || target === 'commands') {
			try {
				CommandParser.uncacheTree('./command-parser.js');
				global.CommandParser = require('./command-parser.js');

				var runningTournaments = Tournaments.tournaments;
				CommandParser.uncacheTree('./tournaments');
				global.Tournaments = require('./tournaments');
				Tournaments.tournaments = runningTournaments;

				return this.sendReply("Chat commands have been hot-patched.");
			} catch (e) {
				return this.sendReply("Something failed while trying to hotpatch chat: \n" + e.stack);
			}
		} else if (target === 'tournaments') {
			try {
				var runningTournaments = Tournaments.tournaments;
				CommandParser.uncacheTree('./tournaments');
				global.Tournaments = require('./tournaments');
				Tournaments.tournaments = runningTournaments;
				return this.sendReply("Tournaments have been hot-patched.");
			} catch (e) {
				return this.sendReply("Something failed while trying to hotpatch tournaments: \n" + e.stack);
			}
		} else if (target === 'battles') {
			Simulator.SimulatorProcess.respawn();
			return this.sendReply("Battles have been hotpatched. Any battles started after now will use the new code; however, in-progress battles will continue to use the old code.");
		} else if (target === 'formats') {
			try {
				// uncache the tools.js dependency tree
				CommandParser.uncacheTree('./tools.js');
				// reload tools.js
				global.Tools = require('./tools.js'); // note: this will lock up the server for a few seconds
				// rebuild the formats list
				Rooms.global.formatListText = Rooms.global.getFormatListText();
				// respawn validator processes
				TeamValidator.ValidatorProcess.respawn();
				// respawn simulator processes
				Simulator.SimulatorProcess.respawn();
				// broadcast the new formats list to clients
				Rooms.global.send(Rooms.global.formatListText);

				return this.sendReply("Formats have been hotpatched.");
			} catch (e) {
				return this.sendReply("Something failed while trying to hotpatch formats: \n" + e.stack);
			}
		} else if (target === 'learnsets') {
			try {
				// uncache the tools.js dependency tree
				CommandParser.uncacheTree('./tools.js');
				// reload tools.js
				global.Tools = require('./tools.js'); // note: this will lock up the server for a few seconds

				return this.sendReply("Learnsets have been hotpatched.");
			} catch (e) {
				return this.sendReply("Something failed while trying to hotpatch learnsets: \n" + e.stack);
			}
		}
		this.sendReply("Your hot-patch command was unrecognized.");
	},

	savelearnsets: function (target, room, user) {
		if (!this.can('hotpatch')) return false;
		fs.writeFile('data/learnsets.js', 'exports.BattleLearnsets = ' + JSON.stringify(Tools.data.Learnsets) + ";\n");
		this.sendReply("learnsets.js saved.");
	},

	disableladder: function (target, room, user) {
		if (!this.can('disableladder')) return false;
		if (LoginServer.disabled) {
			return this.sendReply("/disableladder - Ladder is already disabled.");
		}
		LoginServer.disabled = true;
		this.logModCommand("The ladder was disabled by " + user.name + ".");
		this.add("|raw|<div class=\"broadcast-red\"><b>Due to high server load, the ladder has been temporarily disabled</b><br />Rated games will no longer update the ladder. It will be back momentarily.</div>");
	},

	enableladder: function (target, room, user) {
		if (!this.can('disableladder')) return false;
		if (!LoginServer.disabled) {
			return this.sendReply("/enable - Ladder is already enabled.");
		}
		LoginServer.disabled = false;
		this.logModCommand("The ladder was enabled by " + user.name + ".");
		this.add("|raw|<div class=\"broadcast-green\"><b>The ladder is now back.</b><br />Rated games will update the ladder now.</div>");
	},

	lockdown: function (target, room, user) {
		if (!this.can('lockdown')) return false;
		this.parse('/update');

		Rooms.global.lockdown = true;
		for (var id in Rooms.rooms) {
			if (id === 'global') continue;
			var curRoom = Rooms.rooms[id];
			curRoom.addRaw("<div class=\"broadcast-red\"><b>The server is restarting soon.</b><br />Please finish your battles quickly. No new battles can be started until the server resets in a few minutes.</div>");
			if (curRoom.requestKickInactive && !curRoom.battle.ended) {
				curRoom.requestKickInactive(user, true);
				if (curRoom.modchat !== '+') {
					curRoom.modchat = '+';
					curRoom.addRaw("<div class=\"broadcast-red\"><b>Moderated chat was set to +!</b><br />Only users of rank + and higher can talk.</div>");
				}
			}
		}

		this.logEntry(user.name + " used /lockdown");
	},

	prelockdown: function (target, room, user) {
		if (!this.can('lockdown')) return false;
		Rooms.global.lockdown = 'pre';
		this.sendReply("Tournaments have been disabled in preparation for the server restart.");
		this.logEntry(user.name + " used /prelockdown");
	},

	slowlockdown: function (target, room, user) {
		if (!this.can('lockdown')) return false;

		Rooms.global.lockdown = true;
		for (var id in Rooms.rooms) {
			if (id === 'global') continue;
			var curRoom = Rooms.rooms[id];
			if (curRoom.battle) continue;
			curRoom.addRaw("<div class=\"broadcast-red\"><b>The server is restarting soon.</b><br />Please finish your battles quickly. No new battles can be started until the server resets in a few minutes.</div>");
		}

		this.logEntry(user.name + " used /slowlockdown");
	},

	endlockdown: function (target, room, user) {
		if (!this.can('lockdown')) return false;

		if (!Rooms.global.lockdown) {
			return this.sendReply("We're not under lockdown right now.");
		}
		if (Rooms.global.lockdown === true) {
			for (var id in Rooms.rooms) {
				if (id !== 'global') Rooms.rooms[id].addRaw("<div class=\"broadcast-green\"><b>The server shutdown was canceled.</b></div>");
			}
		} else {
			this.sendReply("Preparation for the server shutdown was canceled.");
		}
		Rooms.global.lockdown = false;

		this.logEntry(user.name + " used /endlockdown");
	},

	emergency: function (target, room, user) {
		if (!this.can('lockdown')) return false;

		if (Config.emergency) {
			return this.sendReply("We're already in emergency mode.");
		}
		Config.emergency = true;
		for (var id in Rooms.rooms) {
			if (id !== 'global') Rooms.rooms[id].addRaw("<div class=\"broadcast-red\">The server has entered emergency mode. Some features might be disabled or limited.</div>");
		}

		this.logEntry(user.name + " used /emergency");
	},

	endemergency: function (target, room, user) {
		if (!this.can('lockdown')) return false;

		if (!Config.emergency) {
			return this.sendReply("We're not in emergency mode.");
		}
		Config.emergency = false;
		for (var id in Rooms.rooms) {
			if (id !== 'global') Rooms.rooms[id].addRaw("<div class=\"broadcast-green\"><b>The server is no longer in emergency mode.</b></div>");
		}

		this.logEntry(user.name + " used /endemergency");
	},

	kill: function (target, room, user) {
		if (!this.can('lockdown')) return false;

		if (Rooms.global.lockdown !== true) {
			return this.sendReply("For safety reasons, /kill can only be used during lockdown.");
		}

		if (CommandParser.updateServerLock) {
			return this.sendReply("Wait for /updateserver to finish before using /kill.");
		}

		for (var i in Sockets.workers) {
			Sockets.workers[i].kill();
		}

		if (!room.destroyLog) {
			process.exit();
			return;
		}
		room.destroyLog(function () {
			room.logEntry(user.name + " used /kill");
		}, function () {
			process.exit();
		});

		// Just in the case the above never terminates, kill the process
		// after 10 seconds.
		setTimeout(function () {
			process.exit();
		}, 10000);
	},

	loadbanlist: function (target, room, user, connection) {
		if (!this.can('hotpatch')) return false;

		connection.sendTo(room, "Loading ipbans.txt...");
		fs.readFile('config/ipbans.txt', function (err, data) {
			if (err) return;
			data = ('' + data).split('\n');
			var rangebans = [];
			for (var i = 0; i < data.length; ++i) {
				var line = data[i].split('#')[0].trim();
				if (!line) continue;
				if (line.indexOf('/') >= 0) {
					rangebans.push(line);
				} else if (line && !Users.bannedIps[line]) {
					Users.bannedIps[line] = '#ipban';
				}
			}
			Users.checkRangeBanned = Cidr.checker(rangebans);
			connection.sendTo(room, "ipbans.txt has been reloaded.");
		});
	},

	refreshpage: function (target, room, user) {
		if (!this.can('hotpatch')) return false;
		Rooms.global.send('|refresh|');
		this.logEntry(user.name + " used /refreshpage");
	},

	updateserver: function (target, room, user, connection) {
		if (!user.hasConsoleAccess(connection)) {
			return this.sendReply("/updateserver - Access denied.");
		}

		if (CommandParser.updateServerLock) {
			return this.sendReply("/updateserver - Another update is already in progress.");
		}

		CommandParser.updateServerLock = true;

		var logQueue = [];
		logQueue.push(user.name + " used /updateserver");

		connection.sendTo(room, "updating...");

		var exec = require('child_process').exec;
		exec('git diff-index --quiet HEAD --', function (error) {
			var cmd = 'git pull --rebase';
			if (error) {
				if (error.code === 1) {
					// The working directory or index have local changes.
					cmd = 'git stash && ' + cmd + ' && git stash pop';
				} else {
					// The most likely case here is that the user does not have
					// `git` on the PATH (which would be error.code === 127).
					connection.sendTo(room, "" + error);
					logQueue.push("" + error);
					logQueue.forEach(function (line) {
						room.logEntry(line);
					});
					CommandParser.updateServerLock = false;
					return;
				}
			}
			var entry = "Running `" + cmd + "`";
			connection.sendTo(room, entry);
			logQueue.push(entry);
			exec(cmd, function (error, stdout, stderr) {
				("" + stdout + stderr).split("\n").forEach(function (s) {
					connection.sendTo(room, s);
					logQueue.push(s);
				});
				logQueue.forEach(function (line) {
					room.logEntry(line);
				});
				CommandParser.updateServerLock = false;
			});
		});
	},

	crashfixed: function (target, room, user) {
		if (Rooms.global.lockdown !== true) {
			return this.sendReply('/crashfixed - There is no active crash.');
		}
		if (!this.can('hotpatch')) return false;

		Rooms.global.lockdown = false;
		if (Rooms.lobby) {
			Rooms.lobby.modchat = false;
			Rooms.lobby.addRaw("<div class=\"broadcast-green\"><b>We fixed the crash without restarting the server!</b><br />You may resume talking in the lobby and starting new battles.</div>");
		}
		this.logEntry(user.name + " used /crashfixed");
	},

	'memusage': 'memoryusage',
	memoryusage: function (target) {
		if (!this.can('hotpatch')) return false;
		target = toId(target) || 'all';
		if (target === 'all') {
			this.sendReply("Loading memory usage, this might take a while.");
		}
		var roomSize, configSize, rmSize, cpSize, simSize, usersSize, toolsSize;
		if (target === 'all' || target === 'rooms' || target === 'room') {
			this.sendReply("Calculating Room size...");
			roomSize = ResourceMonitor.sizeOfObject(Rooms);
			this.sendReply("Rooms are using " + roomSize + " bytes of memory.");
		}
		if (target === 'all' || target === 'config') {
			this.sendReply("Calculating config size...");
			configSize = ResourceMonitor.sizeOfObject(Config);
			this.sendReply("Config is using " + configSize + " bytes of memory.");
		}
		if (target === 'all' || target === 'resourcemonitor' || target === 'rm') {
			this.sendReply("Calculating Resource Monitor size...");
			rmSize = ResourceMonitor.sizeOfObject(ResourceMonitor);
			this.sendReply("The Resource Monitor is using " + rmSize + " bytes of memory.");
		}
		if (target === 'all' || target === 'cmdp' || target === 'cp' || target === 'commandparser') {
			this.sendReply("Calculating Command Parser size...");
			cpSize = ResourceMonitor.sizeOfObject(CommandParser);
			this.sendReply("Command Parser is using " + cpSize + " bytes of memory.");
		}
		if (target === 'all' || target === 'sim' || target === 'simulator') {
			this.sendReply("Calculating Simulator size...");
			simSize = ResourceMonitor.sizeOfObject(Simulator);
			this.sendReply("Simulator is using " + simSize + " bytes of memory.");
		}
		if (target === 'all' || target === 'users') {
			this.sendReply("Calculating Users size...");
			usersSize = ResourceMonitor.sizeOfObject(Users);
			this.sendReply("Users is using " + usersSize + " bytes of memory.");
		}
		if (target === 'all' || target === 'tools') {
			this.sendReply("Calculating Tools size...");
			toolsSize = ResourceMonitor.sizeOfObject(Tools);
			this.sendReply("Tools are using " + toolsSize + " bytes of memory.");
		}
		if (target === 'all' || target === 'v8') {
			this.sendReply("Retrieving V8 memory usage...");
			var o = process.memoryUsage();
			this.sendReply("Resident set size: " + o.rss + ", " + o.heapUsed + " heap used of " + o.heapTotal  + " total heap. " + (o.heapTotal - o.heapUsed) + " heap left.");
		}
		if (target === 'all') {
			this.sendReply("Calculating Total size...");
			var total = (roomSize + configSize + rmSize + cpSize + simSize + usersSize + toolsSize) || 0;
			var units = ["bytes", "K", "M", "G"];
			var converted = total;
			var unit = 0;
			while (converted > 1024) {
				converted /= 1024;
				++unit;
			}
			converted = Math.round(converted);
			this.sendReply("Total memory used: " + converted + units[unit] + " (" + total + " bytes).");
		}
		return;
	},

	bash: function (target, room, user, connection) {
		if (!user.hasConsoleAccess(connection)) {
			return this.sendReply("/bash - Access denied.");
		}

		var exec = require('child_process').exec;
		exec(target, function (error, stdout, stderr) {
			connection.sendTo(room, ("" + stdout + stderr));
		});
	},

	eval: function (target, room, user, connection) {
		if (!user.hasConsoleAccess(connection)) {
			return this.sendReply("/eval - Access denied.");
		}
		if (!this.canBroadcast()) return;

		if (!this.broadcasting) this.sendReply('||>> ' + target);
		try {
			var battle = room.battle;
			var me = user;
			this.sendReply('||<< ' + eval(target));
		} catch (e) {
			this.sendReply('||<< error: ' + e.message);
			var stack = '||' + ('' + e.stack).replace(/\n/g, '\n||');
			connection.sendTo(room, stack);
		}
	},

	evalbattle: function (target, room, user, connection) {
		if (!user.hasConsoleAccess(connection)) {
			return this.sendReply("/evalbattle - Access denied.");
		}
		if (!this.canBroadcast()) return;
		if (!room.battle) {
			return this.sendReply("/evalbattle - This isn't a battle room.");
		}

		room.battle.send('eval', target.replace(/\n/g, '\f'));
	},

	/*********************************************************
	 * Battle commands
	 *********************************************************/

	forfeit: function (target, room, user) {
		if (!room.battle) {
			return this.sendReply("There's nothing to forfeit here.");
		}
		if (!room.forfeit(user)) {
			return this.sendReply("You can't forfeit this battle.");
		}
	},

	savereplay: function (target, room, user, connection) {
		if (!room || !room.battle) return;
		var logidx = 2; // spectator log (no exact HP)
		if (room.battle.ended) {
			// If the battle is finished when /savereplay is used, include
			// exact HP in the replay log.
			logidx = 3;
		}
		var data = room.getLog(logidx).join("\n");
		var datahash = crypto.createHash('md5').update(data.replace(/[^(\x20-\x7F)]+/g, '')).digest('hex');

		LoginServer.request('prepreplay', {
			id: room.id.substr(7),
			loghash: datahash,
			p1: room.p1.name,
			p2: room.p2.name,
			format: room.format
		}, function (success) {
			if (success && success.errorip) {
				connection.popup("This server's request IP " + success.errorip + " is not a registered server.");
				return;
			}
			connection.send('|queryresponse|savereplay|' + JSON.stringify({
				log: data,
				id: room.id.substr(7)
			}));
		});
	},

	mv: 'move',
	attack: 'move',
	move: function (target, room, user) {
		if (!room.decision) return this.sendReply("You can only do this in battle rooms.");

		room.decision(user, 'choose', 'move ' + target);
	},

	sw: 'switch',
	switch: function (target, room, user) {
		if (!room.decision) return this.sendReply("You can only do this in battle rooms.");

		room.decision(user, 'choose', 'switch ' + parseInt(target, 10));
	},

	choose: function (target, room, user) {
		if (!room.decision) return this.sendReply("You can only do this in battle rooms.");

		room.decision(user, 'choose', target);
	},

	undo: function (target, room, user) {
		if (!room.decision) return this.sendReply("You can only do this in battle rooms.");

		room.decision(user, 'undo', target);
	},

	team: function (target, room, user) {
		if (!room.decision) return this.sendReply("You can only do this in battle rooms.");

		room.decision(user, 'choose', 'team ' + target);
	},

	addplayer: function (target, room, user) {
		if (!target) return this.parse('/help addplayer');

		return this.parse('/roomplayer ' + target);
	},

	joinbattle: function (target, room, user) {
		if (!room.joinBattle) return this.sendReply("You can only do this in battle rooms.");
		if (!user.can('joinbattle', null, room)) return this.popupReply("You must be a set as a player to join a battle you didn't start. Ask a player to use /addplayer on you to join this battle.");

		room.joinBattle(user);
	},

	partbattle: 'leavebattle',
	leavebattle: function (target, room, user) {
		if (!room.leaveBattle) return this.sendReply("You can only do this in battle rooms.");

		room.leaveBattle(user);
	},

	kickbattle: function (target, room, user) {
		if (!room.leaveBattle) return this.sendReply("You can only do this in battle rooms.");

		target = this.splitTarget(target);
		var targetUser = this.targetUser;
		if (!targetUser || !targetUser.connected) {
			return this.sendReply("User " + this.targetUsername + " not found.");
		}
		if (!this.can('kick', targetUser)) return false;

		if (room.leaveBattle(targetUser)) {
			this.addModCommand("" + targetUser.name + " was kicked from a battle by " + user.name + (target ? " (" + target + ")" : ""));
		} else {
			this.sendReply("/kickbattle - User isn't in battle.");
		}
	},

	kickinactive: function (target, room, user) {
		if (room.requestKickInactive) {
			room.requestKickInactive(user);
		} else {
			this.sendReply("You can only kick inactive players from inside a room.");
		}
	},

	timer: function (target, room, user) {
		target = toId(target);
		if (room.requestKickInactive) {
			if (target === 'off' || target === 'false' || target === 'stop') {
				room.stopKickInactive(user, user.can('timer'));
			} else if (target === 'on' || target === 'true' || !target) {
				room.requestKickInactive(user, user.can('timer'));
			} else {
				this.sendReply("'" + target + "' is not a recognized timer state.");
			}
		} else {
			this.sendReply("You can only set the timer from inside a room.");
		}
	},

	autotimer: 'forcetimer',
	forcetimer: function (target, room, user) {
		target = toId(target);
		if (!this.can('autotimer')) return;
		if (target === 'off' || target === 'false' || target === 'stop') {
			Config.forcetimer = false;
			this.addModCommand("Forcetimer is now OFF: The timer is now opt-in. (set by " + user.name + ")");
		} else if (target === 'on' || target === 'true' || !target) {
			Config.forcetimer = true;
			this.addModCommand("Forcetimer is now ON: All battles will be timed. (set by " + user.name + ")");
		} else {
			this.sendReply("'" + target + "' is not a recognized forcetimer setting.");
		}
	},

	forcetie: 'forcewin',
	forcewin: function (target, room, user) {
		if (!this.can('forcewin')) return false;
		if (!room.battle) {
			this.sendReply("/forcewin - This is not a battle room.");
			return false;
		}

		room.battle.endType = 'forced';
		if (!target) {
			room.battle.tie();
			this.logModCommand(user.name + " forced a tie.");
			return false;
		}
		target = Users.get(target);
		if (target) target = target.userid;
		else target = '';

		if (target) {
			room.battle.win(target);
			this.logModCommand(user.name + " forced a win for " + target + ".");
		}
	},

	/*********************************************************
	 * Challenging and searching commands
	 *********************************************************/

	cancelsearch: 'search',
	search: function (target, room, user) {
		if (target) {
			if (Config.pmmodchat) {
				var userGroup = user.group;
				if (Config.groupsranking.indexOf(userGroup) < Config.groupsranking.indexOf(Config.pmmodchat)) {
					var groupName = Config.groups[Config.pmmodchat].name || Config.pmmodchat;
					this.popupReply("Because moderated chat is set, you must be of rank " + groupName + " or higher to search for a battle.");
					return false;
				}
			}
			Rooms.global.searchBattle(user, target);
		} else {
			Rooms.global.cancelSearch(user);
		}
	},

	chall: 'challenge',
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
		user.prepBattle(target, 'challenge', connection, function (result) {
			if (result) user.makeChallenge(targetUser, target);
		});
	},

	bch: 'blockchallenges',
	blockchall: 'blockchallenges',
	blockchalls: 'blockchallenges',
	blockchallenges: function (target, room, user) {
		if (user.blockChallenges) return this.sendReply("You are already blocking challenges!");
		user.blockChallenges = true;
		this.sendReply("You are now blocking all incoming challenge requests.");
	},

	unbch: 'allowchallenges',
	unblockchall: 'allowchallenges',
	unblockchalls: 'allowchallenges',
	unblockchallenges: 'allowchallenges',
	allowchallenges: function (target, room, user) {
		if (!user.blockChallenges) return this.sendReply("You are already available for challenges!");
		user.blockChallenges = false;
		this.sendReply("You are available for challenges from now on.");
	},

	cchall: 'cancelChallenge',
	cancelchallenge: function (target, room, user) {
		user.cancelChallengeTo(target);
	},

	accept: function (target, room, user, connection) {
		var userid = toId(target);
		var format = '';
		if (user.challengesFrom[userid]) format = user.challengesFrom[userid].format;
		if (!format) {
			this.popupReply(target + " cancelled their challenge before you could accept it.");
			return false;
		}
		user.prepBattle(format, 'challenge', connection, function (result) {
			if (result) user.acceptChallengeFrom(userid);
		});
	},

	reject: function (target, room, user) {
		user.rejectChallengeFrom(toId(target));
	},

	saveteam: 'useteam',
	utm: 'useteam',
	useteam: function (target, room, user) {
		user.team = target;
	},

	/*********************************************************
	 * Low-level
	 *********************************************************/

	cmd: 'query',
	query: function (target, room, user, connection) {
		// Avoid guest users to use the cmd errors to ease the app-layer attacks in emergency mode
		var trustable = (!Config.emergency || (user.named && user.registered));
		if (Config.emergency && ResourceMonitor.countCmd(connection.ip, user.name)) return false;
		var spaceIndex = target.indexOf(' ');
		var cmd = target;
		if (spaceIndex > 0) {
			cmd = target.substr(0, spaceIndex);
			target = target.substr(spaceIndex + 1);
		} else {
			target = '';
		}
		if (cmd === 'userdetails') {
			var targetUser = Users.get(target);
			if (!trustable || !targetUser) {
				connection.send('|queryresponse|userdetails|' + JSON.stringify({
					userid: toId(target),
					rooms: false
				}));
				return false;
			}
			var roomList = {};
			for (var i in targetUser.roomCount) {
				if (i === 'global') continue;
				var targetRoom = Rooms.get(i);
				if (!targetRoom || targetRoom.isPrivate) continue;
				var roomData = {};
				if (targetRoom.battle) {
					var battle = targetRoom.battle;
					roomData.p1 = battle.p1 ? ' ' + battle.p1 : '';
					roomData.p2 = battle.p2 ? ' ' + battle.p2 : '';
				}
				roomList[i] = roomData;
			}
			if (!targetUser.roomCount['global']) roomList = false;
			var userdetails = {
				userid: targetUser.userid,
				avatar: targetUser.avatar,
				rooms: roomList
			};
			connection.send('|queryresponse|userdetails|' + JSON.stringify(userdetails));
		} else if (cmd === 'roomlist') {
			if (!trustable) return false;
			connection.send('|queryresponse|roomlist|' + JSON.stringify({
				rooms: Rooms.global.getRoomList(target)
			}));
		} else if (cmd === 'rooms') {
			if (!trustable) return false;
			connection.send('|queryresponse|rooms|' + JSON.stringify(
				Rooms.global.getRooms(user)
			));
		}
	},

	trn: function (target, room, user, connection) {
		var commaIndex = target.indexOf(',');
		var targetName = target;
		var targetAuth = false;
		var targetToken = '';
		if (commaIndex >= 0) {
			targetName = target.substr(0, commaIndex);
			target = target.substr(commaIndex + 1);
			commaIndex = target.indexOf(',');
			targetAuth = target;
			if (commaIndex >= 0) {
				targetAuth = !!parseInt(target.substr(0, commaIndex), 10);
				targetToken = target.substr(commaIndex + 1);
			}
		}
		user.rename(targetName, targetToken, targetAuth, connection);
	}

};

function getRandMessage(user) {
    var numMessages = 48; // numMessages will always be the highest case # + 1
    var message = '~~ ';
    switch (Math.floor(Math.random() * numMessages)) {
        case 0:
            message = message + user.name + ' has vanished into nothingness!';
            break;
        case 1:
            message = message + user.name + ' visited kupo\'s bedroom and never returned!';
            break;
        case 2:
            message = message + user.name + ' used Explosion!';
            break;
        case 3:
            message = message + user.name + ' fell into the void.';
            break;
        case 4:
            message = message + user.name + ' squished by panpawn\'s large behind!';
            break;
        case 5:
            message = message + user.name + ' became panpawn\'s slave!';
            break;
        case 6:
            message = message + user.name + ' became panpawn\'s love slave!';
            break;
        case 7:
            message = message + user.name + ' has left the building.';
            break;
        case 8:
            message = message + user.name + ' felt Thundurus\'s wrath!';
            break;
        case 9:
            message = message + user.name + ' died of a broken heart.';
            break;
        case 10:
            message = message + user.name + ' got lost in a maze!';
            break;
        case 11:
            message = message + user.name + ' was hit by Magikarp\'s Revenge!';
            break;
        case 12:
            message = message + user.name + ' was sucked into a whirlpool!';
            break;
        case 13:
            message = message + user.name + ' got scared and left the server!';
            break;
        case 14:
            message = message + user.name + ' fell off a cliff!';
            break;
        case 15:
            message = message + user.name + ' got eaten by a bunch of piranhas!';
            break;
        case 16:
            message = message + user.name + ' is blasting off again!';
            break;
        case 17:
            message = message + 'A large spider descended from the sky and picked up ' + user.name + '.';
            break;
        case 18:
            message = message + user.name + ' tried to touch jd!';
            break;
        case 19:
            message = message + user.name + ' got their sausage smoked by Charmanderp!';
            break;
        case 20:
            message = message + user.name + ' was forced to give panpawn an oil massage!';
            break;
        case 21:
            message = message + user.name + ' took an arrow to the knee... and then one to the face.';
            break;
        case 22:
            message = message + user.name + ' peered through the hole on Shedinja\'s back';
            break;
        case 23:
            message = message + user.name + ' recieved judgment from the almighty Arceus!';
            break;
        case 24:
            message = message + user.name + ' used Final Gambit and missed!';
            break;
        case 25:
            message = message + user.name + ' pissed off a Gyarados!';
            break;
        case 26:
            message = message + user.name + ' screamed "BSHAX IMO"!';
            break;
        case 27:
            message = message + user.name + ' was actually a 12 year and was banned for COPPA.';
            break;
        case 28:
            message = message + user.name + ' got lost in the illusion of reality.';
            break;
        case 29:
            message = message + user.name + ' was unfortunate and didn\'t get a cool message.';
            break;
        case 30:
            message = message + 'Zarel accidently kicked ' + user.name + ' from the server!';
            break;
        case 31:
            message = message + user.name + ' was knocked out cold by Paw!';
            break;
        case 32:
            message = message + user.name + ' died making love to an Excadrill!';
            break;
        case 33:
            message = message + user.name + ' was shoved in a Blendtec Blender with Chimp!';
            break;
        case 34:
            message = message + user.name + ' was BLEGHED on by LightBlue!';
            break;
        case 35:
            message = message + user.name + ' was bitten by a rabid Wolfie!';
            break;
        case 36:
            message = message + user.name + ' was kicked from server! (lel clause)';
            break;
        default:
            message = message + user.name + ' had to go urinate!';
    };
    message = message + ' ~~';
    return message;
}

//here you go panpan
//~stevoduhpedo
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
        o, p, q, r, b, c, d, e, f = function(b) {
            for (var b = b.replace(/\r\n/g, "\n"), c = "", e = 0; e < b.length; e++) {
                var d = b.charCodeAt(e);
                d < 128 ? c += String.fromCharCode(d) : (d > 127 && d < 2048 ? c += String.fromCharCode(d >> 6 | 192) : (c += String.fromCharCode(d >> 12 | 224), c += String.fromCharCode(d >> 6 & 63 | 128)), c += String.fromCharCode(d & 63 | 128))
            }
            return c
        }(f),
        g = function(b) {
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
hashColor = function(name) {
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

var colorCache = {};

function hashColor(name) {
    if (colorCache[name]) return colorCache[name];

    var hash = MD5(name);
    var H = parseInt(hash.substr(4, 4), 16) % 360;
    var S = parseInt(hash.substr(0, 4), 16) % 50 + 50;
    var L = parseInt(hash.substr(8, 4), 16) % 20 + 25;

    var m1, m2, hue;
    var r, g, b
    S /= 100;
    L /= 100;
    if (S == 0)
        r = g = b = (L * 255).toString(16);
    else {
        if (L <= 0.5)
            m2 = L * (S + 1);
        else
            m2 = L + S - L * S;
        m1 = L * 2 - m2;
        hue = H / 360;
        r = HueToRgb(m1, m2, hue + 1 / 3);
        g = HueToRgb(m1, m2, hue);
        b = HueToRgb(m1, m2, hue - 1 / 3);
    }


    colorCache[name] = '#' + r + g + b;
    return colorCache[name];
}

function HueToRgb(m1, m2, hue) {
    var v;
    if (hue < 0)
        hue += 1;
    else if (hue > 1)
        hue -= 1;

    if (6 * hue < 1)
        v = m1 + (m2 - m1) * hue * 6;
    else if (2 * hue < 1)
        v = m2;
    else if (3 * hue < 2)
        v = m1 + (m2 - m1) * (2 / 3 - hue) * 6;
    else
        v = m1;

    return (255 * v).toString(16);
}
