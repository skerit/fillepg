#!/usr/bin/env nodejs
var bw         = require('buffered-writer');
var XmlStream  = require('xml-stream');
var path       = require('path');
var fs         = require('fs');

// Settings
var targetPath = '/tmp/bigtv.xml';
var sourcePath = '/tmp/xmltv/';
var newIds     = {};

// Open the target file
var target = bw.open(targetPath);

function string_to_slug(str) {
  str = str.replace(/^\s+|\s+$/g, ''); // trim
  str = str.toLowerCase();
  
  // remove accents, swap ñ for n, etc
  var from = "àáäâèéëêìíïîòóöôùúüûñç·/_,:;";
  var to   = "aaaaeeeeiiiioooouuuunc------";
  for (var i=0, l=from.length ; i<l ; i++) {
    str = str.replace(new RegExp(from.charAt(i), 'g'), to.charAt(i));
  }

  str = str.replace(/[^a-z0-9 -]/g, '') // remove invalid chars
    .replace(/\s+/g, '-') // collapse whitespace and replace by -
    .replace(/-+/g, '-'); // collapse dashes

  return str;
}

function p(str) {
	return escapeHtml(str);
}

function escapeHtml(unsafe) {
	return unsafe
			 .replace(/&/g, "&amp;")
			 .replace(/</g, "&lt;")
			 .replace(/>/g, "&gt;")
			 .replace(/"/g, "&quot;")
			 .replace(/'/g, "&#039;");
}

// Write the first few lines
target.write('<?xml version="1.0" encoding="ISO-8859-1"?>\n\
<!DOCTYPE tv SYSTEM "xmltv.dtd">\n\
<tv>\n');

target.on('error', function (error){
  console.log (error);
});

// Get all the source xml files
var sourceFiles = fs.readdirSync(sourcePath);

for (var i in sourceFiles) {
	
	(function(filename) {
		
		var stream = fs.createReadStream(path.join(sourcePath, filename));
		var parser = new XmlStream(stream);
		
		parser.on('error', function (error) {
			console.error('XML Parse error: ' + error);
		});
		
		parser.on('endElement: channel', function(item) {
			
			var newId = string_to_slug(item['display-name']) + '_' + item.$.id.replace('.microsoft.com', '');
			
			newIds[item.$.id] = newId;
			
			target.write('\t<channel id="' + newId + '">\n');
			target.write('\t\t<display-name>' + p(item['display-name']) + '</display-name>\n');
			target.write('\t</channel>\n');
			
		});
		
		parser.collect('category');
		parser.collect('desc');
		parser.collect('title');
		
		parser.on('endElement: programme', function(item) {
			
			var a = item.$;
			
			var prog = '\t<programme start="' + a.start + '" stop="' + a.stop + '" channel="' + newIds[a.channel] + '">\n';
			
			for (var i in item.title) {
				var title = item.title[i];
				prog += '\t\t<title lang="' + title.$.lang + '">' + p(title.$text) + '</title>\n';
			}
			
			for (var i in item.desc) {
				var desc = item.desc[i];
				prog += '\t\t<desc lang="' + desc.$.lang + '">' + p(desc.$text) + '</desc>\n';
			}
			
			prog += '\t\t<date>' + item.date + '</date>\n';
			
			for (var i in item.category) {
				var category = item.category[i];
				prog += '\t\t<category lang="' + category.$.lang + '">' + p(category.$text) + '</category>\n';
			}
			
			if (item.length) {
				prog += '\t\t<length units="' + item.length.$.units + '">' + p(item.length.$text) + '</length>\n';
			}
			
			if (item['episode-num']) {
				prog += '\t\t<episode-num system="' + item['episode-num'].$.system + '">' + p(item['episode-num'].$text) + '</episode-num>\n';
			}
			
			prog += '\t</programme>\n';
			
			target.write(prog);

		});
		
	})(sourceFiles[i]);
	
}

process.on('exit', function (){
  target.write('</tv>');
	target.close();
});