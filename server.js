// utility things
var fs = require('fs');
var path = require('path');

// web setup
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
app.use('/', express.static(path.join(__dirname, 'dist')));
app.use('/bower_components',  express.static(__dirname + '/bower_components'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

// db setup
var pg_server = process.env.DATABASE_URL || 'localhost';
var pg_conn_string = "postgres://" + pg_server + "/cardtable";
var pgp = require('pg-promise')();
var db = pgp(pg_conn_string);

// socket.io setup
var server = require('http').Server(app);
var io = require('socket.io').listen(server);

// models
var table_model = require('./lib/table')(db);
var deck_model = require('./lib/deck')();

server.listen(3000);

io.sockets.on('connection', function(socket){

  // load decks for listing
  socket.on('initDecks', function(){
    deck_model.list(function(err, decks){
      if(!err){
        io.emit('updateDecks', decks);
      } else {
        console.error('error running initDecks', err);
      }
    });
  });

  // load a deck and pile it onto a tablespace
  socket.on('loadDeck', function(data){
    var deck_name = data['deckName'];
    var tablespace_coord = data['tablespaceId'];
    deck_model.cards(deck_name, function(err, deck_data){
      // allow deck_images to be used for this deck
      app.use('/deck_images', express.static(__dirname + deck_data.deck_image_path));
      // put deck's cards onto the specified tablespace
      table_model.putNewCardsOnTablespace(deck_data.cards, tablespace_coord, function(err, table_data){
        // broadcast changes to table
        if(!err){
          io.emit('updateTable', table_data);
        } else {
          console.error('error running loadDeck', err);
        }
      });
    });
  });

  // init table connection
  socket.on('initTable', function(table_id_param){
    table_model.loadTableState(function(err, table_data){
      if(!err){
        io.emit('updateTable', table_data);
      } else {
        console.error('error running initTable', err);
      }
    });
  });

  // move a card to a new position
  socket.on('moveCardPosition', function(data){
    table_model.moveCardPosition(data, function(err, table_data){
      if(!err){
        io.emit('updateTable', table_data);
      } else {
        console.error('error running moveCardPosition', err);
      }
    });
  });

  // turn a tablespace into a pile
  socket.on('pileTablespace', function(data){
    table_model.pileTablespace(data, function(err, table_data){
      if(!err){
        io.emit('updateTable', table_data);
      } else {
        console.error('error running pileTablespace', err);
      }
    });
  });

});

app.listen(app.get('port'), function() {
  console.log('Server started: http://localhost:' + app.get('port') + '/');
});
