var fs = require('fs');

module.exports = function(){
  return {
    list: function(callback){
      list(callback);
    },
    cards: function(deck_name, callback){
      cards(deck_name, callback);
    }
  }
};

function list(callback){
  var decks = [];
  fs.readdirSync('decks').forEach(function(file){
   var stat = fs.statSync('decks/'+file);
   if(stat && stat.isDirectory()){
     decks.push(file);
   }
 });

 callback(null, decks);
}

function cards(deck_name, callback){
  // load from deck json
  var deck_config = JSON.parse(fs.readFileSync('decks/' + deck_name + '/deck.json', 'utf8'));
  var deck_image_path = '/decks/' + deck_name + '/deck_images';

  // render each card
  var cards = deck_config.cards.map(function(card){
    return { front_markup: CardTemplate(deck_config.frontTemplate, card), back_markup: CardTemplate(deck_config.backTemplate, card) };
  });

  callback(null, {cards: cards, deck_image_path: deck_image_path});
}

var CardTemplate = function(template, data) {
    var regex = /\{([^\}]+)\}/, match;
    while(match = template.match(regex)) {
        template = template.replace(match[0], data[match[1]])
    }
    return template;
}
