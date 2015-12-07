// utility things
var fs = require('fs');
var path = require('path');

// web setup
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
app.use('/', express.static(path.join(__dirname, 'public')));
app.use('/bower_components',  express.static(__dirname + '/bower_components'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

// db setup
var pg_server = process.env.DATABASE_URL || 'localhost';
var pg_conn_string = "postgres://" + pg_server + "/cardtable";
var pgp = require('pg-promise')(/*options*/);
var db = pgp(pg_conn_string);

// socket.io setup
var server = require('http').Server(app);
var io = require('socket.io').listen(server);
server.listen(3000);

io.sockets.on('connection', function (socket) {

  var table_id;

  // init table connection
  socket.on('initDecks', function(){
    emitDecks(io);
  });

  socket.on('loadDeck', function(data){
    loadDeckToTablespace(table_id, data);
  });

  // init table connection
  socket.on('initTable', function(table_id_param){
    table_id = table_id_param;
    emitTableState(table_id, io);
  });

  // move a card to a new position
  socket.on('moveCardPosition', function(data){
    moveCardPosition(table_id, io, data);
  });

  // turn a tablespace into a pile
  socket.on('pileTablespace', function(data){
    pileTablespace(table_id, io, data);
  });

});

function emitDecks(io){
  var decks = [];
  fs.readdirSync('decks').forEach(function(file){
   var stat = fs.statSync('decks/'+file);
   if(stat && stat.isDirectory()){
     decks.push(file);
   }
  });
  io.emit('updateDecks', decks);
}

function loadDeckToTablespace(table_id, data){
  var deck_name = data['deckName'];
  var tablespace_coord = data['tablespaceId'];
  // load from deck json
  var deck_config = JSON.parse(fs.readFileSync('decks/' + deck_name + '/deck.json', 'utf8'));
  // allow deck_images to be used for this deck
  app.use('/deck_images', express.static(__dirname + '/decks/' + deck_name + '/deck_images'));

  // render each card
  var cards = deck_config.cards.map(function(card){
    return { markup: CardTemplate(deck_config.frontTemplate, card) };
  });

  // shuffle, then apply ordinals
  shuffle(cards);
  cards = cards.map(function(card,i){
    return { markup: card.markup, ordinal: i };
  });

  putCardPileOnTablespace(table_id, cards, tablespace_coord);
}

function putCardPileOnTablespace(table_id, cards, tablespace_coord){
  var pile_string = new Date().getTime();
  var insert_values = cards.map(function(card){ return '(' + [ parseInt(table_id), pgp.as.text(tablespace_coord), pgp.as.text(card.markup), card.ordinal, pgp.as.text(pile_string) ].join(',') + ')' });
  var sql = `
    INSERT INTO cards ( table_id, tablespace_coord, markup, ordinal, pile )
    VALUES
    ${insert_values.join(',')}
  `;
  db.query(sql).then(function(data){
    emitTableState(table_id, io);
  }).catch(function(error){
    console.error('error running query', error);
  });
}

function emitTableState(table_id, io){

  var sql = `
  WITH pile_data AS (
    SELECT pile, MAX(ordinal) AS pile_max_ordinal, COUNT(1) AS cards_in_pile
    FROM cards
    WHERE
      table_id = $1::INT
      AND pile IS NOT NULL
    GROUP BY pile
  )

  SELECT cards.id, cards.tablespace_coord, cards.markup, cards.color, cards.ordinal, cards.pile, pile_data.cards_in_pile
  FROM cards
  JOIN pile_data ON pile_data.pile_max_ordinal = cards.ordinal AND pile_data.pile = cards.pile

  UNION

  SELECT cards.id, cards.tablespace_coord, cards.markup, cards.color, cards.ordinal, cards.pile, 1 AS cards_in_pile
  FROM cards
  WHERE
    table_id = $1::INT
    AND pile IS NULL
  `;

  db.query(sql, table_id)
    .then(function(data){
        table_data = {};
        data.map(function(card){
          if(table_data[card.tablespace_coord]){
            table_data[card.tablespace_coord]['cards'].push({ id: card.id, markup: card.markup, color: card.color, ordinal: card.ordinal, cards_in_pile: card.cards_in_pile, pile: card.pile });
          } else {
            table_data[card.tablespace_coord] = {};
            table_data[card.tablespace_coord]['cards'] = [ { id: card.id, markup: card.markup, color: card.color, ordinal: card.ordinal, cards_in_pile: card.cards_in_pile, pile: card.pile } ];
          }
        });

        io.emit('updateTable', table_data);
    })
    .catch(function(error){
        console.error('error running query', error);
    });

}

function pileTablespace(table_id, io, data){
  var pile_string = new Date().getTime();
  sql = `
    UPDATE cards SET pile = $1 WHERE tablespace_coord = $2
  `;
  db.query(
    sql, [pile_string, data['tablespaceId']]
  ).then(function(data){
    emitTableState(table_id, io);
  }).catch(function(error){
    console.error('error running query', error);
  });
}

function moveCardToNewOrdinalQuery(table_id, tablespace_coord, card_id, old_ordinal, new_ordinal){
  var sql;
  if(old_ordinal > new_ordinal){
    sql = `
      UPDATE cards
        SET
        pile = NULL,
        ordinal = CASE
          WHEN id = $2::INT THEN
            $4
          ELSE
            ordinal + 1
        END
      WHERE
        ordinal <= $3::INT AND ordinal >= $4::INT
        AND tablespace_coord = $5::VARCHAR
        AND table_id = $1::INT
    `;
  } else {
    sql = `
      UPDATE cards
        SET
        pile = NULL,
        ordinal = CASE
          WHEN id = $2::INT THEN
            $4
          ELSE
            ordinal - 1
        END
      WHERE
        ordinal >= $3::INT AND ordinal <= $4::INT
        AND tablespace_coord = $5::VARCHAR
        AND table_id = $1::INT
      `;
  }
  var arg_array = [ table_id, card_id, old_ordinal, new_ordinal, tablespace_coord ];
  return { query: sql, args: arg_array };
}

function moveCardToNewTablespace(table_id, old_tablespace_coord, card_id, new_tablespace_coord, tail_ordinal){
  var sql = `
    UPDATE cards
      SET tablespace_coord = $4,
      ordinal = $5::INT,
      pile = NULL
    WHERE
      id = $2::INT
      AND table_id = $1::INT
      AND tablespace_coord = $3
  `;
  var arg_array = [ table_id, card_id, old_tablespace_coord, new_tablespace_coord, tail_ordinal ];
  return { query: sql, args: arg_array };
}

function tablespacesDataQuery(table_id, tablespace_coords){
  var sql = `
    SELECT
      tablespace_coord,
      MAX(ordinal)::INT AS max_ordinal,
      COUNT(1)::INT AS total_cards
    FROM cards
    WHERE
      tablespace_coord IN ($1^)
      AND table_id = $2::INT
    GROUP BY tablespace_coord
  `;
  var arg_array = [ pgp.as.csv(tablespace_coords), table_id ];
  return { query: sql, args: arg_array };
}

function moveCardPosition(table_id, io, request_data){
    // if we're moving from one tablespace to another, things are a bit more complicated
    if(request_data['oldTablespaceId'] != request_data['newTablespaceId']){

      // get data about both tablespaces so we can reorder them and move the card between them
      query_data = tablespacesDataQuery(table_id, [request_data['newTablespaceId'], request_data['oldTablespaceId']]);
      db.query(
        query_data.query, query_data.args
      ).then(function(data){

        // unfold the data a bit for ease
        var tablespace_data = {};
        data.forEach(function(tablespace){ tablespace_data[tablespace.tablespace_coord] = tablespace; });

        // prepping for multiple queries in transaction
        var queries = [];
        var query_data;
        db.tx(function(t){
          // query move card to end of old tablespace
          query_data = moveCardToNewOrdinalQuery(
            table_id,
            request_data['oldTablespaceId'],
            request_data['cardId'],
            request_data['oldOrdinal'],
            (tablespace_data[request_data['oldTablespaceId']]['max_ordinal'])
          );
          queries.push(t.any(query_data.query, query_data.args));
          // move card to end of new tablespace
          query_data = moveCardToNewTablespace(
            table_id,
            request_data['oldTablespaceId'],
            request_data['cardId'],
            request_data['newTablespaceId'],
            (tablespace_data[request_data['newTablespaceId']]) ? (tablespace_data[request_data['newTablespaceId']]['max_ordinal'] + 1) : 0
          );
          queries.push(t.any(query_data.query, query_data.args));
          // move card to requested ordinal in new tablespace
          query_data = moveCardToNewOrdinalQuery(
            table_id,
            request_data['newTablespaceId'],
            request_data['cardId'],
            (tablespace_data[request_data['newTablespaceId']]) ? (tablespace_data[request_data['newTablespaceId']]['max_ordinal'] + 1) : 0,
            request_data['newOrdinal']
          );
          queries.push(t.any(query_data.query, query_data.args));

          // run all queries in batch
          return t.batch([queries]);
        }).then(function(data){
          emitTableState(table_id, io);
        }).catch(function(error){
          console.error('error running query df', error);
        });
      }).catch(function(error){
        console.error('error running query', error);
      });

    } else {

      // no need to move things between tablespaces, just re-order this tablespace
      query_data = moveCardToNewOrdinalQuery(
        table_id,
        request_data['newTablespaceId'],
        request_data['cardId'],
        request_data['oldOrdinal'],
        request_data['newOrdinal']
      );
      db.query(
        query_data.query, query_data.args
      ).then(function(data){
        emitTableState(table_id, io);
      }).catch(function(error){
        console.error('error running query', error);
      });

    }
}

var CardTemplate = function(template, data) {
    var regex = /\{([^\}]+)\}/, match;
    while(match = template.match(regex)) {
        template = template.replace(match[0], data[match[1]])
    }
    return template;
}

// found online
// https://github.com/coolaj86/knuth-shuffle
function shuffle(array) {
  var currentIndex = array.length, temporaryValue, randomIndex ;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}

app.listen(app.get('port'), function() {
  console.log('Server started: http://localhost:' + app.get('port') + '/');
});
